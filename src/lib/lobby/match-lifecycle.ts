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

import { BetStatus, LedgerAccountType } from "../../../generated/prisma/client";
import type { TxClient } from "../db/client";
import { refundEscrow } from "../ledger/escrow";

/** How long a MATCHED bet may sit unplayed before it's treated as a no-show.
 *  Matches the orphan window already used by /api/demo/cleanup-bets. */
export const NO_SHOW_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface VoidNoShowResult {
  voided: boolean;
  /** False when the bet was closed without a refund because nothing was ever
   *  locked against it. */
  refunded: boolean;
}

/**
 * Void a single no-show MATCHED bet and refund both players.
 *
 * Idempotent / safe under races: it re-reads the bet and no-ops unless it is
 * still MATCHED, so a play/result landing at the same moment (which moves the
 * bet to RESULT_REPORTED) is never double-handled. Sets VOIDED first, then
 * refunds both escrows (refundEscrow accepts MATCHED and VOIDED).
 *
 * A bet with no escrow account never had funds locked against it, so there is
 * nothing to refund and it is simply closed. Without that case the refund
 * would throw, roll back the VOIDED update, and leave the bet to be swept
 * again every scan — forever, and indistinguishable in the logs from a real
 * bet whose players' stakes are genuinely stuck.
 *
 * @returns whether the bet was voided, and whether funds were returned.
 */
export async function voidNoShowMatch(
  tx: TxClient,
  betId: string,
): Promise<VoidNoShowResult> {
  const bet = await tx.bet.findUnique({
    where: { id: betId },
    select: { id: true, status: true, amount: true, playerAId: true, playerBId: true },
  });

  if (!bet || bet.status !== BetStatus.MATCHED || !bet.playerBId) {
    return { voided: false, refunded: false };
  }

  // Funds can only be locked through the bet's escrow account, so its absence
  // is proof that nothing was ever held.
  const escrowAccount = await tx.ledgerAccount.findFirst({
    where: { betId: bet.id, accountType: LedgerAccountType.ESCROW },
    select: { id: true },
  });

  if (!escrowAccount) {
    // Belt and braces: if money moved against this bet by some path that left
    // no escrow account, that is a real inconsistency. Refuse to close it
    // quietly and let the caller surface the failure.
    const transactionCount = await tx.transaction.count({
      where: { betId: bet.id },
    });
    if (transactionCount > 0) {
      throw new Error(
        `Bet ${bet.id} has ${transactionCount} transaction(s) but no escrow account`,
      );
    }

    await tx.bet.update({
      where: { id: bet.id },
      data: { status: BetStatus.VOIDED, cancelledAt: new Date() },
    });
    return { voided: true, refunded: false };
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

  return { voided: true, refunded: true };
}
