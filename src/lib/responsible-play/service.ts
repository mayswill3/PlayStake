import { Decimal } from "@prisma/client/runtime/client";
import {
  BetOutcome,
  BetStatus,
  DepositLimitPeriod,
  LobbyStatus,
  PlayBreakType,
  StreamChallengeStatus,
  TransactionStatus,
  TransactionType,
} from "../../../generated/prisma/client";
import { prisma } from "../db/client";
import { ConflictError, ValidationError } from "../errors";
import { centsToDollars, dollarsToCents } from "../utils/money";
import {
  LIMIT_INCREASE_DELAY_MS,
  MAX_DEPOSIT_LIMIT_CENTS,
  PERIOD_WINDOW_MS,
  SESSION_REMINDER_INTERVALS,
  findBreakOption,
} from "./constants";

// ---------------------------------------------------------------------------
// Deposit limits
// ---------------------------------------------------------------------------

export interface ResolvedLimit {
  period: DepositLimitPeriod;
  amountCents: number;
  pendingAmountCents: number | null;
  pendingEffectiveAt: Date | null;
  /** The limit is due to be removed at pendingEffectiveAt. */
  pendingRemoval: boolean;
}

interface LimitRow {
  period: DepositLimitPeriod;
  amount: Decimal;
  pendingAmount: Decimal | null;
  pendingEffectiveAt: Date | null;
  pendingRemoval: boolean;
}

/**
 * Fold a stored row into the limit that applies right now.
 *
 * A pending increase whose effective time has passed counts as active even if
 * the worker has not folded it in yet. Evaluating this on read means the gate
 * never depends on a worker being alive — it can only ever be stricter than
 * the stored row, never looser.
 */
function resolveLimit(row: LimitRow, now: Date): ResolvedLimit | null {
  // A staged removal that has matured means there is no limit any more.
  if (row.pendingRemoval && row.pendingEffectiveAt !== null && row.pendingEffectiveAt <= now) {
    return null;
  }

  const matured =
    row.pendingAmount !== null &&
    row.pendingEffectiveAt !== null &&
    row.pendingEffectiveAt <= now;

  return {
    period: row.period,
    amountCents: dollarsToCents(matured ? row.pendingAmount! : row.amount),
    pendingAmountCents: matured ? null : row.pendingAmount
      ? dollarsToCents(row.pendingAmount)
      : null,
    pendingEffectiveAt: matured ? null : row.pendingEffectiveAt,
    pendingRemoval: row.pendingRemoval,
  };
}

export async function getDepositLimits(
  userId: string,
  now: Date = new Date(),
): Promise<ResolvedLimit[]> {
  const rows = await prisma.depositLimit.findMany({
    where: { userId },
    select: {
      period: true,
      amount: true,
      pendingAmount: true,
      pendingEffectiveAt: true,
      pendingRemoval: true,
    },
  });

  return rows
    .map((row) => resolveLimit(row, now))
    .filter((limit): limit is ResolvedLimit => limit !== null);
}

/**
 * Total deposited inside each limit's rolling window.
 *
 * Counts PENDING alongside COMPLETED: a PaymentIntent that has not settled yet
 * is still money on its way in, and ignoring it would let someone queue up
 * deposits past their own limit.
 */
export async function getDepositUsage(
  userId: string,
  now: Date = new Date(),
): Promise<Record<DepositLimitPeriod, number>> {
  const periods = Object.values(DepositLimitPeriod);
  const oldestWindowMs = Math.max(
    ...periods.map((period) => PERIOD_WINDOW_MS[period]),
  );

  const deposits = await prisma.transaction.findMany({
    where: {
      type: TransactionType.DEPOSIT,
      status: {
        in: [TransactionStatus.PENDING, TransactionStatus.COMPLETED],
      },
      metadata: { path: ["userId"], equals: userId },
      createdAt: { gte: new Date(now.getTime() - oldestWindowMs) },
    },
    select: { amount: true, createdAt: true },
  });

  const usage = {} as Record<DepositLimitPeriod, number>;
  for (const period of periods) {
    const windowStart = new Date(now.getTime() - PERIOD_WINDOW_MS[period]);
    usage[period] = deposits
      .filter((deposit) => deposit.createdAt >= windowStart)
      .reduce((total, deposit) => total + dollarsToCents(deposit.amount), 0);
  }
  return usage;
}

export interface SetDepositLimitResult {
  period: DepositLimitPeriod;
  effectiveNow: boolean;
  effectiveAt: Date | null;
}

/**
 * Set or change a deposit limit.
 *
 * Reductions (and first-time limits) take effect immediately; increases are
 * staged behind LIMIT_INCREASE_DELAY_MS.
 */
export async function setDepositLimit(
  userId: string,
  period: DepositLimitPeriod,
  amountCents: number,
  now: Date = new Date(),
): Promise<SetDepositLimitResult> {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new ValidationError("A deposit limit must be a positive amount");
  }
  if (amountCents > MAX_DEPOSIT_LIMIT_CENTS) {
    throw new ValidationError("That deposit limit is too high");
  }

  const existing = await prisma.depositLimit.findUnique({
    where: { userId_period: { userId, period } },
    select: {
      period: true,
      amount: true,
      pendingAmount: true,
      pendingEffectiveAt: true,
      pendingRemoval: true,
    },
  });

  const current = existing ? resolveLimit(existing, now) : null;
  if (!existing || !current) {
    // No limit in force (never set, or a removal has matured): this is a
    // fresh limit, which only tightens things, so it applies at once.
    if (existing) {
      await prisma.depositLimit.update({
        where: { userId_period: { userId, period } },
        data: {
          amount: centsToDollars(amountCents),
          pendingAmount: null,
          pendingEffectiveAt: null,
          pendingRemoval: false,
        },
      });
      return { period, effectiveNow: true, effectiveAt: null };
    }
    await prisma.depositLimit.create({
      data: { userId, period, amount: centsToDollars(amountCents) },
    });
    return { period, effectiveNow: true, effectiveAt: null };
  }

  if (amountCents <= current.amountCents) {
    // A reduction takes hold at once, and supersedes any staged increase or
    // removal.
    await prisma.depositLimit.update({
      where: { userId_period: { userId, period } },
      data: {
        amount: centsToDollars(amountCents),
        pendingAmount: null,
        pendingEffectiveAt: null,
        pendingRemoval: false,
      },
    });
    return { period, effectiveNow: true, effectiveAt: null };
  }

  const effectiveAt = new Date(now.getTime() + LIMIT_INCREASE_DELAY_MS);
  await prisma.depositLimit.update({
    where: { userId_period: { userId, period } },
    data: {
      // Keep the current (lower) limit in force until the delay elapses.
      amount: centsToDollars(current.amountCents),
      pendingAmount: centsToDollars(amountCents),
      pendingEffectiveAt: effectiveAt,
      pendingRemoval: false,
    },
  });
  return { period, effectiveNow: false, effectiveAt };
}

/**
 * Drop a staged increase or removal. Always allowed — it can only tighten
 * things.
 */
export async function cancelPendingIncrease(
  userId: string,
  period: DepositLimitPeriod,
): Promise<void> {
  await prisma.depositLimit.updateMany({
    where: { userId, period },
    data: { pendingAmount: null, pendingEffectiveAt: null, pendingRemoval: false },
  });
}

/**
 * Remove a limit entirely. Removing loosens things, so like an increase it
 * is staged: the current limit stays in force for LIMIT_INCREASE_DELAY_MS.
 */
export async function removeDepositLimit(
  userId: string,
  period: DepositLimitPeriod,
  now: Date = new Date(),
): Promise<{ effectiveAt: Date } | null> {
  const existing = await prisma.depositLimit.findUnique({
    where: { userId_period: { userId, period } },
    select: {
      period: true,
      amount: true,
      pendingAmount: true,
      pendingEffectiveAt: true,
      pendingRemoval: true,
    },
  });
  const current = existing ? resolveLimit(existing, now) : null;
  if (!current) return null;
  if (current.pendingRemoval && current.pendingEffectiveAt) {
    return { effectiveAt: current.pendingEffectiveAt };
  }

  const effectiveAt = new Date(now.getTime() + LIMIT_INCREASE_DELAY_MS);
  await prisma.depositLimit.update({
    where: { userId_period: { userId, period } },
    data: {
      amount: centsToDollars(current.amountCents),
      pendingAmount: null,
      pendingEffectiveAt: effectiveAt,
      pendingRemoval: true,
    },
  });
  return { effectiveAt };
}

// ---------------------------------------------------------------------------
// Cool-off and self-exclusion
// ---------------------------------------------------------------------------

export interface ActiveBreak {
  id: string;
  type: PlayBreakType;
  startsAt: Date;
  endsAt: Date;
  /**
   * A self-exclusion whose period has ended but which still applies: the
   * customer hasn't asked to return, or the cooling-off after asking hasn't
   * finished.
   */
  awaitingReturn: boolean;
  /** When a requested return takes effect (end of the cooling-off). */
  returnEffectiveAt: Date | null;
}

/** After asking to return from self-exclusion, access resumes this much later. */
export const SELF_EXCLUSION_RETURN_COOLING_OFF_MS = 24 * 60 * 60 * 1000;

const breakSelect = {
  id: true,
  type: true,
  startsAt: true,
  endsAt: true,
  returnEffectiveAt: true,
} as const;

/**
 * The break currently in force, if any.
 *
 * A self-exclusion keeps applying after `endsAt` until the customer returns:
 * they must ask to (a positive action), and access resumes after a 24-hour
 * cooling-off.
 */
export async function getActiveBreak(
  userId: string,
  now: Date = new Date(),
): Promise<ActiveBreak | null> {
  const found = await prisma.playBreak.findFirst({
    where: {
      userId,
      OR: [
        { endsAt: { gt: now } },
        {
          type: PlayBreakType.SELF_EXCLUSION,
          OR: [{ returnEffectiveAt: null }, { returnEffectiveAt: { gt: now } }],
        },
      ],
    },
    // The longest-running break wins if several overlap.
    orderBy: { endsAt: "desc" },
    select: breakSelect,
  });
  if (!found) return null;
  return { ...found, awaitingReturn: found.endsAt <= now };
}

/**
 * Ask to return once a self-exclusion period has ended. Access resumes after
 * SELF_EXCLUSION_RETURN_COOLING_OFF_MS.
 */
export async function requestReturnFromSelfExclusion(
  userId: string,
  now: Date = new Date(),
): Promise<{ returnEffectiveAt: Date }> {
  const active = await getActiveBreak(userId, now);
  if (!active || active.type !== PlayBreakType.SELF_EXCLUSION) {
    throw new ConflictError("You are not self-excluded.");
  }
  if (!active.awaitingReturn) {
    throw new ConflictError(
      "Your self-exclusion is still running. It cannot be shortened or lifted early.",
    );
  }
  if (active.returnEffectiveAt) {
    return { returnEffectiveAt: active.returnEffectiveAt };
  }

  const returnEffectiveAt = new Date(now.getTime() + SELF_EXCLUSION_RETURN_COOLING_OFF_MS);
  await prisma.playBreak.update({
    where: { id: active.id },
    data: { returnRequestedAt: now, returnEffectiveAt },
  });
  return { returnEffectiveAt };
}

/**
 * Begin a cool-off or self-exclusion.
 *
 * A break cannot be shortened or lifted once started, so an existing break may
 * only be replaced by one that ends later.
 */
export async function startBreak(
  userId: string,
  type: PlayBreakType,
  optionId: string,
  now: Date = new Date(),
): Promise<ActiveBreak> {
  const option = findBreakOption(type, optionId);
  if (!option) {
    throw new ValidationError("Unknown break length");
  }

  const endsAt = new Date(now.getTime() + option.durationMs);
  const active = await getActiveBreak(userId, now);

  if (active && active.endsAt >= endsAt) {
    throw new ConflictError(
      "You already have a longer break in place. It cannot be shortened or lifted early.",
    );
  }

  const created = await prisma.playBreak.create({
    data: { userId, type, startsAt: now, endsAt },
    select: breakSelect,
  });
  await withdrawOpenActivity(userId, now);
  return { ...created, awaitingReturn: false };
}

/**
 * Take a customer out of everything that could draw them into a match: their
 * waiting lobby entries, invites they've received, and challenges they've
 * sent or received. No money is held until a match is agreed, so nothing
 * needs refunding here; matches already agreed run to their normal end.
 */
export async function withdrawOpenActivity(userId: string, now: Date = new Date()): Promise<void> {
  const openStatuses = [LobbyStatus.WAITING, LobbyStatus.INVITED];
  await prisma.$transaction(async (tx) => {
    const challenges = await tx.streamChallenge.findMany({
      where: {
        status: StreamChallengeStatus.PENDING,
        OR: [{ challengerUserId: userId }, { streamerUserId: userId }],
      },
      select: { id: true, challengerLobbyEntryId: true, streamerLobbyEntryId: true },
    });
    if (challenges.length > 0) {
      await tx.streamChallenge.updateMany({
        where: { id: { in: challenges.map((challenge) => challenge.id) } },
        data: { status: StreamChallengeStatus.CANCELLED, respondedAt: now },
      });
      await tx.lobbyEntry.updateMany({
        where: {
          id: {
            in: challenges.flatMap((challenge) => [
              challenge.challengerLobbyEntryId,
              challenge.streamerLobbyEntryId,
            ]),
          },
          status: { in: openStatuses },
        },
        data: { status: LobbyStatus.CANCELLED },
      });
    }
    await tx.lobbyEntry.updateMany({
      where: { userId, status: { in: openStatuses } },
      data: { status: LobbyStatus.CANCELLED },
    });
    // Anyone this customer invited goes back to waiting in the lobby.
    await tx.lobbyEntry.updateMany({
      where: { invitedById: userId, status: LobbyStatus.INVITED },
      data: { status: LobbyStatus.WAITING, invitedById: null, inviteExpiresAt: null },
    });
  });
}

// ---------------------------------------------------------------------------
// Session reminders
// ---------------------------------------------------------------------------

export async function getSessionReminderMinutes(
  userId: string,
): Promise<number | null> {
  const settings = await prisma.responsiblePlaySettings.findUnique({
    where: { userId },
    select: { sessionReminderMinutes: true },
  });
  return settings?.sessionReminderMinutes ?? null;
}

export async function setSessionReminderMinutes(
  userId: string,
  minutes: number | null,
): Promise<void> {
  if (
    minutes !== null &&
    !SESSION_REMINDER_INTERVALS.includes(
      minutes as (typeof SESSION_REMINDER_INTERVALS)[number],
    )
  ) {
    throw new ValidationError("Unsupported reminder interval");
  }

  await prisma.responsiblePlaySettings.upsert({
    where: { userId },
    create: { userId, sessionReminderMinutes: minutes },
    update: { sessionReminderMinutes: minutes },
  });
}

// ---------------------------------------------------------------------------
// Aggregate view for the settings screen
// ---------------------------------------------------------------------------

export async function getResponsiblePlayState(
  userId: string,
  now: Date = new Date(),
) {
  const [limits, usage, activeBreak, sessionReminderMinutes] =
    await Promise.all([
      getDepositLimits(userId, now),
      getDepositUsage(userId, now),
      getActiveBreak(userId, now),
      getSessionReminderMinutes(userId),
    ]);

  return {
    limits: limits.map((limit) => ({
      ...limit,
      usedCents: usage[limit.period] ?? 0,
      remainingCents: Math.max(0, limit.amountCents - (usage[limit.period] ?? 0)),
    })),
    usage,
    activeBreak,
    sessionReminderMinutes,
  };
}

// ---------------------------------------------------------------------------
// Session activity (for in-session reminders)
// ---------------------------------------------------------------------------

export interface SessionActivity {
  betsPlaced: number;
  stakedCents: number;
  netCents: number;
}

/**
 * What the user has staked and won or lost since a point in time.
 *
 * A reminder that only says "you have been here 30 minutes" is easy to wave
 * away; showing the money alongside it is the part that prompts a decision.
 * Mirrors the settled-bet accounting in /api/dashboard/stats.
 */
export async function getSessionActivity(
  userId: string,
  since: Date,
): Promise<SessionActivity> {
  const bets = await prisma.bet.findMany({
    where: {
      OR: [{ playerAId: userId }, { playerBId: userId }],
      status: { notIn: [BetStatus.PENDING_CONSENT, BetStatus.CANCELLED] },
      createdAt: { gte: since },
    },
    select: {
      playerAId: true,
      amount: true,
      status: true,
      outcome: true,
      platformFeeAmount: true,
    },
  });

  let stakedCents = 0;
  let netCents = 0;

  for (const bet of bets) {
    const amountCents = dollarsToCents(bet.amount);
    const feeCents = bet.platformFeeAmount
      ? dollarsToCents(bet.platformFeeAmount)
      : 0;

    stakedCents += amountCents;

    if (bet.status !== BetStatus.SETTLED || !bet.outcome) continue;

    const isPlayerA = bet.playerAId === userId;
    if (bet.outcome === BetOutcome.DRAW) {
      netCents -= Math.round(feeCents / 2);
    } else if (
      (bet.outcome === BetOutcome.PLAYER_A_WIN && isPlayerA) ||
      (bet.outcome === BetOutcome.PLAYER_B_WIN && !isPlayerA)
    ) {
      netCents += amountCents - feeCents;
    } else {
      netCents -= amountCents;
    }
  }

  return { betsPlaced: bets.length, stakedCents, netCents };
}
