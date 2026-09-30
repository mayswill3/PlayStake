// =============================================================================
// PlayStake — AML transaction monitoring
// =============================================================================
// Peer-to-peer wagering has one laundering risk above all: two accounts can
// move money between themselves by one deliberately losing to the other
// ("chip dumping"). This scan looks for that and the other classic patterns,
// and opens an AmlCase for the MLRO; it never decides anything by itself.
//
//   CHIP_DUMPING              the same pair, mostly one way, repeatedly
//   SHARED_IP                 accounts that played each other from one IP,
//                             or many accounts on one IP
//   DEPOSIT_WITHDRAW_NO_PLAY  money in and out with little play between
//   HIGH_DEPOSIT_VOLUME       deposits over the EDD threshold: source of funds
//
// Withdrawals are also assessed in real time (assessWithdrawal): an open case,
// a large amount, or deposit-and-withdraw-without-play holds the withdrawal
// for review.
//
// Thresholds are env-configurable; defaults are deliberately conservative
// and should be set in the AML risk assessment.
// =============================================================================

import {
  AmlCaseStatus,
  AmlCaseType,
  BetOutcome,
  BetStatus,
  TransactionStatus,
  TransactionType,
} from "../../../generated/prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors";
import { dollarsToCents } from "../utils/money";
import { OPEN_AML_STATUSES, raiseAmlCase } from "./aml";

const DAY = 24 * 60 * 60 * 1000;

function envCents(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const amlThresholds = () => ({
  /** 30-day deposits at which source of funds is required (EDD). */
  eddDepositCents: envCents("AML_EDD_THRESHOLD_CENTS", 500_000),
  /** A single withdrawal this large is held for review. */
  largeWithdrawalCents: envCents("AML_WITHDRAWAL_REVIEW_THRESHOLD_CENTS", 200_000),
  /** Minimum value moved between a pair before a one-way pattern matters. */
  chipDumpValueCents: envCents("AML_CHIP_DUMP_VALUE_CENTS", 10_000),
  /** Deposits below this aren't worth a deposit-withdraw-no-play case. */
  noPlayMinDepositCents: envCents("AML_NO_PLAY_MIN_DEPOSIT_CENTS", 5_000),
});

/** Games between the same pair in 7 days before a one-way pattern counts. */
const CHIP_DUMP_MIN_GAMES = 5;
/** Share of decided games one side must win. */
const CHIP_DUMP_WIN_SHARE = 0.8;
/** Staked less than this share of deposits before withdrawing = little play. */
const NO_PLAY_STAKE_RATIO = 0.25;
/** Withdrawing at least this share of recent deposits. */
const NO_PLAY_WITHDRAW_RATIO = 0.5;
/** This many accounts on one IP in 30 days is worth a look on its own. */
const SHARED_IP_ACCOUNTS = 4;

async function sumUserTransactions(
  userId: string,
  type: TransactionType,
  since: Date,
  statuses: TransactionStatus[] = [TransactionStatus.COMPLETED],
): Promise<number> {
  const rows = await prisma.transaction.findMany({
    where: {
      type,
      status: { in: statuses },
      metadata: { path: ["userId"], equals: userId },
      createdAt: { gte: since },
    },
    select: { amount: true },
  });
  return rows.reduce((sum, row) => sum + dollarsToCents(row.amount), 0);
}

async function stakedSince(userId: string, since: Date): Promise<number> {
  const bets = await prisma.bet.findMany({
    where: {
      matchedAt: { gte: since },
      status: { notIn: [BetStatus.CANCELLED, BetStatus.VOIDED] },
      OR: [{ playerAId: userId }, { playerBId: userId }],
    },
    select: { amount: true },
  });
  return bets.reduce((sum, bet) => sum + dollarsToCents(bet.amount), 0);
}

// ---------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------

/** Repeated, one-sided results between the same two accounts. */
export async function detectChipDumping(now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - 7 * DAY);
  const bets = await prisma.bet.findMany({
    where: { status: BetStatus.SETTLED, settledAt: { gte: since }, playerBId: { not: null } },
    select: { playerAId: true, playerBId: true, outcome: true, amount: true },
  });

  const pairs = new Map<string, { a: string; b: string; games: number; aWins: number; bWins: number; aValue: number; bValue: number }>();
  for (const bet of bets) {
    const [a, b] = [bet.playerAId, bet.playerBId!].sort();
    const key = `${a}|${b}`;
    const pair = pairs.get(key) ?? { a, b, games: 0, aWins: 0, bWins: 0, aValue: 0, bValue: 0 };
    pair.games += 1;
    const cents = dollarsToCents(bet.amount);
    const winner =
      bet.outcome === BetOutcome.PLAYER_A_WIN
        ? bet.playerAId
        : bet.outcome === BetOutcome.PLAYER_B_WIN
          ? bet.playerBId
          : null;
    if (winner === a) {
      pair.aWins += 1;
      pair.aValue += cents;
    } else if (winner === b) {
      pair.bWins += 1;
      pair.bValue += cents;
    }
    pairs.set(key, pair);
  }

  let raised = 0;
  const { chipDumpValueCents } = amlThresholds();
  for (const pair of pairs.values()) {
    const decided = pair.aWins + pair.bWins;
    if (pair.games < CHIP_DUMP_MIN_GAMES || decided === 0) continue;
    const [receiver, sender, wins, value] =
      pair.aWins >= pair.bWins
        ? [pair.a, pair.b, pair.aWins, pair.aValue - pair.bValue]
        : [pair.b, pair.a, pair.bWins, pair.bValue - pair.aValue];
    if (wins / decided < CHIP_DUMP_WIN_SHARE || value < chipDumpValueCents) continue;

    const id = await raiseAmlCase({
      userId: receiver,
      relatedUserId: sender,
      type: AmlCaseType.CHIP_DUMPING,
      severity: pair.games >= CHIP_DUMP_MIN_GAMES * 2 || value >= chipDumpValueCents * 5 ? "high" : "medium",
      details: {
        windowDays: 7,
        games: pair.games,
        receiverWins: wins,
        decidedGames: decided,
        netValueToReceiverCents: value,
      },
    });
    if (id) raised += 1;
  }
  return raised;
}

/** Accounts on the same IP — worst when they have also played each other. */
export async function detectSharedIp(now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - 30 * DAY);
  const sessions = await prisma.session.findMany({
    where: { createdAt: { gte: since }, ipAddress: { not: null } },
    select: { userId: true, ipAddress: true },
  });
  const usersByIp = new Map<string, Set<string>>();
  for (const session of sessions) {
    const users = usersByIp.get(session.ipAddress!) ?? new Set<string>();
    users.add(session.userId);
    usersByIp.set(session.ipAddress!, users);
  }

  let raised = 0;
  for (const [ip, userSet] of usersByIp) {
    if (userSet.size < 2) continue;
    const users = [...userSet];

    // Pairs on one IP that have also wagered against each other.
    const played = await prisma.bet.findMany({
      where: {
        playerAId: { in: users },
        playerBId: { in: users },
        status: { notIn: [BetStatus.CANCELLED] },
        createdAt: { gte: since },
      },
      select: { playerAId: true, playerBId: true },
    });
    const seen = new Set<string>();
    for (const bet of played) {
      const [a, b] = [bet.playerAId, bet.playerBId!].sort();
      if (seen.has(`${a}|${b}`)) continue;
      seen.add(`${a}|${b}`);
      const id = await raiseAmlCase({
        userId: a,
        relatedUserId: b,
        type: AmlCaseType.SHARED_IP,
        severity: "high",
        details: { ipAddress: ip, playedEachOther: true },
      });
      if (id) raised += 1;
    }

    if (users.length >= SHARED_IP_ACCOUNTS) {
      for (const userId of users) {
        const id = await raiseAmlCase({
          userId,
          type: AmlCaseType.SHARED_IP,
          severity: "low",
          details: { ipAddress: ip, accountsOnIp: users.length },
        });
        if (id) raised += 1;
      }
    }
  }
  return raised;
}

/** Deposits over the EDD threshold in 30 days: source of funds needed. */
export async function detectHighDepositVolume(now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - 30 * DAY);
  const deposits = await prisma.transaction.findMany({
    where: { type: TransactionType.DEPOSIT, status: TransactionStatus.COMPLETED, createdAt: { gte: since } },
    select: { amount: true, metadata: true },
  });
  const totals = new Map<string, number>();
  for (const deposit of deposits) {
    const userId = (deposit.metadata as { userId?: unknown } | null)?.userId;
    if (typeof userId !== "string") continue;
    totals.set(userId, (totals.get(userId) ?? 0) + dollarsToCents(deposit.amount));
  }

  let raised = 0;
  const { eddDepositCents } = amlThresholds();
  for (const [userId, total] of totals) {
    if (total < eddDepositCents) continue;
    const id = await raiseAmlCase({
      userId,
      type: AmlCaseType.HIGH_DEPOSIT_VOLUME,
      severity: total >= eddDepositCents * 2 ? "high" : "medium",
      details: {
        depositedCents30d: total,
        thresholdCents: eddDepositCents,
        action: "Obtain and verify source of funds before further deposits are accepted.",
      },
    });
    if (id) raised += 1;
  }
  return raised;
}

interface NoPlayPicture {
  depositedCents7d: number;
  stakedCents7d: number;
  withdrawnCents24h: number;
}

async function noPlayPicture(userId: string, now: Date): Promise<NoPlayPicture> {
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const [depositedCents7d, stakedCents7d, withdrawnCents24h] = await Promise.all([
    sumUserTransactions(userId, TransactionType.DEPOSIT, weekAgo),
    stakedSince(userId, weekAgo),
    sumUserTransactions(userId, TransactionType.WITHDRAWAL, new Date(now.getTime() - DAY), [
      TransactionStatus.PENDING,
      TransactionStatus.COMPLETED,
    ]),
  ]);
  return { depositedCents7d, stakedCents7d, withdrawnCents24h };
}

function isNoPlay(picture: NoPlayPicture, extraWithdrawalCents = 0): boolean {
  const { noPlayMinDepositCents } = amlThresholds();
  return (
    picture.depositedCents7d >= noPlayMinDepositCents &&
    picture.withdrawnCents24h + extraWithdrawalCents >= picture.depositedCents7d * NO_PLAY_WITHDRAW_RATIO &&
    picture.stakedCents7d < picture.depositedCents7d * NO_PLAY_STAKE_RATIO
  );
}

/** Recent withdrawers who barely played with what they deposited. */
export async function detectDepositWithdrawNoPlay(now: Date = new Date()): Promise<number> {
  const withdrawals = await prisma.transaction.findMany({
    where: { type: TransactionType.WITHDRAWAL, createdAt: { gte: new Date(now.getTime() - DAY) } },
    select: { metadata: true },
  });
  const userIds = new Set<string>();
  for (const withdrawal of withdrawals) {
    const userId = (withdrawal.metadata as { userId?: unknown } | null)?.userId;
    if (typeof userId === "string") userIds.add(userId);
  }

  let raised = 0;
  for (const userId of userIds) {
    const picture = await noPlayPicture(userId, now);
    if (!isNoPlay(picture)) continue;
    const id = await raiseAmlCase({
      userId,
      type: AmlCaseType.DEPOSIT_WITHDRAW_NO_PLAY,
      severity: "medium",
      details: { ...picture },
    });
    if (id) raised += 1;
  }
  return raised;
}

/** Run every AML detector. Returns how many new cases were opened. */
export async function runAmlScan(now: Date = new Date()) {
  const [chipDumping, sharedIp, highDeposits, noPlay] = [
    await detectChipDumping(now),
    await detectSharedIp(now),
    await detectHighDepositVolume(now),
    await detectDepositWithdrawNoPlay(now),
  ];
  return { chipDumping, sharedIp, highDeposits, noPlay };
}

// ---------------------------------------------------------------------------
// Withdrawal checks
// ---------------------------------------------------------------------------

export class WithdrawalUnderReviewError extends AppError {
  constructor() {
    super(
      "Your withdrawal needs a quick review before we can send it. Our team has been notified and will be in touch if we need anything from you; your balance is safe.",
      409,
      "WITHDRAWAL_UNDER_REVIEW",
    );
    this.name = "WithdrawalUnderReviewError";
  }
}

/** A case of this kind closed recently with no action: the review cleared it. */
async function recentlyCleared(userId: string, type: AmlCaseType, now: Date): Promise<boolean> {
  const cleared = await prisma.amlCase.findFirst({
    where: {
      userId,
      type,
      status: AmlCaseStatus.CLOSED_NO_ACTION,
      closedAt: { gte: new Date(now.getTime() - 7 * DAY) },
    },
    select: { id: true },
  });
  return cleared !== null;
}

/**
 * Hold a withdrawal for review when an AML case is open on the account, the
 * amount is large, or it follows a deposit with little play. Raises the case
 * that the review happens in. A review that clears the customer lets the
 * same kind of withdrawal through for 7 days.
 */
export async function assessWithdrawal(
  userId: string,
  amountCents: number,
  now: Date = new Date(),
): Promise<void> {
  // Low-severity cases (e.g. a household sharing an IP) don't hold money.
  const openCase = await prisma.amlCase.findFirst({
    where: { userId, status: { in: OPEN_AML_STATUSES }, severity: { in: ["medium", "high"] } },
    select: { id: true },
  });
  if (openCase) throw new WithdrawalUnderReviewError();

  const { largeWithdrawalCents } = amlThresholds();
  if (amountCents >= largeWithdrawalCents && !(await recentlyCleared(userId, AmlCaseType.MANUAL, now))) {
    await raiseAmlCase({
      userId,
      type: AmlCaseType.MANUAL,
      severity: "medium",
      details: { kind: "large_withdrawal", amountCents, thresholdCents: largeWithdrawalCents },
    });
    throw new WithdrawalUnderReviewError();
  }

  const picture = await noPlayPicture(userId, now);
  if (
    isNoPlay(picture, amountCents) &&
    !(await recentlyCleared(userId, AmlCaseType.DEPOSIT_WITHDRAW_NO_PLAY, now))
  ) {
    await raiseAmlCase({
      userId,
      type: AmlCaseType.DEPOSIT_WITHDRAW_NO_PLAY,
      severity: "medium",
      details: { ...picture, requestedWithdrawalCents: amountCents },
    });
    throw new WithdrawalUnderReviewError();
  }
}
