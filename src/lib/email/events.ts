// =============================================================================
// PlayStake — Domain events -> emails
// =============================================================================
// One helper per notifiable event. Each looks up whatever the template needs
// (names, balances) and writes an outbox row. Trigger sites stay one line.
//
// Amounts are formatted here so every email reads the same way.
// =============================================================================

import { Decimal } from "@prisma/client/runtime/client";
import { LedgerAccountType } from "../../../generated/prisma/client";
import { prisma } from "@/lib/db/client";
import type { TxClient } from "@/lib/db/client";
import { dollarsToCents } from "@/lib/utils/money";
import { formatCents } from "@/lib/utils/format";
import { queueEmail, queueEmailSafely } from "./outbox";

type Money = Decimal | string | number;

function money(amount: Money): string {
  return formatCents(dollarsToCents(amount));
}

function when(date: Date): string {
  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }) + " UTC";
}

/** A player's spendable balance, in dollars. */
async function balanceOf(userId: string, client: TxClient = prisma as TxClient): Promise<string> {
  const account = await client.ledgerAccount.findUnique({
    where: { userId_accountType: { userId, accountType: LedgerAccountType.PLAYER_BALANCE } },
    select: { balance: true },
  });
  return money(account?.balance ?? 0);
}

async function nameOf(userId: string, client: TxClient = prisma as TxClient): Promise<string> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { displayName: true },
  });
  return user?.displayName ?? "there";
}

// ---------------------------------------------------------------------------
// Account & security
// ---------------------------------------------------------------------------

export async function emailPasswordChanged(userId: string): Promise<void> {
  const now = new Date();
  await queueEmailSafely({
    template: "auth.password-changed",
    // Second-resolution key: a repeat change later still sends.
    dedupeKey: `password-changed-${userId}-${Math.floor(now.getTime() / 1000)}`,
    userId,
    payload: { name: await nameOf(userId), changedAt: when(now) },
  });
}

export async function emailTwoFactorChanged(userId: string, enabled: boolean): Promise<void> {
  await queueEmailSafely({
    template: "auth.two-factor-changed",
    dedupeKey: `2fa-${enabled ? "on" : "off"}-${userId}-${Math.floor(Date.now() / 1000)}`,
    userId,
    payload: { name: await nameOf(userId), enabled },
  });
}

export async function emailKycSubmitted(userId: string, submissionId: string): Promise<void> {
  await queueEmailSafely({
    template: "kyc.submitted",
    dedupeKey: `kyc-submitted-${submissionId}`,
    userId,
    payload: { name: await nameOf(userId) },
  });
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export async function emailDepositSucceeded(input: {
  userId: string;
  transactionId: string;
  amount: Money;
}): Promise<void> {
  await queueEmailSafely({
    template: "wallet.deposit-succeeded",
    dedupeKey: `deposit-ok-${input.transactionId}`,
    userId: input.userId,
    payload: {
      name: await nameOf(input.userId),
      amount: money(input.amount),
      balance: await balanceOf(input.userId),
    },
  });
}

export async function emailDepositFailed(input: {
  userId: string;
  transactionId: string;
  amount: Money;
  reason: string;
}): Promise<void> {
  await queueEmailSafely({
    template: "wallet.deposit-failed",
    dedupeKey: `deposit-fail-${input.transactionId}`,
    userId: input.userId,
    payload: {
      name: await nameOf(input.userId),
      amount: money(input.amount),
      reason: input.reason,
    },
  });
}

export async function emailWithdrawalRequested(input: {
  userId: string;
  transactionId: string;
  amount: Money;
}): Promise<void> {
  await queueEmailSafely({
    template: "wallet.withdrawal-requested",
    dedupeKey: `withdrawal-req-${input.transactionId}`,
    userId: input.userId,
    payload: {
      name: await nameOf(input.userId),
      amount: money(input.amount),
      balance: await balanceOf(input.userId),
    },
  });
}

export async function emailWithdrawalPaid(input: {
  userId: string;
  transactionId: string;
  amount: Money;
}): Promise<void> {
  await queueEmailSafely({
    template: "wallet.withdrawal-paid",
    dedupeKey: `withdrawal-paid-${input.transactionId}`,
    userId: input.userId,
    payload: { name: await nameOf(input.userId), amount: money(input.amount) },
  });
}

export async function emailWithdrawalFailed(input: {
  userId: string;
  transactionId: string;
  amount: Money;
  reason: string;
}): Promise<void> {
  await queueEmailSafely({
    template: "wallet.withdrawal-failed",
    dedupeKey: `withdrawal-fail-${input.transactionId}`,
    userId: input.userId,
    payload: {
      name: await nameOf(input.userId),
      amount: money(input.amount),
      reason: input.reason,
    },
  });
}

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

/** Both players get a result email after a bet settles. */
export async function emailBetSettled(betId: string): Promise<void> {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    select: {
      id: true,
      amount: true,
      outcome: true,
      playerAId: true,
      playerBId: true,
      game: { select: { name: true } },
      playerA: { select: { id: true, displayName: true } },
      playerB: { select: { id: true, displayName: true } },
      platformFeeAmount: true,
    },
  });
  if (!bet || !bet.playerB) return;

  const stake = new Decimal(bet.amount);
  const fee = new Decimal(bet.platformFeeAmount ?? 0);
  // The winner receives the pot less the platform fee; a draw returns stakes.
  const winnings = stake.mul(2).sub(fee).sub(stake);

  for (const side of ["A", "B"] as const) {
    const me = side === "A" ? bet.playerA : bet.playerB;
    const them = side === "A" ? bet.playerB : bet.playerA;
    const won =
      (side === "A" && bet.outcome === "PLAYER_A_WIN") ||
      (side === "B" && bet.outcome === "PLAYER_B_WIN");
    const draw = bet.outcome === "DRAW";

    await queueEmailSafely({
      template: "bet.settled",
      dedupeKey: `bet-settled-${bet.id}-${me.id}`,
      userId: me.id,
      payload: {
        name: me.displayName,
        gameName: bet.game.name,
        opponent: them.displayName,
        outcome: won ? "won" : draw ? "draw" : "lost",
        stake: money(stake),
        netResult: won
          ? `+${money(winnings)}`
          : draw
            ? money(stake)
            : `-${money(stake)}`,
        balance: await balanceOf(me.id),
        betId: bet.id,
      },
    });
  }
}

/** Both players get told when a match is voided and their stake refunded. */
export async function emailBetVoided(betId: string, reason: string): Promise<void> {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    select: {
      id: true,
      amount: true,
      game: { select: { name: true } },
      playerA: { select: { id: true, displayName: true } },
      playerB: { select: { id: true, displayName: true } },
    },
  });
  if (!bet) return;

  for (const player of [bet.playerA, bet.playerB]) {
    if (!player) continue;
    await queueEmailSafely({
      template: "bet.voided",
      dedupeKey: `bet-voided-${bet.id}-${player.id}`,
      userId: player.id,
      payload: {
        name: player.displayName,
        gameName: bet.game.name,
        stake: money(bet.amount),
        reason,
        betId: bet.id,
      },
    });
  }
}

export async function emailDisputeFiled(betId: string, filedByUserId: string): Promise<void> {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    select: {
      id: true,
      game: { select: { name: true } },
      playerA: { select: { id: true, displayName: true } },
      playerB: { select: { id: true, displayName: true } },
    },
  });
  if (!bet) return;

  for (const player of [bet.playerA, bet.playerB]) {
    if (!player) continue;
    await queueEmailSafely({
      template: "bet.dispute-filed",
      dedupeKey: `dispute-filed-${bet.id}-${player.id}`,
      userId: player.id,
      payload: {
        name: player.displayName,
        gameName: bet.game.name,
        betId: bet.id,
        byOpponent: player.id !== filedByUserId,
      },
    });
  }
}

export async function emailDisputeResolved(betId: string, outcome: string): Promise<void> {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    select: {
      id: true,
      game: { select: { name: true } },
      playerA: { select: { id: true, displayName: true } },
      playerB: { select: { id: true, displayName: true } },
    },
  });
  if (!bet) return;

  for (const player of [bet.playerA, bet.playerB]) {
    if (!player) continue;
    await queueEmailSafely({
      template: "bet.dispute-resolved",
      dedupeKey: `dispute-resolved-${bet.id}-${player.id}`,
      userId: player.id,
      payload: {
        name: player.displayName,
        gameName: bet.game.name,
        outcome,
        betId: bet.id,
      },
    });
  }
}

/** Players get the referee's call plus the deadline to dispute it. */
export async function emailRefereeDecision(input: {
  betId: string;
  decision: string;
  disputeDeadline: Date;
}): Promise<void> {
  const bet = await prisma.bet.findUnique({
    where: { id: input.betId },
    select: {
      id: true,
      game: { select: { name: true } },
      playerA: { select: { id: true, displayName: true } },
      playerB: { select: { id: true, displayName: true } },
    },
  });
  if (!bet) return;

  const decisionText = (player: string, opponent: string) =>
    input.decision === "DRAW"
      ? "Draw"
      : input.decision === "PLAYER_A_WIN"
        ? `${bet.playerA.displayName} won`
        : `${bet.playerB?.displayName ?? opponent} won`;

  for (const player of [bet.playerA, bet.playerB]) {
    if (!player) continue;
    await queueEmailSafely({
      template: "bet.referee-decision",
      dedupeKey: `referee-decision-${bet.id}-${player.id}`,
      userId: player.id,
      payload: {
        name: player.displayName,
        gameName: bet.game.name,
        decision: decisionText(player.displayName, player.displayName),
        disputeDeadline: when(input.disputeDeadline),
        betId: bet.id,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Referees
// ---------------------------------------------------------------------------

export async function emailRefereeApplicationReceived(userId: string, profileId: string): Promise<void> {
  await queueEmailSafely({
    template: "referee.application-received",
    dedupeKey: `referee-applied-${profileId}`,
    userId,
    payload: { name: await nameOf(userId) },
  });
}

export async function emailRefereeApplicationDecided(input: {
  userId: string;
  profileId: string;
  status: "approved" | "rejected" | "suspended";
  notes?: string | null;
}): Promise<void> {
  await queueEmailSafely({
    template: "referee.application-decided",
    dedupeKey: `referee-${input.status}-${input.profileId}-${Math.floor(Date.now() / 1000)}`,
    userId: input.userId,
    payload: {
      name: await nameOf(input.userId),
      status: input.status,
      notes: input.notes ?? null,
    },
  });
}

export async function emailRefereeFeePaid(input: {
  userId: string;
  assignmentId: string;
  amount: Money;
  gameName: string;
}): Promise<void> {
  await queueEmailSafely({
    template: "referee.fee-paid",
    dedupeKey: `referee-fee-${input.assignmentId}`,
    userId: input.userId,
    payload: {
      name: await nameOf(input.userId),
      amount: money(input.amount),
      gameName: input.gameName,
      balance: await balanceOf(input.userId),
    },
  });
}

/**
 * Backup for the in-app alert when a match needs a referee: emails every
 * approved, available referee qualified for that game. Optional, so referees
 * who have turned match emails off are skipped by queueEmail.
 */
export async function emailRefereesMatchAvailable(betId: string): Promise<void> {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    select: {
      gameId: true,
      amount: true,
      platformFeePercent: true,
      playerAId: true,
      playerBId: true,
      game: { select: { name: true } },
      playerA: { select: { displayName: true } },
      playerB: { select: { displayName: true } },
      refereeAssignment: { select: { id: true, rewardPercent: true } },
    },
  });
  if (!bet?.refereeAssignment) return;

  // The referee earns a share of the platform fee, not of the players' pot.
  const reward = new Decimal(bet.amount)
    .mul(2)
    .mul(bet.platformFeePercent)
    .mul(bet.refereeAssignment.rewardPercent)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const candidates = await prisma.refereeProfile.findMany({
    where: {
      status: "APPROVED",
      isAvailable: true,
      qualifications: { some: { gameId: bet.gameId } },
      userId: { notIn: [bet.playerAId, bet.playerBId].filter(Boolean) as string[] },
      user: { kycStatus: "VERIFIED" },
    },
    select: { userId: true, user: { select: { displayName: true } } },
    take: 50,
  });

  const players = `${bet.playerA.displayName} vs ${bet.playerB?.displayName ?? "an opponent"}`;

  for (const candidate of candidates) {
    await queueEmailSafely({
      template: "referee.match-available",
      dedupeKey: `referee-available-${bet.refereeAssignment.id}-${candidate.userId}`,
      userId: candidate.userId,
      payload: {
        name: candidate.user.displayName,
        gameName: bet.game.name,
        players,
        reward: money(reward),
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Responsible play
// ---------------------------------------------------------------------------

export async function emailDepositLimitChanged(input: {
  userId: string;
  limitId: string;
  period: string;
  amount: Money;
  effectiveAt?: Date | null;
}): Promise<void> {
  await queueEmailSafely({
    template: "responsible.deposit-limit-changed",
    dedupeKey: `deposit-limit-${input.limitId}-${Math.floor(Date.now() / 1000)}`,
    userId: input.userId,
    payload: {
      name: await nameOf(input.userId),
      period: input.period,
      amount: money(input.amount),
      effectiveAt: input.effectiveAt ? when(input.effectiveAt) : null,
    },
  });
}

export async function emailBreakStarted(input: {
  userId: string;
  breakId: string;
  kind: string;
  endsAt: Date | null;
}): Promise<void> {
  await queueEmailSafely({
    template: "responsible.break-started",
    dedupeKey: `break-started-${input.breakId}`,
    userId: input.userId,
    payload: {
      name: await nameOf(input.userId),
      kind: input.kind.replace(/_/g, " "),
      endsAt: input.endsAt ? when(input.endsAt) : null,
    },
  });
}

export async function emailBreakEnded(input: {
  userId: string;
  breakId: string;
  kind: string;
}): Promise<void> {
  await queueEmailSafely({
    template: "responsible.break-ended",
    dedupeKey: `break-ended-${input.breakId}`,
    userId: input.userId,
    payload: { name: await nameOf(input.userId), kind: input.kind.replace(/_/g, " ") },
  });
}

// ---------------------------------------------------------------------------
// Other
// ---------------------------------------------------------------------------

export async function emailKickConnectionChanged(input: {
  userId: string;
  channel: string;
  connected: boolean;
}): Promise<void> {
  await queueEmailSafely({
    template: "kick.connection-changed",
    dedupeKey: `kick-${input.connected ? "on" : "off"}-${input.userId}-${Math.floor(Date.now() / 1000)}`,
    userId: input.userId,
    payload: {
      name: await nameOf(input.userId),
      channel: input.channel,
      connected: input.connected,
    },
  });
}

export async function emailBetaSignup(email: string, name: string, signupId: string): Promise<void> {
  await queueEmailSafely({
    template: "beta.signup-received",
    dedupeKey: `beta-signup-${signupId}`,
    toEmail: email,
    payload: { name },
  });
}

/** Ops alerts to EMAIL_ADMIN (falls back to the support inbox). */
export async function emailAdminAlert(input: {
  key: string;
  title: string;
  detail: string;
  url?: string | null;
}): Promise<void> {
  const to = process.env.EMAIL_ADMIN;
  if (!to) return;
  await queueEmailSafely({
    template: "admin.alert",
    dedupeKey: `admin-${input.key}`,
    toEmail: to,
    payload: { title: input.title, detail: input.detail, url: input.url ?? null },
  });
}

export { queueEmail };
