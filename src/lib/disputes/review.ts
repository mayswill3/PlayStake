// =============================================================================
// PlayStake — Dispute review
// =============================================================================
// A disputed result is decided by someone who wasn't involved: an admin, or a
// referee an admin has approved as a dispute reviewer. A reviewer is never the
// referee who made the call or a player in the match, and is kept off any
// dispute involving a player they follow, are followed by or have a block with
// (the same rule as officiating, ../referees/conflicts).
//
// Reviewers take a dispute before deciding it, so two people can't decide the
// same one; an admin can decide any dispute. Every step is written to the
// match's hash-chained referee audit trail and the admin audit log.
// =============================================================================

import {
  BetOutcome,
  BetStatus,
  DisputeStatus,
  RefereeAssignmentStatus,
  RefereeProfileStatus,
  UserRole,
  type Prisma,
} from "../../../generated/prisma/client";
import { prisma, withTransaction } from "../db/client";
import { AuthorizationError, ConflictError, NotFoundError } from "../errors";
import { recordAdminAction } from "../admin/audit";
import { emailDisputeResolved } from "../email/events";
import { refundEscrow } from "../ledger/escrow";
import { appendRefereeAudit, type AuditContext } from "../referees/audit";
import { areSociallyLinked } from "../referees/conflicts";

export type ResolutionStatus = "RESOLVED_PLAYER_A" | "RESOLVED_PLAYER_B" | "RESOLVED_DRAW" | "RESOLVED_VOID";

/**
 * How long a disputed match's recordings are kept after the decision: long
 * enough for the 8-week complaints process and an IBAS referral.
 */
export const DISPUTED_RECORDING_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

const OPEN_STATUSES: DisputeStatus[] = [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW];

const OUTCOME_LABELS: Record<ResolutionStatus, string> = {
  RESOLVED_PLAYER_A: "Player A won",
  RESOLVED_PLAYER_B: "Player B won",
  RESOLVED_DRAW: "Draw — both stakes returned",
  RESOLVED_VOID: "Match voided — both stakes refunded",
};

export interface DisputeMoment {
  at: string;
  note: string;
}

type Reviewer = { id: string; role: UserRole; isAdmin: boolean };

async function reviewerFor(userId: string): Promise<Reviewer | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      refereeProfile: { select: { status: true, canReviewDisputes: true } },
    },
  });
  if (!user) return null;
  if (user.role === UserRole.ADMIN) return { id: user.id, role: user.role, isAdmin: true };
  const profile = user.refereeProfile;
  if (profile?.status === RefereeProfileStatus.APPROVED && profile.canReviewDisputes) {
    return { id: user.id, role: user.role, isAdmin: false };
  }
  return null;
}

const disputeForCheck = {
  id: true,
  status: true,
  reviewerId: true,
  betId: true,
  bet: {
    select: {
      playerAId: true,
      playerBId: true,
      refereeAssignment: { select: { refereeProfile: { select: { userId: true } } } },
    },
  },
} satisfies Prisma.DisputeSelect;

type DisputeForCheck = Prisma.DisputeGetPayload<{ select: typeof disputeForCheck }>;

/** Why this reviewer can't take this dispute, or null if they can. */
async function conflictReason(reviewer: Reviewer, dispute: DisputeForCheck): Promise<string | null> {
  const players = [dispute.bet.playerAId, dispute.bet.playerBId].filter((id): id is string => Boolean(id));
  if (players.includes(reviewer.id)) return "You played in this match.";
  if (dispute.bet.refereeAssignment?.refereeProfile?.userId === reviewer.id) {
    return "You refereed this match.";
  }
  for (const playerId of players) {
    if (await areSociallyLinked(reviewer.id, playerId)) {
      return "You follow, are followed by or have blocked one of the players.";
    }
  }
  return null;
}

async function loadDispute(disputeId: string): Promise<DisputeForCheck> {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId }, select: disputeForCheck });
  if (!dispute) throw new NotFoundError("Dispute not found");
  return dispute;
}

/** Throws unless this user may see and decide this dispute. */
async function assertCanReview(userId: string, dispute: DisputeForCheck): Promise<Reviewer> {
  const reviewer = await reviewerFor(userId);
  if (!reviewer) throw new AuthorizationError("You aren't approved to review disputes");
  const conflict = await conflictReason(reviewer, dispute);
  if (conflict) throw new AuthorizationError(`You can't review this dispute. ${conflict}`);
  if (!reviewer.isAdmin && dispute.reviewerId && dispute.reviewerId !== reviewer.id) {
    throw new AuthorizationError("Another reviewer has taken this dispute");
  }
  return reviewer;
}

/** Open disputes this user could review (refereed matches only, for referees). */
export async function listReviewableDisputes(userId: string) {
  const reviewer = await reviewerFor(userId);
  if (!reviewer) return [];
  const rows = await prisma.dispute.findMany({
    where: {
      status: { in: OPEN_STATUSES },
      OR: [{ reviewerId: null }, { reviewerId: userId }],
      ...(reviewer.isAdmin ? {} : { bet: { refereeAssignment: { isNot: null } } }),
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: {
      ...disputeForCheck,
      createdAt: true,
      reason: true,
      bet: {
        select: {
          ...disputeForCheck.bet.select,
          amount: true,
          game: { select: { name: true } },
          playerA: { select: { displayName: true } },
          playerB: { select: { displayName: true } },
        },
      },
    },
  });
  const out = [];
  for (const row of rows) {
    if (await conflictReason(reviewer, row)) continue;
    out.push({
      id: row.id,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      takenByMe: row.reviewerId === userId,
      gameName: row.bet.game.name,
      stakeAmount: Number(row.bet.amount),
      players: [row.bet.playerA.displayName, row.bet.playerB?.displayName ?? "—"],
      reason: row.reason,
    });
  }
  return out;
}

/** Take a dispute so only you decide it. Records that the conflict check ran. */
export async function claimDispute(userId: string, disputeId: string, context?: AuditContext) {
  const dispute = await loadDispute(disputeId);
  if (!OPEN_STATUSES.includes(dispute.status)) throw new ConflictError("This dispute has already been decided");
  const reviewer = await assertCanReview(userId, dispute);

  return withTransaction(async (tx) => {
    const claimed = await tx.dispute.updateMany({
      where: { id: disputeId, status: { in: OPEN_STATUSES }, OR: [{ reviewerId: null }, { reviewerId: userId }] },
      data: { reviewerId: userId, reviewClaimedAt: new Date(), status: DisputeStatus.UNDER_REVIEW },
    });
    if (claimed.count !== 1) throw new ConflictError("Another reviewer has just taken this dispute");

    const assignment = await tx.refereeAssignment.findUnique({ where: { betId: dispute.betId }, select: { id: true } });
    if (assignment) {
      await appendRefereeAudit(tx, {
        assignmentId: assignment.id,
        actorUserId: userId,
        action: "DISPUTE_REVIEW_CLAIMED",
        details: {
          disputeId,
          reviewerRole: reviewer.isAdmin ? "ADMIN" : "DISPUTE_REVIEWER",
          independenceCheck: "not a player or the match referee; no follow or block with either player",
        },
        context,
      });
    }
    return { id: disputeId, status: DisputeStatus.UNDER_REVIEW };
  });
}

/** Everything a reviewer needs: the match, the call, the timeline, chat, the player's moments, recordings. */
export async function getDisputeEvidence(userId: string, disputeId: string) {
  const reviewer = await assertCanReview(userId, await loadDispute(disputeId));
  const dispute = await prisma.dispute.findUniqueOrThrow({
    where: { id: disputeId },
    select: {
      id: true,
      status: true,
      reason: true,
      moments: true,
      resolution: true,
      resolvedAt: true,
      createdAt: true,
      reviewClaimedAt: true,
      reviewer: { select: { id: true, displayName: true } },
      filedBy: { select: { id: true, displayName: true } },
      messages: {
        select: { body: true, createdAt: true, author: { select: { displayName: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
      bet: {
        select: {
          id: true,
          amount: true,
          platformFeePercent: true,
          status: true,
          outcome: true,
          matchedAt: true,
          game: { select: { name: true } },
          playerA: { select: { id: true, displayName: true, kickAccount: { select: { channelSlug: true } } } },
          playerB: { select: { id: true, displayName: true, kickAccount: { select: { channelSlug: true } } } },
          refereeAssignment: {
            select: {
              status: true,
              decision: true,
              evidence: true,
              claimedAt: true,
              startedAt: true,
              decisionSubmittedAt: true,
              disputeDeadline: true,
              refereeProfile: {
                select: { user: { select: { id: true, displayName: true, kickAccount: { select: { channelSlug: true } } } } },
              },
              auditEvents: {
                select: { sequence: true, action: true, createdAt: true, actor: { select: { displayName: true } } },
                orderBy: { sequence: "asc" },
              },
            },
          },
          chatMessages: {
            where: { deletedAt: null },
            select: { body: true, createdAt: true, user: { select: { id: true, displayName: true } } },
            orderBy: { createdAt: "asc" },
            take: 500,
          },
          recordings: {
            where: { deletedAt: null },
            select: {
              id: true,
              role: true,
              channelSlug: true,
              status: true,
              startedAt: true,
              endedAt: true,
              durationSeconds: true,
              failureReason: true,
              sha256: true,
            },
            orderBy: { role: "asc" },
          },
        },
      },
    },
  });
  return { ...dispute, viewerIsAdmin: reviewer.isAdmin };
}

/**
 * Decide a dispute: uphold the referee's call, change the result, or void
 * the match and refund both stakes. Reviewers must have taken it first.
 */
export async function resolveDispute(input: {
  userId: string;
  disputeId: string;
  status: ResolutionStatus;
  resolution: string;
  context?: AuditContext;
  request?: Request;
}) {
  const check = await loadDispute(input.disputeId);
  if (!OPEN_STATUSES.includes(check.status)) throw new ConflictError("This dispute has already been decided");
  const reviewer = await assertCanReview(input.userId, check);
  if (!reviewer.isAdmin && check.reviewerId !== reviewer.id) {
    throw new AuthorizationError("Take the dispute before deciding it");
  }

  const result = await withTransaction(async (tx) => {
    const dispute = await tx.dispute.findUniqueOrThrow({
      where: { id: input.disputeId },
      include: { bet: { include: { refereeAssignment: true } } },
    });
    await tx.$queryRaw`SELECT id FROM bets WHERE id = ${dispute.betId}::uuid FOR UPDATE`;
    const now = new Date();
    const resolved = await tx.dispute.update({
      where: { id: dispute.id },
      data: {
        status: input.status,
        resolution: input.resolution,
        resolvedById: input.userId,
        resolvedAt: now,
        reviewerId: dispute.reviewerId ?? input.userId,
      },
    });

    const outcomeByStatus: Partial<Record<ResolutionStatus, BetOutcome>> = {
      RESOLVED_PLAYER_A: BetOutcome.PLAYER_A_WIN,
      RESOLVED_PLAYER_B: BetOutcome.PLAYER_B_WIN,
      RESOLVED_DRAW: BetOutcome.DRAW,
    };
    const outcome = outcomeByStatus[input.status];

    const refundBoth = async () => {
      await refundEscrow(tx, {
        betId: dispute.betId,
        playerId: dispute.bet.playerAId,
        amount: dispute.bet.amount,
        idempotencyKey: `dispute:${dispute.id}:refund:a`,
      });
      if (dispute.bet.playerBId) {
        await refundEscrow(tx, {
          betId: dispute.betId,
          playerId: dispute.bet.playerBId,
          amount: dispute.bet.amount,
          idempotencyKey: `dispute:${dispute.id}:refund:b`,
        });
      }
    };

    const assignment = dispute.bet.refereeAssignment;
    if (assignment) {
      if (input.status === "RESOLVED_VOID") {
        if (dispute.bet.status !== BetStatus.DISPUTED) {
          throw new ConflictError("Only an unsettled disputed match can be voided");
        }
        await refundBoth();
        await tx.bet.update({ where: { id: dispute.betId }, data: { status: BetStatus.VOIDED, cancelledAt: now } });
        await tx.refereeAssignment.update({
          where: { id: assignment.id },
          data: { status: RefereeAssignmentStatus.CANCELLED, cancelledAt: now, version: { increment: 1 } },
        });
      } else if (outcome) {
        await tx.bet.update({
          where: { id: dispute.betId },
          data: { status: BetStatus.RESULT_REPORTED, outcome, resultVerified: true, resultReportedAt: now },
        });
        // The referee's own call stays in `decision`, so overturn rates can be measured.
        const overturned = assignment.decision !== null && assignment.decision !== outcome;
        await tx.refereeAssignment.update({
          where: { id: assignment.id },
          data: {
            status: RefereeAssignmentStatus.DECISION_SUBMITTED,
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
        actorUserId: input.userId,
        action: "DISPUTE_RESOLVED",
        details: {
          disputeId: dispute.id,
          reviewerRole: reviewer.isAdmin ? "ADMIN" : "DISPUTE_REVIEWER",
          resolutionStatus: input.status,
          outcome: outcome ?? null,
          refereeDecision: assignment.decision ?? null,
          overturned: assignment.decision !== null && outcome !== undefined && assignment.decision !== outcome,
          resolution: input.resolution,
        },
        context: input.context,
      });
    } else if (dispute.bet.status === BetStatus.DISPUTED) {
      // No referee: the decision becomes the result.
      if (input.status === "RESOLVED_VOID") {
        await tx.bet.update({ where: { id: dispute.betId }, data: { status: BetStatus.VOIDED, cancelledAt: now } });
        await refundBoth();
      } else if (outcome) {
        await tx.bet.update({
          where: { id: dispute.betId },
          data: { status: BetStatus.RESULT_REPORTED, outcome, resultVerified: true, resultReportedAt: now },
        });
      }
    }

    // A recording of a disputed match is kept until any complaint is closed.
    await tx.matchRecording.updateMany({
      where: { betId: dispute.betId, deletedAt: null },
      data: { retainUntil: new Date(now.getTime() + DISPUTED_RECORDING_RETENTION_MS) },
    });

    await recordAdminAction(
      {
        actorId: input.userId,
        action: "dispute.resolve",
        targetType: "dispute",
        targetId: dispute.id,
        details: {
          betId: dispute.betId,
          reviewerRole: reviewer.isAdmin ? "ADMIN" : "DISPUTE_REVIEWER",
          betStatusBefore: dispute.bet.status,
          resolution: input.status,
          outcome: outcome ?? null,
          refereed: Boolean(assignment),
          note: input.resolution,
        },
        request: input.request,
      },
      tx,
    );
    return resolved;
  });

  await emailDisputeResolved(check.betId, OUTCOME_LABELS[input.status]);
  return result;
}

/** Grant or remove dispute-reviewer approval (admins only, via the admin route). */
export async function setDisputeReviewer(input: { adminId: string; refereeProfileId: string; allow: boolean; request?: Request }) {
  const profile = await prisma.refereeProfile.findUnique({
    where: { id: input.refereeProfileId },
    select: { id: true, status: true, userId: true },
  });
  if (!profile) throw new NotFoundError("Referee not found");
  if (input.allow && profile.status !== RefereeProfileStatus.APPROVED) {
    throw new ConflictError("Only an approved referee can review disputes");
  }
  return withTransaction(async (tx) => {
    const updated = await tx.refereeProfile.update({
      where: { id: profile.id },
      data: { canReviewDisputes: input.allow, disputeReviewerApprovedAt: input.allow ? new Date() : null },
      select: { id: true, canReviewDisputes: true, disputeReviewerApprovedAt: true },
    });
    await recordAdminAction(
      {
        actorId: input.adminId,
        action: input.allow ? "referee.dispute-reviewer.grant" : "referee.dispute-reviewer.revoke",
        targetType: "referee_profile",
        targetId: profile.id,
        details: { userId: profile.userId },
        request: input.request,
      },
      tx,
    );
    return updated;
  });
}
