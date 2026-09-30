// =============================================================================
// PlayStake — When a reported result becomes settleable
// =============================================================================
// Shared by the settlement worker (which settles once this time has passed)
// and the API (which shows players a countdown to it), so the two agree.
// =============================================================================

import { BetStatus, RefereeAssignmentStatus } from "../../../generated/prisma/client";

/** A verified, non-refereed result waits this long before settling. */
export const SETTLEMENT_DELAY_MS = 2 * 60 * 1000;

export interface SettlementTimingInput {
  status: BetStatus;
  resultVerified: boolean;
  resultReportedAt: Date | null;
  /** Whether an OPEN or UNDER_REVIEW dispute exists — that holds settlement. */
  hasOpenDispute: boolean;
  refereeAssignment: { status: RefereeAssignmentStatus; disputeDeadline: Date | null } | null;
}

/**
 * When the settlement worker will first pick this bet up, or null if it's not
 * on a clock (not reported yet, unverified, disputed, or already settled).
 * The worker scans every 30s, so payout lands shortly after this time.
 */
export function settlementDueAt(bet: SettlementTimingInput): Date | null {
  if (bet.status !== BetStatus.RESULT_REPORTED) return null;
  if (!bet.resultVerified || !bet.resultReportedAt || bet.hasOpenDispute) return null;

  if (bet.refereeAssignment) {
    // Refereed: funds stay in escrow for the whole dispute window.
    if (bet.refereeAssignment.status !== RefereeAssignmentStatus.DECISION_SUBMITTED) return null;
    return bet.refereeAssignment.disputeDeadline;
  }
  return new Date(bet.resultReportedAt.getTime() + SETTLEMENT_DELAY_MS);
}
