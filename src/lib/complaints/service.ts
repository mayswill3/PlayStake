// =============================================================================
// PlayStake — Complaints
// =============================================================================
// The customer complaints procedure (the Commission requires one, and a named
// ADR provider — IBAS):
//
//   1. received    — reference issued and acknowledged by email at once
//   2. investigated — notes and messages recorded on the complaint
//   3. final response within 8 weeks — outcome and reasons, with how to take
//      the complaint to IBAS if the customer is not satisfied
//
// A bet Dispute (challenging a result) is separate and faster; a customer
// unhappy with how a dispute was handled can raise a complaint about it.
// =============================================================================

import {
  ComplaintCategory,
  ComplaintOutcome,
  ComplaintStatus,
} from "../../../generated/prisma/client";
import { prisma, withTransaction } from "../db/client";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { queueEmail } from "../email/outbox";
import { recordAdminAction } from "../admin/audit";

/** The Commission's longest allowed time to a final response. */
export const FINAL_RESPONSE_WINDOW_MS = 8 * 7 * 24 * 60 * 60 * 1000;
/** Staff are alerted when a complaint gets this close to its deadline. */
export const DEADLINE_WARNING_MS = 14 * 24 * 60 * 60 * 1000;

export const ADR_PROVIDER = {
  name: "IBAS",
  fullName: "Independent Betting Adjudication Service",
  url: "https://www.ibas-uk.com",
} as const;

const OUTCOME_LABEL: Record<ComplaintOutcome, string> = {
  [ComplaintOutcome.UPHELD]: "upheld",
  [ComplaintOutcome.PARTIALLY_UPHELD]: "partially upheld",
  [ComplaintOutcome.NOT_UPHELD]: "not upheld",
};

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

async function nextReference(now: Date): Promise<string> {
  const [{ nextval }] = await prisma.$queryRaw<{ nextval: bigint }[]>`
    SELECT nextval('complaint_reference_seq')
  `;
  return `PS-C-${now.getUTCFullYear()}-${String(nextval).padStart(6, "0")}`;
}

export interface FileComplaintInput {
  userId: string | null;
  name: string;
  email: string;
  category: ComplaintCategory;
  description: string;
  betId?: string | null;
}

/** Record a complaint, issue its reference and acknowledge it. */
export async function fileComplaint(input: FileComplaintInput) {
  const now = new Date();
  const description = input.description.trim();
  if (description.length < 20) {
    throw new ValidationError("Tell us a little more about your complaint (at least 20 characters)");
  }

  if (input.betId) {
    const bet = await prisma.bet.findUnique({
      where: { id: input.betId },
      select: { playerAId: true, playerBId: true },
    });
    // A bet reference is optional context; only accept one the customer was in.
    if (!bet || !input.userId || (bet.playerAId !== input.userId && bet.playerBId !== input.userId)) {
      throw new ValidationError("That bet isn't one of yours");
    }
  }

  const reference = await nextReference(now);
  const finalResponseDueAt = new Date(now.getTime() + FINAL_RESPONSE_WINDOW_MS);

  const complaint = await withTransaction(async (tx) => {
    const created = await tx.complaint.create({
      data: {
        reference,
        userId: input.userId,
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        category: input.category,
        description,
        betId: input.betId ?? null,
        receivedAt: now,
        acknowledgedAt: now,
        finalResponseDueAt,
        events: {
          create: [
            { type: "received", body: description, visibleToCustomer: true },
            { type: "acknowledged", visibleToCustomer: true },
          ],
        },
      },
    });

    await queueEmail(
      {
        template: "complaint.received",
        dedupeKey: `complaint-received-${created.id}`,
        toEmail: created.email,
        payload: { name: created.name, reference, dueBy: formatDay(finalResponseDueAt) },
      },
      tx,
    );
    return created;
  });

  return complaint;
}

export async function listCustomerComplaints(userId: string) {
  return prisma.complaint.findMany({
    where: { userId },
    orderBy: { receivedAt: "desc" },
    select: {
      id: true,
      reference: true,
      category: true,
      status: true,
      receivedAt: true,
      finalResponseDueAt: true,
      finalResponseAt: true,
      outcome: true,
      finalResponse: true,
    },
  });
}

async function loadOpenComplaint(complaintId: string) {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint) throw new NotFoundError("Complaint not found");
  if (complaint.status === ComplaintStatus.FINAL_RESPONSE_ISSUED) {
    throw new ConflictError("A final response has already been issued for this complaint");
  }
  return complaint;
}

export type StaffComplaintAction =
  | { kind: "note"; body: string }
  | { kind: "message"; body: string }
  | { kind: "status"; status: "INVESTIGATING" | "AWAITING_CUSTOMER" }
  | { kind: "final_response"; outcome: ComplaintOutcome; response: string };

/** Everything staff do to a complaint goes through here and is audited. */
export async function actOnComplaint(
  complaintId: string,
  actorId: string,
  action: StaffComplaintAction,
  request?: Request | null,
) {
  const complaint = await loadOpenComplaint(complaintId);
  const now = new Date();

  return withTransaction(async (tx) => {
    switch (action.kind) {
      case "note": {
        if (action.body.trim().length < 3) throw new ValidationError("Write a note");
        await tx.complaintEvent.create({
          data: { complaintId, actorId, type: "note", body: action.body.trim() },
        });
        break;
      }
      case "message": {
        if (action.body.trim().length < 10) throw new ValidationError("Write a message to the customer");
        await tx.complaintEvent.create({
          data: {
            complaintId,
            actorId,
            type: "message",
            body: action.body.trim(),
            visibleToCustomer: true,
          },
        });
        await queueEmail(
          {
            template: "complaint.update",
            dedupeKey: `complaint-update-${complaintId}-${now.getTime()}`,
            toEmail: complaint.email,
            payload: { name: complaint.name, reference: complaint.reference, message: action.body.trim() },
          },
          tx,
        );
        break;
      }
      case "status": {
        await tx.complaint.update({
          where: { id: complaintId },
          data: { status: action.status, handledById: actorId },
        });
        await tx.complaintEvent.create({
          data: { complaintId, actorId, type: "status", body: action.status },
        });
        break;
      }
      case "final_response": {
        const response = action.response.trim();
        if (response.length < 50) {
          throw new ValidationError("A final response must explain the outcome and the reasons (at least 50 characters)");
        }
        await tx.complaint.update({
          where: { id: complaintId },
          data: {
            status: ComplaintStatus.FINAL_RESPONSE_ISSUED,
            outcome: action.outcome,
            finalResponse: response,
            finalResponseAt: now,
            handledById: actorId,
          },
        });
        await tx.complaintEvent.create({
          data: {
            complaintId,
            actorId,
            type: "final_response",
            body: response,
            visibleToCustomer: true,
          },
        });
        await queueEmail(
          {
            template: "complaint.final-response",
            dedupeKey: `complaint-final-${complaintId}`,
            toEmail: complaint.email,
            payload: {
              name: complaint.name,
              reference: complaint.reference,
              outcome: OUTCOME_LABEL[action.outcome],
              response,
            },
          },
          tx,
        );
        break;
      }
    }

    await recordAdminAction(
      {
        actorId,
        action: `complaint.${action.kind}`,
        targetType: "complaint",
        targetId: complaintId,
        details: action as unknown as Record<string, string>,
        request,
      },
      tx,
    );
  });
}

/** Open complaints for the staff queue, most urgent (nearest deadline) first. */
export async function listComplaintsForStaff(status: "open" | "closed" | "all") {
  return prisma.complaint.findMany({
    where:
      status === "open"
        ? { status: { not: ComplaintStatus.FINAL_RESPONSE_ISSUED } }
        : status === "closed"
          ? { status: ComplaintStatus.FINAL_RESPONSE_ISSUED }
          : {},
    orderBy: status === "closed" ? { finalResponseAt: "desc" } : { finalResponseDueAt: "asc" },
    take: 200,
    select: {
      id: true,
      reference: true,
      name: true,
      email: true,
      category: true,
      status: true,
      receivedAt: true,
      finalResponseDueAt: true,
      finalResponseAt: true,
      outcome: true,
    },
  });
}

export async function getComplaintForStaff(complaintId: string) {
  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    include: {
      events: {
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { displayName: true } } },
      },
      user: { select: { id: true, displayName: true, email: true } },
    },
  });
  if (!complaint) throw new NotFoundError("Complaint not found");
  return complaint;
}

/**
 * Complaints near or past their eight-week deadline without a final response.
 * Used by the scheduled scan to alert staff (once per complaint per stage).
 */
export async function findComplaintsNearDeadline(now: Date = new Date()) {
  return prisma.complaint.findMany({
    where: {
      status: { not: ComplaintStatus.FINAL_RESPONSE_ISSUED },
      finalResponseDueAt: { lte: new Date(now.getTime() + DEADLINE_WARNING_MS) },
    },
    select: { id: true, reference: true, finalResponseDueAt: true },
  });
}
