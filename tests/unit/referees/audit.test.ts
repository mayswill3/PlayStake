import { describe, expect, it } from "vitest";
import {
  computeRefereeAuditHash,
  verifyRefereeAuditChain,
} from "../../../src/lib/referees/audit";

function event(
  sequence: number,
  previousHash: string | null,
  action: string,
  details: Record<string, unknown>,
) {
  const base = {
    assignmentId: "11111111-1111-4111-8111-111111111111",
    actorUserId: "22222222-2222-4222-8222-222222222222",
    sequence,
    action,
    details,
    previousHash,
    createdAt: new Date(`2026-07-27T12:0${sequence}:00.000Z`),
  };
  return { ...base, eventHash: computeRefereeAuditHash(base) };
}

describe("referee audit chain", () => {
  it("verifies an untampered ordered chain", () => {
    const first = event(1, null, "ASSIGNMENT_OPENED", { betId: "bet-1" });
    const second = event(2, first.eventHash, "REFEREE_CLAIMED", { version: 2 });
    const third = event(3, second.eventHash, "DECISION_SUBMITTED", {
      decision: "PLAYER_A_WIN",
    });

    expect(verifyRefereeAuditChain([first, second, third])).toBe(true);
  });

  it("detects modified decision evidence", () => {
    const first = event(1, null, "ASSIGNMENT_OPENED", { betId: "bet-1" });
    const second = event(2, first.eventHash, "DECISION_SUBMITTED", {
      decision: "PLAYER_A_WIN",
    });

    expect(
      verifyRefereeAuditChain([
        first,
        { ...second, details: { decision: "PLAYER_B_WIN" } },
      ]),
    ).toBe(false);
  });

  it("detects deleted or reordered events", () => {
    const first = event(1, null, "ASSIGNMENT_OPENED", {});
    const second = event(2, first.eventHash, "REFEREE_READY", {});
    const third = event(3, second.eventHash, "MATCH_STARTED", {});

    expect(verifyRefereeAuditChain([first, third])).toBe(false);
    expect(verifyRefereeAuditChain([second, first, third])).toBe(false);
  });
});
