// =============================================================================
// PlayStake — Match lifecycle: no-show void
// =============================================================================
// A challenge/lobby bet reaches MATCHED with both stakes escrowed. If the match
// is never played (e.g. the challenger never returns), the bet would otherwise
// sit MATCHED forever with locked funds. This voids such an orphaned bet and
// refunds both players.
//
// It REUSES the existing refundEscrow primitive and mirrors the exact
// orphaned-match void already used by /api/demo/cleanup-bets and the
// dispute-escalation worker. No new escrow/ledger logic.
// =============================================================================

import { BetStatus } from "../../../generated/prisma/client";
import type { TxClient } from "../db/client";
import { refundEscrow } from "../ledger/escrow";

/** How long a MATCHED bet may sit unplayed before it's treated as a no-show.
 *  Matches the orphan window already used by /api/demo/cleanup-bets. */
export const NO_SHOW_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Void a single no-show MATCHED bet and refund both players.
 *
 * Idempotent / safe under races: it re-reads the bet and no-ops unless it is
 * still MATCHED, so a play/result landing at the same moment (which moves the
 * bet to RESULT_REPORTED) is never double-handled. Sets VOIDED first, then
 * refunds both escrows (refundEscrow accepts MATCHED and VOIDED).
 *
 * @returns whether the bet was voided.
 */
export async function voidNoShowMatch(
  tx: TxClient,
  betId: string,
): Promise<{ voided: boolean }> {
  const bet = await tx.bet.findUnique({
    where: { id: betId },
    select: { id: true, status: true, amount: true, playerAId: true, playerBId: true },
  });

  if (!bet || bet.status !== BetStatus.MATCHED || !bet.playerBId) {
    return { voided: false };
  }

  await tx.bet.update({
    where: { id: bet.id },
    data: { status: BetStatus.VOIDED, cancelledAt: new Date() },
  });

  await refundEscrow(tx, {
    betId: bet.id,
    playerId: bet.playerAId,
    amount: bet.amount,
    idempotencyKey: `noshow-refund-a-${bet.id}`,
  });
  await refundEscrow(tx, {
    betId: bet.id,
    playerId: bet.playerBId,
    amount: bet.amount,
    idempotencyKey: `noshow-refund-b-${bet.id}`,
  });

  return { voided: true };
}
