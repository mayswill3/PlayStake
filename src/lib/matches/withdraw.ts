// =============================================================================
// PlayStake — Pulling out of a match before it starts
// =============================================================================
// Either player may pull out of an agreed match until the referee presses
// Start: nobody has played, so the match is voided and both stakes are
// refunded in full, with no fee (the referee earns nothing). After Start the
// match is under way and leaving is abandoning it: the disconnect rules apply
// and only the referee (or the 2-hour limit) can end it.
//
// Every pull-out is written to the match's referee audit trail (with the
// player and the stage). Pulling out of 3 or more matches in 24 hours alerts
// staff (dodging opponents, or probing for an edge) and pauses that player's
// new challenges for 30 minutes after the latest one.
// =============================================================================

import { BetStatus, RefereeAssignmentStatus } from "../../../generated/prisma/client";
import { prisma, withTransaction } from "../db/client";
import { AppError, AuthorizationError, ConflictError, NotFoundError } from "../errors";
import { voidNoShowMatch } from "../lobby/match-lifecycle";
import { appendRefereeAudit, type AuditContext } from "../referees/audit";
import { emailAdminAlert, emailBetVoided } from "../email/events";

/** Stages at which a player may still pull out: before the referee presses Start. */
const BEFORE_START: RefereeAssignmentStatus[] = [
  RefereeAssignmentStatus.OPEN,
  RefereeAssignmentStatus.ASSIGNED,
  RefereeAssignmentStatus.READY,
];

export const WITHDRAWAL_FLAG_COUNT = 3;
export const WITHDRAWAL_WINDOW_MS = 24 * 60 * 60 * 1000;
export const WITHDRAWAL_COOLDOWN_MS = 30 * 60 * 1000;

export class WithdrawalCooldownError extends AppError {
  constructor(minutesLeft: number) {
    super(
      `You've pulled out of ${WITHDRAWAL_FLAG_COUNT} or more matches today. You can start or accept a new match in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
      429,
      "WITHDRAWAL_COOLDOWN",
    );
    this.name = "WithdrawalCooldownError";
  }
}

/** Pull-outs by this player in the last 24 hours, newest first. */
async function recentWithdrawals(userId: string, now: Date) {
  return prisma.refereeAuditEvent.findMany({
    where: { actorUserId: userId, action: "PLAYER_WITHDREW", createdAt: { gte: new Date(now.getTime() - WITHDRAWAL_WINDOW_MS) } },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Applied wherever a stake can be committed (see assertCanWager). */
export async function assertNotInWithdrawalCooldown(userId: string, now: Date = new Date()): Promise<void> {
  const recent = await recentWithdrawals(userId, now);
  if (recent.length < WITHDRAWAL_FLAG_COUNT) return;
  const left = recent[0].createdAt.getTime() + WITHDRAWAL_COOLDOWN_MS - now.getTime();
  if (left > 0) throw new WithdrawalCooldownError(Math.ceil(left / 60_000));
}

/** Can this player pull out of this match right now? (For the match page.) */
export function canWithdraw(bet: { status: BetStatus; refereeAssignment: { status: RefereeAssignmentStatus } | null }): boolean {
  return bet.status === BetStatus.MATCHED && (!bet.refereeAssignment || BEFORE_START.includes(bet.refereeAssignment.status));
}

export async function withdrawFromMatch(input: { userId: string; betId: string; context?: AuditContext; now?: Date }) {
  const now = input.now ?? new Date();
  const result = await withTransaction(async (tx) => {
    // Lock the bet so a withdrawal can't race the referee pressing Start.
    const rows: Array<{ status: BetStatus }> = await tx.$queryRaw`
      SELECT status FROM bets WHERE id = ${input.betId}::uuid FOR UPDATE
    `;
    if (!rows[0]) throw new NotFoundError("Match not found");
    // And the assignment: the referee's Start locks it, so whichever comes
    // first wins and the other sees the new status.
    await tx.$queryRaw`SELECT id FROM referee_assignments WHERE bet_id = ${input.betId}::uuid FOR UPDATE`;
    const bet = await tx.bet.findUniqueOrThrow({
      where: { id: input.betId },
      select: {
        id: true,
        status: true,
        playerAId: true,
        playerBId: true,
        refereeAssignment: { select: { id: true, status: true } },
        playerA: { select: { displayName: true } },
        playerB: { select: { displayName: true } },
      },
    });
    if (input.userId !== bet.playerAId && input.userId !== bet.playerBId) {
      throw new AuthorizationError("Only a player in this match can pull out of it");
    }
    if (bet.status !== BetStatus.MATCHED) throw new ConflictError("This match can no longer be pulled out of");
    if (bet.refereeAssignment && !BEFORE_START.includes(bet.refereeAssignment.status)) {
      throw new ConflictError(
        "The referee has started the match, so you can't pull out now. If you have a problem, tell the referee on your stream.",
      );
    }
    const stage = bet.refereeAssignment?.status ?? "NO_REFEREE";

    // Record who pulled out before the assignment is cancelled.
    if (bet.refereeAssignment) {
      await appendRefereeAudit(tx, {
        assignmentId: bet.refereeAssignment.id,
        actorUserId: input.userId,
        action: "PLAYER_WITHDREW",
        details: { stage, betId: bet.id },
        context: input.context,
      });
    }
    const voided = await voidNoShowMatch(tx, bet.id);
    const name = input.userId === bet.playerAId ? bet.playerA.displayName : bet.playerB?.displayName ?? "A player";
    return { voided, stage, name };
  });

  await emailBetVoided(
    input.betId,
    `${result.name} pulled out before the match started. Both stakes have been refunded in full and no fee was taken.`,
  ).catch((error) => console.error("[withdraw] email failed", error));

  const recent = await recentWithdrawals(input.userId, now);
  if (recent.length >= WITHDRAWAL_FLAG_COUNT) {
    await emailAdminAlert({
      key: `withdrawals-${input.userId}-${now.toISOString().slice(0, 13)}`,
      title: "Repeated pull-outs before matches",
      detail: `Player ${input.userId} has pulled out of ${recent.length} matches in the last 24 hours (latest: match ${input.betId}). New challenges are paused for 30 minutes. Review for opponent-dodging or match manipulation.`,
    }).catch(() => undefined);
  }
  return { betId: input.betId, stage: result.stage, refunded: result.voided.refunded, withdrawalsLast24h: recent.length };
}
