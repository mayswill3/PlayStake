import { describe, it, expect } from "vitest";
import {
  BetStatus,
  RefereeAssignmentStatus,
} from "../../../generated/prisma/client.js";
import {
  SETTLEMENT_DELAY_MS,
  settlementDueAt,
  type SettlementTimingInput,
} from "../../../src/lib/jobs/settlement-timing.js";

const REPORTED = new Date("2026-09-30T12:00:00Z");

function bet(overrides: Partial<SettlementTimingInput> = {}): SettlementTimingInput {
  return {
    status: BetStatus.RESULT_REPORTED,
    resultVerified: true,
    resultReportedAt: REPORTED,
    hasOpenDispute: false,
    refereeAssignment: null,
    ...overrides,
  };
}

describe("settlementDueAt", () => {
  it("releases a verified lobby result after the settlement delay", () => {
    expect(settlementDueAt(bet())?.getTime()).toBe(REPORTED.getTime() + SETTLEMENT_DELAY_MS);
  });

  it("holds a refereed result until the dispute deadline", () => {
    const deadline = new Date(REPORTED.getTime() + 15 * 60_000);
    expect(
      settlementDueAt(
        bet({
          refereeAssignment: {
            status: RefereeAssignmentStatus.DECISION_SUBMITTED,
            disputeDeadline: deadline,
          },
        }),
      ),
    ).toEqual(deadline);
  });

  it("isn't on a clock while a dispute is open", () => {
    expect(settlementDueAt(bet({ hasOpenDispute: true }))).toBeNull();
  });

  it("isn't on a clock until the result is verified", () => {
    expect(settlementDueAt(bet({ resultVerified: false }))).toBeNull();
  });

  it("isn't on a clock before a result or after settlement", () => {
    expect(settlementDueAt(bet({ status: BetStatus.MATCHED }))).toBeNull();
    expect(settlementDueAt(bet({ status: BetStatus.SETTLED }))).toBeNull();
  });

  it("isn't on a clock while a refereed match is disputed", () => {
    expect(
      settlementDueAt(
        bet({
          refereeAssignment: {
            status: RefereeAssignmentStatus.DISPUTED,
            disputeDeadline: new Date(REPORTED.getTime() + 15 * 60_000),
          },
        }),
      ),
    ).toBeNull();
  });
});
