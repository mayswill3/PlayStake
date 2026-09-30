// =============================================================================
// PlayStake — Settle a /play match from its recorded result
// =============================================================================
// The winner comes only from the persisted game session, which the server
// decided. Used by /api/demo/settle-bet when a player finishes a match, and by
// the no-show sweep for a match that finished but was never settled (a player
// closed the tab at the final dart) — so a decided match is paid out rather
// than voided.
// =============================================================================

import { Decimal } from "@prisma/client/runtime/client";
import { BetOutcome, BetStatus } from "../../../generated/prisma/client";
import type { TxClient } from "../db/client";
import { AppError } from "../errors";
import { collectFee, distributeDevShare, releaseEscrow } from "../ledger/escrow";
import { getAccountBalance, getEscrowAccountForBet } from "../ledger/accounts";
import { findFinishedSessionForBet } from "../games/sessions";

export class SettleError extends AppError {
  constructor(message: string, status = 400, code = "CANNOT_SETTLE") {
    super(message, status, code);
    this.name = "SettleError";
  }
}

export interface SettleResult {
  outcome: BetOutcome;
  winnerPayout: number;
  alreadySettled: boolean;
}

const OUTCOME_FOR: Record<string, BetOutcome> = {
  A: BetOutcome.PLAYER_A_WIN,
  B: BetOutcome.PLAYER_B_WIN,
  draw: BetOutcome.DRAW,
};

/**
 * Settle one bet from its finished game session, inside the caller's
 * transaction. Takes the bet's advisory lock, so two players (or a player and
 * the sweep) settling at once can't both pay out.
 */
export async function settleBetFromSession(tx: TxClient, betId: string): Promise<SettleResult> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${betId}))`;

  const bet = await tx.bet.findUnique({
    where: { id: betId },
    include: { game: { include: { developerProfile: { include: { escrowLimit: true } } } } },
  });
  if (!bet) throw new SettleError("Bet not found", 404, "NOT_FOUND");

  if (bet.status === BetStatus.SETTLED) {
    return { outcome: bet.outcome as BetOutcome, winnerPayout: 0, alreadySettled: true };
  }

  let outcome = bet.outcome;
  if (bet.status === BetStatus.MATCHED) {
    const session = await findFinishedSessionForBet(tx, bet);
    if (!session?.winner) {
      throw new SettleError("This match has no result yet");
    }
    outcome = OUTCOME_FOR[session.winner];
    await tx.bet.update({
      where: { id: betId },
      data: {
        status: BetStatus.RESULT_REPORTED,
        outcome,
        resultReportedAt: new Date(),
        resultIdempotencyKey: `demo_settle_inline_${betId}`,
      },
    });
  } else if (bet.status !== BetStatus.RESULT_REPORTED) {
    throw new SettleError(`Bet is in ${bet.status} status, cannot settle`);
  }

  if (!outcome) throw new SettleError("Bet has no outcome set");
  if (!bet.playerBId) throw new SettleError("Bet has no player B");
  const playerBId = bet.playerBId;

  await tx.bet.update({ where: { id: betId }, data: { resultVerified: true } });

  const escrowAccount = await getEscrowAccountForBet(tx, betId);
  const escrowBalance = await getAccountBalance(tx, escrowAccount.id);
  const pot = new Decimal(bet.amount.toString()).mul(2);
  if (!escrowBalance.eq(pot)) {
    throw new Error(`Escrow balance mismatch: expected ${pot}, got ${escrowBalance}`);
  }

  const feeAmount = pot
    .mul(new Decimal(bet.platformFeePercent.toString()))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  if (feeAmount.gt(0)) {
    await collectFee(tx, { betId, feeAmount, idempotencyKey: `demo_settle_${betId}_fee` });
  }

  const revSharePercent = new Decimal(bet.game.developerProfile.revSharePercent.toString());
  if (revSharePercent.gt(0) && feeAmount.gt(0)) {
    const devShareAmount = feeAmount.mul(revSharePercent).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    if (devShareAmount.gt(0)) {
      await distributeDevShare(tx, {
        developerUserId: bet.game.developerProfile.userId,
        amount: devShareAmount,
        idempotencyKey: `demo_settle_${betId}_devshare`,
      });
    }
  }

  const remainingEscrow = pot.sub(feeAmount);
  let winnerPayout: number;
  if (outcome === BetOutcome.DRAW) {
    const playerAPayout = remainingEscrow.div(2).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    await releaseEscrow(tx, {
      betId,
      winnerId: bet.playerAId,
      amount: playerAPayout,
      idempotencyKey: `demo_settle_${betId}_release_a`,
    });
    await releaseEscrow(tx, {
      betId,
      winnerId: playerBId,
      amount: remainingEscrow.sub(playerAPayout),
      idempotencyKey: `demo_settle_${betId}_release_b`,
    });
    winnerPayout = playerAPayout.toNumber();
  } else {
    await releaseEscrow(tx, {
      betId,
      winnerId: outcome === BetOutcome.PLAYER_A_WIN ? bet.playerAId : playerBId,
      amount: remainingEscrow,
      idempotencyKey: `demo_settle_${betId}_release`,
    });
    winnerPayout = remainingEscrow.toNumber();
  }

  const finalBalance = await getAccountBalance(tx, escrowAccount.id);
  if (!finalBalance.eq(0)) {
    throw new Error(`INVARIANT VIOLATION: Escrow balance is ${finalBalance} after settlement, expected 0`);
  }

  await tx.bet.update({
    where: { id: betId },
    data: { status: BetStatus.SETTLED, settledAt: new Date(), platformFeeAmount: feeAmount },
  });

  if (bet.game.developerProfile.escrowLimit) {
    await tx.$executeRaw`
      UPDATE developer_escrow_limits
      SET current_escrow = GREATEST(current_escrow - ${pot}::decimal, 0),
          updated_at = NOW()
      WHERE id = ${bet.game.developerProfile.escrowLimit.id}::uuid
    `;
  }

  return { outcome, winnerPayout, alreadySettled: false };
}
