// =============================================================================
// Unit Tests: Responsible play constants
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  COOL_OFF_OPTIONS,
  LIMIT_INCREASE_DELAY_MS,
  PERIOD_WINDOW_MS,
  SELF_EXCLUSION_OPTIONS,
  findBreakOption,
} from "../../../src/lib/responsible-play/constants.js";
import {
  DepositLimitPeriod,
  PlayBreakType,
} from "../../../generated/prisma/client.js";

describe("Responsible play: limit windows", () => {
  it("orders the rolling windows daily < weekly < monthly", () => {
    expect(PERIOD_WINDOW_MS[DepositLimitPeriod.DAILY]).toBeLessThan(
      PERIOD_WINDOW_MS[DepositLimitPeriod.WEEKLY],
    );
    expect(PERIOD_WINDOW_MS[DepositLimitPeriod.WEEKLY]).toBeLessThan(
      PERIOD_WINDOW_MS[DepositLimitPeriod.MONTHLY],
    );
  });

  it("delays increases by 24 hours", () => {
    expect(LIMIT_INCREASE_DELAY_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe("Responsible play: break options", () => {
  it("keeps every self-exclusion longer than every cool-off", () => {
    const longestCoolOff = Math.max(
      ...COOL_OFF_OPTIONS.map((option) => option.durationMs),
    );
    const shortestExclusion = Math.min(
      ...SELF_EXCLUSION_OPTIONS.map((option) => option.durationMs),
    );

    expect(shortestExclusion).toBeGreaterThan(longestCoolOff);
  });

  it("starts self-exclusion at six months", () => {
    const shortest = Math.min(
      ...SELF_EXCLUSION_OPTIONS.map((option) => option.durationMs),
    );
    expect(shortest / (24 * 60 * 60 * 1000)).toBeGreaterThanOrEqual(180);
  });

  it("resolves options by id and rejects unknown ones", () => {
    expect(findBreakOption(PlayBreakType.COOL_OFF, "24h")?.label).toBe(
      "24 hours",
    );
    expect(findBreakOption(PlayBreakType.SELF_EXCLUSION, "5y")).toBeDefined();
    // A cool-off id must not resolve against the exclusion set.
    expect(findBreakOption(PlayBreakType.SELF_EXCLUSION, "24h")).toBeUndefined();
    expect(findBreakOption(PlayBreakType.COOL_OFF, "nope")).toBeUndefined();
  });
});
