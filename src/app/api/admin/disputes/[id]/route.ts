import { withRoleGuard } from "@/lib/middleware/auth";
import { prisma } from "@/lib/db/client";
import {
  BetOutcome,
  BetStatus,
  RefereeAssignmentStatus,
  UserRole,
} from "../../../../../../generated/prisma/client";
import { adminResolveDisputeSchema } from "@/lib/validation/schemas";
import { appendRefereeAudit, auditContextFromRequest } from "@/lib/referees/audit";
import { refundEscrow } from "@/lib/ledger/escrow";

export const GET = withRoleGuard([UserRole.ADMIN], async (_req, context) => {
  const id = context?.params?.id;
  if (!id) {
    return Response.json({ error: "Dispute ID required" }, { status: 400 });
  }

  const dispute = await prisma.dispute.findUnique({
    where: { id },
    include: {
      bet: {
        include: {
          game: { select: { name: true, slug: true } },
          playerA: { select: { id: true, displayName: true, email: true } },
          playerB: { select: { id: true, displayName: true, email: true } },
        },
      },
      filedBy: { select: { id: true, displayName: true, email: true } },
      messages: {
        include: {
          author: { select: { id: true, displayName: true, role: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!dispute) {
    return Response.json({ error: "Dispute not found" }, { status: 404 });
  }

  return Response.json(dispute);
});

export const PATCH = withRoleGuard([UserRole.ADMIN], async (req, context, auth) => {
  const id = context?.params?.id;
  if (!id) {
    return Response.json({ error: "Dispute ID required" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = adminResolveDisputeSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const dispute = await prisma.dispute.findUnique({
    where: { id },
    include: {
      bet: {
        include: { refereeAssignment: true },
      },
    },
  });
  if (!dispute) {
    return Response.json({ error: "Dispute not found" }, { status: 404 });
  }

  if (!["OPEN", "UNDER_REVIEW"].includes(dispute.status)) {
    return Response.json(
      { error: "Dispute has already been resolved" },
      { status: 400 }
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM bets WHERE id = ${dispute.betId}::uuid FOR UPDATE`;
    const now = new Date();
    const resolved = await tx.dispute.update({
      where: { id },
      data: {
        status: parsed.data.status,
        resolution: parsed.data.resolution,
        resolvedById: auth.userId,
        resolvedAt: now,
      },
    });

    const outcomeByStatus: Partial<Record<string, BetOutcome>> = {
      RESOLVED_PLAYER_A: BetOutcome.PLAYER_A_WIN,
      RESOLVED_PLAYER_B: BetOutcome.PLAYER_B_WIN,
      RESOLVED_DRAW: BetOutcome.DRAW,
    };
    const outcome = outcomeByStatus[parsed.data.status];

    if (dispute.bet.refereeAssignment) {
      const assignment = dispute.bet.refereeAssignment;
      if (parsed.data.status === "RESOLVED_VOID") {
        if (dispute.bet.status !== BetStatus.DISPUTED) {
          throw new Error("Only an unsettled disputed bet can be voided");
        }
        await refundEscrow(tx, {
          betId: dispute.betId,
          playerId: dispute.bet.playerAId,
          amount: dispute.bet.amount,
          idempotencyKey: `dispute:${id}:refund:a`,
        });
        if (dispute.bet.playerBId) {
          await refundEscrow(tx, {
            betId: dispute.betId,
            playerId: dispute.bet.playerBId,
            amount: dispute.bet.amount,
            idempotencyKey: `dispute:${id}:refund:b`,
          });
        }
        await tx.bet.update({
          where: { id: dispute.betId },
          data: { status: BetStatus.VOIDED, cancelledAt: now },
        });
        await tx.refereeAssignment.update({
          where: { id: assignment.id },
          data: {
            status: RefereeAssignmentStatus.CANCELLED,
            cancelledAt: now,
            version: { increment: 1 },
          },
        });
      } else if (outcome) {
        await tx.bet.update({
          where: { id: dispute.betId },
          data: {
            status: BetStatus.RESULT_REPORTED,
            outcome,
            resultVerified: true,
            resultReportedAt: now,
          },
        });

        // The referee's own call stays in `decision`. Overwriting it here used
        // to erase the only queryable record of what they decided, leaving
        // overturn rate reconstructible solely from the audit chain.
        const overturned =
          assignment.decision !== null && assignment.decision !== outcome;

        await tx.refereeAssignment.update({
          where: { id: assignment.id },
          data: {
            status: RefereeAssignmentStatus.DECISION_SUBMITTED,
            // Only fill `decision` when the referee never submitted one.
            decision: assignment.decision ?? outcome,
            overturnedOutcome: overturned ? outcome : null,
            overturnedAt: overturned ? now : null,
            disputeDeadline: now,
            version: { increment: 1 },
          },
        });

        if (overturned && assignment.refereeProfileId) {
          await tx.refereeProfile.update({
            where: { id: assignment.refereeProfileId },
            data: { disputesUpheld: { increment: 1 } },
          });
        }
      }

      await appendRefereeAudit(tx, {
        assignmentId: assignment.id,
        actorUserId: auth.userId,
        action: "DISPUTE_RESOLVED",
        details: {
          disputeId: id,
          resolutionStatus: parsed.data.status,
          outcome: outcome ?? null,
          refereeDecision: assignment.decision ?? null,
          overturned:
            assignment.decision !== null &&
            outcome !== null &&
            assignment.decision !== outcome,
          resolution: parsed.data.resolution,
        },
        context: auditContextFromRequest(req),
      });
    }
    return resolved;
  });

  return Response.json(updated);
});
