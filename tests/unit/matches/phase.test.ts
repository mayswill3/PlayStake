import { describe, it, expect } from "vitest";
import { BetStatus, RefereeAssignmentStatus } from "../../../generated/prisma/client.js";
import { spectatorPhase } from "../../../src/lib/matches/phase.js";

describe("spectatorPhase", () => {
  it("follows the referee assignment while the bet is in play", () => {
    expect(spectatorPhase(BetStatus.MATCHED, RefereeAssignmentStatus.OPEN)).toBe("FINDING_REFEREE");
    expect(spectatorPhase(BetStatus.MATCHED, RefereeAssignmentStatus.ASSIGNED)).toBe("STARTING");
    expect(spectatorPhase(BetStatus.MATCHED, RefereeAssignmentStatus.READY)).toBe("STARTING");
    expect(spectatorPhase(BetStatus.MATCHED, RefereeAssignmentStatus.IN_PROGRESS)).toBe("LIVE");
    expect(spectatorPhase(BetStatus.RESULT_REPORTED, RefereeAssignmentStatus.DECISION_SUBMITTED)).toBe(
      "IN_REVIEW",
    );
  });

  it("lets terminal bet states win over the assignment", () => {
    expect(spectatorPhase(BetStatus.SETTLED, RefereeAssignmentStatus.COMPLETED)).toBe("FINISHED");
    expect(spectatorPhase(BetStatus.VOIDED, RefereeAssignmentStatus.OPEN)).toBe("VOIDED");
    expect(spectatorPhase(BetStatus.MATCHED, RefereeAssignmentStatus.CANCELLED)).toBe("VOIDED");
    expect(spectatorPhase(BetStatus.DISPUTED, RefereeAssignmentStatus.DECISION_SUBMITTED)).toBe("DISPUTED");
    expect(spectatorPhase(BetStatus.RESULT_REPORTED, RefereeAssignmentStatus.DISPUTED)).toBe("DISPUTED");
  });
});
