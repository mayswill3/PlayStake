import { AppError } from "../errors";
import {
  DepositLimitPeriod,
  PlayBreakType,
} from "../../../generated/prisma/client";
import { PERIOD_ADJECTIVE, PERIOD_LABEL } from "./constants";
import type { ActiveBreak } from "./service";

/** Raised when a cool-off or self-exclusion blocks an action. */
export class PlayBreakError extends AppError {
  public readonly breakType: PlayBreakType;
  public readonly endsAt: Date;

  constructor(activeBreak: ActiveBreak) {
    super(messageFor(activeBreak), 403, "PLAY_BREAK_ACTIVE");
    this.name = "PlayBreakError";
    this.breakType = activeBreak.type;
    this.endsAt = activeBreak.endsAt;
  }
}

function messageFor(activeBreak: ActiveBreak): string {
  if (activeBreak.type === PlayBreakType.COOL_OFF) {
    return "You are on a cool-off break. You can still withdraw your balance, but you cannot deposit or place bets.";
  }
  if (activeBreak.returnEffectiveAt) {
    return "Your return from self-exclusion is being processed. You can deposit and play again once the 24-hour cooling-off period ends.";
  }
  if (activeBreak.awaitingReturn) {
    return "Your self-exclusion period has ended, but your account stays closed to gambling until you ask to return from Safer gambling in your account.";
  }
  return "Your account is self-excluded. You can still withdraw your balance, but you cannot deposit or place bets.";
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
