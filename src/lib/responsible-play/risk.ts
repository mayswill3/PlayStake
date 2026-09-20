// =============================================================================
// PlayStake — Loss-chasing detection
// =============================================================================
// Chasing losses is the most recognisable marker of gambling harm: stakes climb
// through a losing run, or money goes in again immediately after it went out.
// Neither is proof of anything on its own, which is why this raises a signal
// for a human to look at and never restricts an account by itself.
//
// Signals are written against the player (PlayerRiskSignal), not the developer.
// AnomalyAlert is fraud detection asking "is this game rigged"; putting welfare
// markers in the same queue would bury one inside the other.
// =============================================================================

import { prisma } from "../db/client";
import {
  BetOutcome,
  BetStatus,
  PlayerRiskType,
  TransactionStatus,
  TransactionType,
} from "../../../generated/prisma/client";
import { dollarsToCents } from "../utils/money";
import { emailAdminAlert } from "../email/events";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** How far back each scan looks. */
export const RISK_WINDOW_MS = 24 * HOUR;

/** Consecutive losses before escalating stakes mean anything. */
export const MIN_LOSS_STREAK = 3;

/** Stake multiple across a losing run that counts as escalation. */
export const STAKE_ESCALATION_MULTIPLE = 2;

/** A deposit this soon after losing reads as topping up to keep going. */
export const DEPOSIT_AFTER_LOSS_MS = 30 * MINUTE;

/** How many such deposits before it is a pattern rather than a coincidence. */
export const MIN_DEPOSITS_AFTER_LOSS = 3;

/**
 * Don't re-raise the same signal for the same player inside this window. The
 * scan runs every 15 minutes and the behaviour it looks at persists for 24
 * hours, so without this one bad evening would generate 96 identical alerts.
 */
export const SIGNAL_COOLDOWN_MS = 24 * HOUR;

interface SettledBet {
  id: string;
  playerAId: string;
  playerBId: string | null;
  amount: { toString(): string };
  outcome: BetOutcome | null;
  settledAt: Date | null;
}

/** Did this user lose this bet? A draw is not a loss. */
function userLost(bet: SettledBet, userId: string): boolean {
  if (bet.outcome === null || bet.outcome === BetOutcome.DRAW) return false;
  return bet.playerAId === userId
    ? bet.outcome === BetOutcome.PLAYER_B_WIN
    : bet.outcome === BetOutcome.PLAYER_A_WIN;
}

function severityForMultiple(multiple: number): string {
  if (multiple >= 4) return "high";
  if (multiple >= 3) return "medium";
  return "low";
}

/** True if this player already has an open signal of this type recently. */
async function recentlySignalled(
  userId: string,
  type: PlayerRiskType,
  now: Date,
): Promise<boolean> {
  const existing = await prisma.playerRiskSignal.findFirst({
    where: {
      userId,
      type,
      createdAt: { gte: new Date(now.getTime() - SIGNAL_COOLDOWN_MS) },
    },
    select: { id: true },
  });
  return existing !== null;
}

async function raise(input: {
  userId: string;
  type: PlayerRiskType;
  severity: string;
  details: Record<string, unknown>;
  windowStart: Date;
  windowEnd: Date;
}): Promise<string> {
  const signal = await prisma.playerRiskSignal.create({
    data: {
      userId: input.userId,
      type: input.type,
      severity: input.severity,
      details: input.details as never,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
    },
  });

  // A signal nobody sees is the same as no signal at all.
  await emailAdminAlert({
    key: `risk-${signal.id}`,
    title: `Responsible play: ${input.type.toLowerCase().replace(/_/g, " ")}`,
    detail:
      `Player ${input.userId} triggered a ${input.severity}-severity ` +
      `loss-chasing signal in the last 24 hours. This is a prompt to review, ` +
      `not an accusation and not an automatic restriction.`,
    url: null,
  });

  return signal.id;
}

/**
 * Stakes climbing through a run of consecutive losses.
 *
 * Looks at the longest losing run in the window and compares the last stake to
 * the first. Doubling across three or more losses is the classic shape.
 */
export async function detectStakeEscalation(
  userId: string,
  bets: SettledBet[],
  now: Date,
): Promise<string | null> {
  let bestStreak: number[] = [];
  let current: number[] = [];

  for (const bet of bets) {
    if (userLost(bet, userId)) {
      current.push(dollarsToCents(bet.amount as never));
      if (current.length > bestStreak.length) bestStreak = [...current];
    } else {
      current = [];
    }
  }

  if (bestStreak.length < MIN_LOSS_STREAK) return null;

  const first = bestStreak[0];
  const last = bestStreak[bestStreak.length - 1];
  if (first <= 0) return null;

  const multiple = last / first;
  if (multiple < STAKE_ESCALATION_MULTIPLE) return null;

  if (await recentlySignalled(userId, PlayerRiskType.LOSS_CHASING_STAKES, now)) {
    return null;
  }

  return raise({
    userId,
    type: PlayerRiskType.LOSS_CHASING_STAKES,
    severity: severityForMultiple(multiple),
    details: {
      consecutiveLosses: bestStreak.length,
      firstStakeCents: first,
      lastStakeCents: last,
      stakeMultiple: Number(multiple.toFixed(2)),
      totalLostCents: bestStreak.reduce((sum, stake) => sum + stake, 0),
    },
    windowStart: new Date(now.getTime() - RISK_WINDOW_MS),
    windowEnd: now,
  });
}

/**
 * Repeatedly depositing straight after a loss.
 *
 * Counts deposits that land within DEPOSIT_AFTER_LOSS_MS of a losing
 * settlement. One is ordinary; three in a day is a pattern.
 */
export async function detectDepositAfterLoss(
  userId: string,
  bets: SettledBet[],
  now: Date,
): Promise<string | null> {
  const lossTimes = bets
    .filter((bet) => userLost(bet, userId) && bet.settledAt)
    .map((bet) => (bet.settledAt as Date).getTime());

  if (lossTimes.length === 0) return null;

  const windowStart = new Date(now.getTime() - RISK_WINDOW_MS);
  const deposits = await prisma.transaction.findMany({
    where: {
      type: TransactionType.DEPOSIT,
      status: { in: [TransactionStatus.PENDING, TransactionStatus.COMPLETED] },
      metadata: { path: ["userId"], equals: userId },
      createdAt: { gte: windowStart },
    },
    select: { amount: true, createdAt: true },
  });

  const chasing = deposits.filter((deposit) =>
    lossTimes.some((lossAt) => {
      const gap = deposit.createdAt.getTime() - lossAt;
      return gap >= 0 && gap <= DEPOSIT_AFTER_LOSS_MS;
    }),
  );

  if (chasing.length < MIN_DEPOSITS_AFTER_LOSS) return null;

  if (await recentlySignalled(userId, PlayerRiskType.LOSS_CHASING_DEPOSITS, now)) {
    return null;
  }

  return raise({
    userId,
    type: PlayerRiskType.LOSS_CHASING_DEPOSITS,
    severity: chasing.length >= MIN_DEPOSITS_AFTER_LOSS * 2 ? "high" : "medium",
    details: {
      depositsAfterLoss: chasing.length,
      totalDepositedCents: chasing.reduce(
        (sum, deposit) => sum + dollarsToCents(deposit.amount),
        0,
      ),
      withinMinutes: DEPOSIT_AFTER_LOSS_MS / MINUTE,
      losses: lossTimes.length,
    },
    windowStart,
    windowEnd: now,
  });
}

/** Run both detectors for one player. Returns the ids of any signals raised. */
export async function detectLossChasingForUser(
  userId: string,
  now: Date = new Date(),
): Promise<string[]> {
  const bets = await prisma.bet.findMany({
    where: {
      status: BetStatus.SETTLED,
      settledAt: { gte: new Date(now.getTime() - RISK_WINDOW_MS) },
      OR: [{ playerAId: userId }, { playerBId: userId }],
    },
    select: {
      id: true,
      playerAId: true,
      playerBId: true,
      amount: true,
      outcome: true,
      settledAt: true,
    },
    orderBy: { settledAt: "asc" },
  });

  if (bets.length === 0) return [];

  const raised = await Promise.all([
    detectStakeEscalation(userId, bets, now),
    detectDepositAfterLoss(userId, bets, now),
  ]);

  return raised.filter((id): id is string => id !== null);
}

/**
 * Scan every player who settled a bet in the window.
 *
 * Players who haven't played recently cannot be chasing anything, so the
 * candidate set stays small however many accounts exist.
 */
export async function scanForLossChasing(
  now: Date = new Date(),
): Promise<{ scanned: number; raised: number }> {
  const since = new Date(now.getTime() - RISK_WINDOW_MS);
  const recent = await prisma.bet.findMany({
    where: { status: BetStatus.SETTLED, settledAt: { gte: since } },
    select: { playerAId: true, playerBId: true },
  });

  const userIds = new Set<string>();
  for (const bet of recent) {
    userIds.add(bet.playerAId);
    if (bet.playerBId) userIds.add(bet.playerBId);
  }

  let raised = 0;
  for (const userId of userIds) {
    const signals = await detectLossChasingForUser(userId, now);
    raised += signals.length;
  }

  return { scanned: userIds.size, raised };
}
