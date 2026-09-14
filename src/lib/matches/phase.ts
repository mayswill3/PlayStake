import {
  BetStatus,
  RefereeAssignmentStatus,
} from "../../../generated/prisma/client";

/** Where a refereed stream match is, from a spectator's point of view. */
export type SpectatorPhase =
  | "FINDING_REFEREE"
  | "STARTING"
  | "LIVE"
  | "IN_REVIEW"
  | "DISPUTED"
  | "FINISHED"
  | "VOIDED";

/** Phases shown in the live list / dashboard slideshow, most exciting first. */
export const LIVE_PHASES: SpectatorPhase[] = ["LIVE", "STARTING", "FINDING_REFEREE", "IN_REVIEW"];

export function spectatorPhase(
  betStatus: BetStatus,
  assignmentStatus: RefereeAssignmentStatus | null,
): SpectatorPhase {
  if (betStatus === BetStatus.SETTLED) return "FINISHED";
  if (
    betStatus === BetStatus.VOIDED ||
    betStatus === BetStatus.CANCELLED ||
    assignmentStatus === RefereeAssignmentStatus.CANCELLED
  ) {
    return "VOIDED";
  }
  if (betStatus === BetStatus.DISPUTED || assignmentStatus === RefereeAssignmentStatus.DISPUTED) {
    return "DISPUTED";
  }
  switch (assignmentStatus) {
    case RefereeAssignmentStatus.OPEN:
      return "FINDING_REFEREE";
    case RefereeAssignmentStatus.ASSIGNED:
    case RefereeAssignmentStatus.READY:
      return "STARTING";
    case RefereeAssignmentStatus.IN_PROGRESS:
      return "LIVE";
    default:
      // DECISION_SUBMITTED / COMPLETED-but-unsettled, or a result already in.
      return "IN_REVIEW";
  }
}
