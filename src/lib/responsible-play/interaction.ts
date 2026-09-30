// =============================================================================
// PlayStake — Customer interaction (identify → act → evaluate)
// =============================================================================
// A marker of harm (risk.ts) is the "identify" step. This module is the rest:
//
//   act       — every signal immediately puts a supportive message in front of
//               the customer, which stays until they respond; staff then review
//               the signal and can call, email, apply a limit or cool-off, or
//               restrict the account. Everything is a CustomerInteraction row.
//   evaluate  — 14 days after an interaction, compare the customer's deposits
//               and stakes before and after, and record what changed. Staff
//               see the outcomes per marker type, so the business can tell
//               which interactions work.
// =============================================================================

import {
  DepositLimitPeriod,
  InteractionOutcome,
  InteractionType,
  PlayBreakType,
  PlayerRiskStatus,
  PlayerRiskType,
  TransactionStatus,
  TransactionType,
  BetStatus,
} from "../../../generated/prisma/client";
import { prisma } from "../db/client";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { dollarsToCents } from "../utils/money";
import { recordAdminAction } from "../admin/audit";
import { emailAdminAlert } from "../email/events";
import { appUrl } from "../email/layout";
import { setDepositLimit, startBreak } from "./service";

const DAY = 24 * 60 * 60 * 1000;
/** How long after an interaction its effect is measured, and over what window. */
export const EVALUATION_WINDOW_MS = 14 * DAY;
/** Spending this much less afterwards counts as an improvement. */
const IMPROVEMENT_RATIO = 0.75;

const SUPPORT_LINE =
  "If you'd like to talk to someone, GamCare offers free, confidential support on 0808 8020 133 (24/7).";

/** What the customer is shown straight away, per marker. Supportive, not accusatory. */
export const AUTOMATED_MESSAGES: Record<PlayerRiskType, string> = {
  [PlayerRiskType.LOSS_CHASING_STAKES]:
    "We noticed your stakes have been going up after a run of losses. Chasing losses is one of the most common ways gambling stops being fun. It might be a good moment to take a break or set a limit.",
  [PlayerRiskType.LOSS_CHASING_DEPOSITS]:
    "We noticed you've topped up several times shortly after losing. It can help to decide in advance how much you're happy to spend — a deposit limit does that for you.",
  [PlayerRiskType.DEPOSIT_VELOCITY]:
    "You've made a number of deposits in a short time. We want to check you're still in control of how much you're spending.",
  [PlayerRiskType.HIGH_DEPOSIT_VOLUME]:
    "You've deposited more than usual over the last month. We check in with everyone who reaches this level, to make sure your play stays affordable.",
  [PlayerRiskType.LATE_NIGHT_PLAY]:
    "You've been playing a lot late at night. Tiredness makes it harder to keep track of time and money — a reminder or a break might help.",
};

export function automatedMessageFor(type: PlayerRiskType): string {
  return `${AUTOMATED_MESSAGES[type]} ${SUPPORT_LINE}`;
}

/** Put the automated message in front of the customer for a new signal. */
export async function startAutomatedInteraction(
  userId: string,
  riskSignalId: string,
  type: PlayerRiskType,
  now: Date = new Date(),
): Promise<string> {
  const interaction = await prisma.customerInteraction.create({
    data: {
      userId,
      riskSignalId,
      type: InteractionType.AUTOMATED_MESSAGE,
      message: automatedMessageFor(type),
      followUpAt: new Date(now.getTime() + EVALUATION_WINDOW_MS),
    },
    select: { id: true },
  });
  return interaction.id;
}

// ---------------------------------------------------------------------------
// Customer side
// ---------------------------------------------------------------------------

export async function listPendingPrompts(userId: string) {
  return prisma.customerInteraction.findMany({
    where: { userId, type: InteractionType.AUTOMATED_MESSAGE, acknowledgedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, message: true, createdAt: true },
  });
}

export type PromptResponse = "ok" | "set_limit" | "take_break";

/**
 * The customer responded to an automated message. What they chose is noted;
 * whether they actually set a limit or took a break is established at
 * evaluation, from what they did.
 */
export async function respondToPrompt(
  userId: string,
  interactionId: string,
  response: PromptResponse,
): Promise<void> {
  const updated = await prisma.customerInteraction.updateMany({
    where: {
      id: interactionId,
      userId,
      type: InteractionType.AUTOMATED_MESSAGE,
      acknowledgedAt: null,
    },
    data: {
      acknowledgedAt: new Date(),
      outcome: InteractionOutcome.ACKNOWLEDGED,
      outcomeNotes: `Customer chose: ${response.replace(/_/g, " ")}`,
    },
  });
  if (updated.count === 0) throw new NotFoundError("That message is no longer waiting for you");
}

// ---------------------------------------------------------------------------
// Staff side
// ---------------------------------------------------------------------------

export type StaffSignalAction =
  | { kind: "review"; status: "REVIEWED" | "DISMISSED"; notes: string }
  | {
      kind: "interaction";
      type: "EMAIL" | "PHONE_CALL" | "NOTE";
      message: string;
      followUpDays?: number;
    }
  | { kind: "apply_limit"; period: DepositLimitPeriod; amountCents: number; message: string }
  | { kind: "apply_cool_off"; optionId: string; message: string }
  | { kind: "outcome"; interactionId: string; outcome: InteractionOutcome; notes: string };

/** Everything staff do about a signal goes through here, and is audited. */
export async function actOnSignal(
  signalId: string,
  actorId: string,
  action: StaffSignalAction,
  request?: Request | null,
): Promise<void> {
  const signal = await prisma.playerRiskSignal.findUnique({
    where: { id: signalId },
    select: { id: true, userId: true, status: true },
  });
  if (!signal) throw new NotFoundError("Signal not found");
  const now = new Date();
  const followUpAt = new Date(now.getTime() + EVALUATION_WINDOW_MS);

  switch (action.kind) {
    case "review": {
      if (action.notes.trim().length < 10) throw new ValidationError("Record what you found (at least 10 characters)");
      await prisma.playerRiskSignal.update({
        where: { id: signalId },
        data: {
          status: action.status as PlayerRiskStatus,
          reviewedById: actorId,
          reviewedAt: now,
          reviewNotes: action.notes.trim(),
        },
      });
      break;
    }
    case "interaction": {
      if (action.message.trim().length < 10) throw new ValidationError("Describe the interaction");
      await prisma.customerInteraction.create({
        data: {
          userId: signal.userId,
          riskSignalId: signalId,
          type: action.type as InteractionType,
          message: action.message.trim(),
          createdById: actorId,
          followUpAt:
            action.type === "NOTE"
              ? null
              : new Date(now.getTime() + (action.followUpDays ?? 14) * DAY),
        },
      });
      break;
    }
    case "apply_limit": {
      // Operator-applied limits only ever tighten: setDepositLimit applies a
      // lower (or first) limit immediately and stages anything higher.
      const result = await setDepositLimit(signal.userId, action.period, action.amountCents, now);
      if (!result.effectiveNow) {
        throw new ConflictError("That is higher than the customer's current limit; operator limits can only lower it");
      }
      await prisma.customerInteraction.create({
        data: {
          userId: signal.userId,
          riskSignalId: signalId,
          type: InteractionType.DEPOSIT_LIMIT_APPLIED,
          message: action.message.trim() || `Applied a ${action.period.toLowerCase()} deposit limit`,
          createdById: actorId,
          followUpAt,
        },
      });
      break;
    }
    case "apply_cool_off": {
      await startBreak(signal.userId, PlayBreakType.COOL_OFF, action.optionId, now);
      await prisma.customerInteraction.create({
        data: {
          userId: signal.userId,
          riskSignalId: signalId,
          type: InteractionType.COOL_OFF_APPLIED,
          message: action.message.trim() || "Applied a cool-off",
          createdById: actorId,
          followUpAt,
        },
      });
      break;
    }
    case "outcome": {
      const updated = await prisma.customerInteraction.updateMany({
        where: { id: action.interactionId, userId: signal.userId },
        data: {
          outcome: action.outcome,
          outcomeNotes: action.notes.trim() || null,
          outcomeRecordedAt: now,
        },
      });
      if (updated.count === 0) throw new NotFoundError("Interaction not found");
      break;
    }
  }

  await recordAdminAction({
    actorId,
    action: `harm_signal.${action.kind}`,
    targetType: "player_risk_signal",
    targetId: signalId,
    details: { userId: signal.userId, ...action } as Record<string, string | number>,
    request,
  });
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

interface Activity {
  depositedCents: number;
  stakedCents: number;
}

async function activityBetween(userId: string, from: Date, to: Date): Promise<Activity> {
  const [deposits, bets] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETED,
        metadata: { path: ["userId"], equals: userId },
        createdAt: { gte: from, lt: to },
      },
      select: { amount: true },
    }),
    prisma.bet.findMany({
      where: {
        matchedAt: { gte: from, lt: to },
        status: { notIn: [BetStatus.CANCELLED, BetStatus.VOIDED] },
        OR: [{ playerAId: userId }, { playerBId: userId }],
      },
      select: { amount: true },
    }),
  ]);
  return {
    depositedCents: deposits.reduce((sum, row) => sum + dollarsToCents(row.amount), 0),
    stakedCents: bets.reduce((sum, row) => sum + dollarsToCents(row.amount), 0),
  };
}

/**
 * Settle the outcome of interactions whose follow-up date has passed, from
 * what the customer did. Returns how many were evaluated.
 */
export async function evaluateDueInteractions(now: Date = new Date()): Promise<number> {
  const due = await prisma.customerInteraction.findMany({
    where: {
      followUpAt: { lte: now },
      outcome: { in: [InteractionOutcome.PENDING, InteractionOutcome.ACKNOWLEDGED] },
    },
    select: { id: true, userId: true, createdAt: true, riskSignal: { select: { severity: true, type: true } } },
    take: 200,
  });

  for (const interaction of due) {
    const at = interaction.createdAt;
    const [limitSet, breakTaken, before, after] = await Promise.all([
      prisma.depositLimit.findFirst({
        where: { userId: interaction.userId, OR: [{ createdAt: { gte: at } }, { updatedAt: { gte: at } }] },
        select: { id: true },
      }),
      prisma.playBreak.findFirst({
        where: { userId: interaction.userId, createdAt: { gte: at } },
        select: { id: true },
      }),
      activityBetween(interaction.userId, new Date(at.getTime() - EVALUATION_WINDOW_MS), at),
      activityBetween(interaction.userId, at, new Date(at.getTime() + EVALUATION_WINDOW_MS)),
    ]);

    const beforeTotal = before.depositedCents + before.stakedCents;
    const afterTotal = after.depositedCents + after.stakedCents;
    const outcome = breakTaken
      ? InteractionOutcome.CUSTOMER_TOOK_BREAK
      : limitSet
        ? InteractionOutcome.CUSTOMER_SET_LIMIT
        : afterTotal <= beforeTotal * IMPROVEMENT_RATIO
          ? InteractionOutcome.BEHAVIOUR_IMPROVED
          : InteractionOutcome.BEHAVIOUR_UNCHANGED;

    await prisma.customerInteraction.update({
      where: { id: interaction.id },
      data: {
        outcome,
        outcomeRecordedAt: now,
        outcomeNotes: `Automatic evaluation. 14 days before: deposited ${before.depositedCents / 100}, staked ${before.stakedCents / 100}. 14 days after: deposited ${after.depositedCents / 100}, staked ${after.stakedCents / 100}.`,
      },
    });

    // No change after we reached out: a person needs to look again.
    if (outcome === InteractionOutcome.BEHAVIOUR_UNCHANGED) {
      await emailAdminAlert({
        key: `interaction-unchanged-${interaction.id}`,
        title: "Customer interaction had no effect",
        detail: `Behaviour for player ${interaction.userId} did not change in the 14 days after an interaction${interaction.riskSignal ? ` about ${interaction.riskSignal.type.toLowerCase().replace(/_/g, " ")}` : ""}. Consider a stronger step (a call, a limit, or a restriction).`,
        url: appUrl("/admin/harm-signals"),
      });
    }
  }
  return due.length;
}

/** Outcomes by marker type, for judging which interactions work. */
export async function interactionEffectiveness() {
  const rows = await prisma.customerInteraction.findMany({
    where: { riskSignalId: { not: null } },
    select: { type: true, outcome: true, riskSignal: { select: { type: true } } },
  });
  const table: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    const key = `${row.riskSignal?.type ?? "UNKNOWN"}|${row.type}`;
    table[key] ??= {};
    table[key][row.outcome] = (table[key][row.outcome] ?? 0) + 1;
  }
  return Object.entries(table).map(([key, outcomes]) => {
    const [signalType, interactionType] = key.split("|");
    return { signalType, interactionType, outcomes };
  });
}

/** Staff view of a signal with the customer's recent picture. */
export async function getSignalForStaff(signalId: string) {
  const signal = await prisma.playerRiskSignal.findUnique({
    where: { id: signalId },
    include: {
      user: { select: { id: true, displayName: true, email: true, accountStatus: true } },
      reviewedBy: { select: { displayName: true } },
    },
  });
  if (!signal) throw new NotFoundError("Signal not found");
  const now = new Date();
  const [interactions, otherSignals, last30] = await Promise.all([
    prisma.customerInteraction.findMany({
      where: { userId: signal.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { createdBy: { select: { displayName: true } } },
    }),
    prisma.playerRiskSignal.findMany({
      where: { userId: signal.userId, id: { not: signal.id } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, type: true, severity: true, status: true, createdAt: true },
    }),
    activityBetween(signal.userId, new Date(now.getTime() - 30 * DAY), now),
  ]);
  return { signal, interactions, otherSignals, last30 };
}

export async function listSignalsForStaff(status: PlayerRiskStatus | "all") {
  return prisma.playerRiskSignal.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { id: true, displayName: true, email: true } },
      _count: { select: { interactions: true } },
    },
  });
}

/** Mark the pre-first-deposit limit prompt as answered. */
export async function recordDepositLimitPrompt(userId: string): Promise<void> {
  await prisma.responsiblePlaySettings.upsert({
    where: { userId },
    create: { userId, depositLimitPromptedAt: new Date() },
    update: { depositLimitPromptedAt: new Date() },
  });
}

