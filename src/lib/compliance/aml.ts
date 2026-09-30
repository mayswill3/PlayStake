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
import { prisma, type TxClient } from "../db/client";
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
