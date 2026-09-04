import {
  DepositLimitPeriod,
  PlayBreakType,
} from "../../../generated/prisma/client";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * A raise sits pending for this long before it takes effect. Reductions apply
 * immediately — the delay exists to stop a limit being lifted mid-session,
 * which is the only moment it matters.
 */
export const LIMIT_INCREASE_DELAY_MS = 24 * HOUR;

/** Rolling window each limit is measured over. */
export const PERIOD_WINDOW_MS: Record<DepositLimitPeriod, number> = {
  [DepositLimitPeriod.DAILY]: DAY,
  [DepositLimitPeriod.WEEKLY]: 7 * DAY,
  [DepositLimitPeriod.MONTHLY]: 30 * DAY,
};

/** Adjective form, for prose like "your daily deposit limit". */
export const PERIOD_ADJECTIVE: Record<DepositLimitPeriod, string> = {
  [DepositLimitPeriod.DAILY]: "daily",
  [DepositLimitPeriod.WEEKLY]: "weekly",
  [DepositLimitPeriod.MONTHLY]: "monthly",
};

/** Window length, for prose like "in the last 24 hours". */
export const PERIOD_LABEL: Record<DepositLimitPeriod, string> = {
  [DepositLimitPeriod.DAILY]: "24 hours",
  [DepositLimitPeriod.WEEKLY]: "7 days",
  [DepositLimitPeriod.MONTHLY]: "30 days",
};

export interface BreakOption {
  id: string;
  label: string;
  durationMs: number;
}

/** Short "take a break" periods. */
export const COOL_OFF_OPTIONS: BreakOption[] = [
  { id: "24h", label: "24 hours", durationMs: DAY },
  { id: "72h", label: "72 hours", durationMs: 3 * DAY },
  { id: "1w", label: "1 week", durationMs: 7 * DAY },
  { id: "1m", label: "1 month", durationMs: 30 * DAY },
  { id: "6w", label: "6 weeks", durationMs: 42 * DAY },
];

/** Long-term exclusion periods. */
export const SELF_EXCLUSION_OPTIONS: BreakOption[] = [
  { id: "6mo", label: "6 months", durationMs: 182 * DAY },
  { id: "1y", label: "1 year", durationMs: 365 * DAY },
  { id: "2y", label: "2 years", durationMs: 730 * DAY },
  { id: "5y", label: "5 years", durationMs: 1826 * DAY },
];

export const BREAK_OPTIONS: Record<PlayBreakType, BreakOption[]> = {
  [PlayBreakType.COOL_OFF]: COOL_OFF_OPTIONS,
  [PlayBreakType.SELF_EXCLUSION]: SELF_EXCLUSION_OPTIONS,
};

export function findBreakOption(
  type: PlayBreakType,
  optionId: string,
): BreakOption | undefined {
  return BREAK_OPTIONS[type].find((option) => option.id === optionId);
}

/** Selectable intervals for in-session play reminders. */
export const SESSION_REMINDER_INTERVALS = [15, 30, 60, 120] as const;

/** Upper bound on any single deposit limit, in cents. */
export const MAX_DEPOSIT_LIMIT_CENTS = 1_000_000_00;
