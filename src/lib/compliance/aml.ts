// =============================================================================
// PlayStake — AML cases
// =============================================================================
// Suspicions for the MLRO. Raised by the AML monitoring scan, by identity
// screening at KYC, by chargebacks, or by staff. At most one open case per
// customer, type and counterparty, so a pattern that keeps matching doesn't
// flood the queue. The MLRO records the decision on the case; a Suspicious
// Activity Report itself is filed with the NCA outside the platform.
// =============================================================================

import {
  AmlCaseStatus,
  AmlCaseType,
  type Prisma,
} from "../../../generated/prisma/client";
import { prisma, withTransaction, type TxClient } from "../db/client";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { recordAdminAction } from "../admin/audit";
import { emailAdminAlert } from "../email/events";
import { appUrl } from "../email/layout";

export const OPEN_AML_STATUSES: AmlCaseStatus[] = [
  AmlCaseStatus.OPEN,
  AmlCaseStatus.INVESTIGATING,
  AmlCaseStatus.ESCALATED_TO_MLRO,
];

export interface RaiseAmlCaseInput {
  userId: string;
  type: AmlCaseType;
  severity: "low" | "medium" | "high";
  details: Prisma.InputJsonValue;
  relatedUserId?: string | null;
}

/**
 * Open a case unless an open one already covers this customer, type and
 * counterparty. Returns the case id, or null if one was already open.
 */
export async function raiseAmlCase(
  input: RaiseAmlCaseInput,
  tx: TxClient | typeof prisma = prisma,
): Promise<string | null> {
  const existing = await tx.amlCase.findFirst({
    where: {
      userId: input.userId,
      type: input.type,
      relatedUserId: input.relatedUserId ?? null,
      status: { in: OPEN_AML_STATUSES },
    },
    select: { id: true },
  });
  if (existing) return null;

  const created = await tx.amlCase.create({
    data: {
      userId: input.userId,
      relatedUserId: input.relatedUserId ?? null,
      type: input.type,
      severity: input.severity,
      details: input.details,
    },
    select: { id: true },
  });

  await emailAdminAlert({
    key: `aml-${created.id}`,
    title: `AML case: ${input.type.replace(/_/g, " ").toLowerCase()} (${input.severity})`,
    detail: `A new AML case was opened for user ${input.userId}. Review it in the AML queue.`,
    url: appUrl(`/admin/aml/${created.id}`),
  });
  return created.id;
}

/** Whether the customer has an open case of any of these types. */
export async function hasOpenAmlCase(userId: string, types: AmlCaseType[]): Promise<boolean> {
  const count = await prisma.amlCase.count({
    where: { userId, type: { in: types }, status: { in: OPEN_AML_STATUSES } },
  });
  return count > 0;
}

// ---------------------------------------------------------------------------
// Staff handling (the MLRO's queue)
// ---------------------------------------------------------------------------

export type StaffAmlAction =
  | { kind: "assign" }
  | { kind: "note"; body: string }
  | { kind: "escalate"; decision: string }
  | { kind: "sar"; sarReference: string; decision: string }
  | { kind: "close"; outcome: "CLOSED_NO_ACTION" | "CLOSED_ACTION_TAKEN"; decision: string };

export async function listAmlCasesForStaff(scope: "open" | "closed" | "all") {
  return prisma.amlCase.findMany({
    where:
      scope === "open"
        ? { status: { in: OPEN_AML_STATUSES } }
        : scope === "closed"
          ? { status: { notIn: OPEN_AML_STATUSES } }
          : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { id: true, displayName: true, email: true, accountStatus: true } },
      relatedUser: { select: { id: true, displayName: true } },
      assignedTo: { select: { displayName: true } },
    },
  });
}

export async function getAmlCaseForStaff(caseId: string) {
  const amlCase = await prisma.amlCase.findUnique({
    where: { id: caseId },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          accountStatus: true,
          kycStatus: true,
          createdAt: true,
          kycSubmissions: {
            where: { status: "APPROVED" },
            orderBy: { reviewedAt: "desc" },
            take: 1,
            select: { legalFirstName: true, legalLastName: true, dateOfBirth: true, country: true },
          },
        },
      },
      relatedUser: { select: { id: true, displayName: true, email: true, accountStatus: true } },
      assignedTo: { select: { displayName: true } },
      notes: { orderBy: { createdAt: "asc" }, include: { author: { select: { displayName: true } } } },
    },
  });
  if (!amlCase) return null;

  const otherCases = await prisma.amlCase.findMany({
    where: { userId: amlCase.userId, id: { not: amlCase.id } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, type: true, status: true, severity: true, createdAt: true },
  });
  return { ...amlCase, otherCases };
}

/** Everything the MLRO or an investigator does on a case, audited. */
export async function actOnAmlCase(
  caseId: string,
  actorId: string,
  action: StaffAmlAction,
  request?: Request | null,
): Promise<void> {
  const amlCase = await prisma.amlCase.findUnique({ where: { id: caseId } });
  if (!amlCase) throw new NotFoundError("Case not found");
  if (!OPEN_AML_STATUSES.includes(amlCase.status) && action.kind !== "note") {
    throw new ConflictError("This case is closed");
  }
  const decision = "decision" in action ? action.decision.trim() : "";
  if ("decision" in action && decision.length < 10) {
    throw new ValidationError("Record the reasoning for this decision (at least 10 characters)");
  }
  const withDecision = (previous: string | null) =>
    [previous, `${new Date().toISOString().slice(0, 10)}: ${decision}`].filter(Boolean).join("\n");

  await withTransaction(async (tx) => {
    switch (action.kind) {
      case "assign":
        await tx.amlCase.update({
          where: { id: caseId },
          data: {
            assignedToId: actorId,
            status: amlCase.status === AmlCaseStatus.OPEN ? AmlCaseStatus.INVESTIGATING : amlCase.status,
          },
        });
        break;
      case "note":
        if (action.body.trim().length < 3) throw new ValidationError("Write a note");
        await tx.amlCaseNote.create({ data: { caseId, authorId: actorId, body: action.body.trim() } });
        break;
      case "escalate":
        await tx.amlCase.update({
          where: { id: caseId },
          data: { status: AmlCaseStatus.ESCALATED_TO_MLRO, mlroDecision: withDecision(amlCase.mlroDecision) },
        });
        break;
      case "sar":
        if (action.sarReference.trim().length < 3) throw new ValidationError("Enter the NCA SAR reference");
        await tx.amlCase.update({
          where: { id: caseId },
          data: {
            status: AmlCaseStatus.SAR_SUBMITTED,
            sarReference: action.sarReference.trim(),
            mlroDecision: withDecision(amlCase.mlroDecision),
          },
        });
        break;
      case "close":
        await tx.amlCase.update({
          where: { id: caseId },
          data: {
            status: action.outcome as AmlCaseStatus,
            closedAt: new Date(),
            mlroDecision: withDecision(amlCase.mlroDecision),
          },
        });
        break;
    }
    await recordAdminAction(
      {
        actorId,
        action: `aml_case.${action.kind}`,
        targetType: "aml_case",
        targetId: caseId,
        details: { userId: amlCase.userId, ...action } as Record<string, string>,
        request,
      },
      tx,
    );
  });
}
