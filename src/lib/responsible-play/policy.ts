import { AppError } from "../errors";
import {
  DepositLimitPeriod,
  PlayBreakType,
} from "../../../generated/prisma/client";
import { PERIOD_ADJECTIVE, PERIOD_LABEL } from "./constants";
import {
  getActiveBreak,
  getDepositLimits,
  getDepositUsage,
  type ActiveBreak,
} from "./service";

/** Raised when a cool-off or self-exclusion blocks an action. */
export class PlayBreakError extends AppError {
  public readonly breakType: PlayBreakType;
  public readonly endsAt: Date;

  constructor(activeBreak: ActiveBreak) {
    super(
      activeBreak.type === PlayBreakType.SELF_EXCLUSION
        ? "Your account is self-excluded. You can still withdraw your balance, but you cannot deposit or place bets."
        : "You are on a cool-off break. You can still withdraw your balance, but you cannot deposit or place bets.",
      403,
      "PLAY_BREAK_ACTIVE",
    );
    this.name = "PlayBreakError";
    this.breakType = activeBreak.type;
    this.endsAt = activeBreak.endsAt;
  }
}

/** Raised when a deposit would push a user past their own limit. */
export class DepositLimitError extends AppError {
  public readonly period: DepositLimitPeriod;
  public readonly limitCents: number;
  public readonly remainingCents: number;

  constructor(
    period: DepositLimitPeriod,
    limitCents: number,
    remainingCents: number,
  ) {
    super(
      remainingCents > 0
        ? `This deposit would exceed your ${PERIOD_ADJECTIVE[period]} deposit limit. You have ${formatCents(remainingCents)} left in the next ${PERIOD_LABEL[period]}.`
        : `You have reached your ${PERIOD_ADJECTIVE[period]} deposit limit of ${formatCents(limitCents)}.`,
      403,
      "DEPOSIT_LIMIT_EXCEEDED",
    );
    this.name = "DepositLimitError";
    this.period = period;
    this.limitCents = limitCents;
    this.remainingCents = remainingCents;
  }
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Block wagering while a break is running.
 *
 * Applied at every point a stake can be committed — joining a lobby, accepting
 * an invite, issuing a challenge — rather than only at the escrow hold, so the
 * user is stopped before they are drawn into a match.
 */
export async function assertCanWager(
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  const activeBreak = await getActiveBreak(userId, now);
  if (activeBreak) {
    throw new PlayBreakError(activeBreak);
  }
}

/**
 * Block a deposit that a break forbids or a self-set limit would exceed.
 *
 * Checked against every configured period, tightest first, so the message
 * names the limit the user actually hit.
 */
export async function assertCanDeposit(
  userId: string,
  amountCents: number,
  now: Date = new Date(),
): Promise<void> {
  const activeBreak = await getActiveBreak(userId, now);
  if (activeBreak) {
    throw new PlayBreakError(activeBreak);
  }

  const [limits, usage] = await Promise.all([
    getDepositLimits(userId, now),
    getDepositUsage(userId, now),
  ]);

  for (const limit of limits) {
    const used = usage[limit.period] ?? 0;
    const remaining = Math.max(0, limit.amountCents - used);
    if (used + amountCents > limit.amountCents) {
      throw new DepositLimitError(limit.period, limit.amountCents, remaining);
    }
  }
}
