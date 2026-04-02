import { NextRequest, NextResponse } from "next/server";
import { Decimal } from "@prisma/client/runtime/client";
import { BetStatus, BetOutcome } from "../../../../../generated/prisma/client";
import { prisma, withTransaction, type TxClient } from "@/lib/db/client";
import { validateApiKey } from "@/lib/auth/api-key";
import {
  collectFee,
  releaseEscrow,
  distributeDevShare,
} from "@/lib/ledger/escrow";
import {
  getEscrowAccountForBet,
  getAccountBalance,
} from "@/lib/ledger/accounts";

/**
 * POST /api/demo/settle-bet
 *
 * Demo-only endpoint that settles a bet in a single step, bypassing the
 * widget confirm/dispute flow and the settlement worker. This makes the
 * demo self-contained — no background workers required.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { betId, apiKey } = body;

  if (!betId || !apiKey) {
    return NextResponse.json(
      { error: "betId and apiKey required" },
      { status: 400 }
    );
  }

  // Verify API key belongs to a valid developer
  const validKey = await validateApiKey(apiKey);
  if (!validKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  // Load the bet
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    include: {
      game: {
        include: {
          developerProfile: {
            include: { escrowLimit: true },
          },
        },
      },
    },
  });

  if (!bet) {
    return NextResponse.json({ error: "Bet not found" }, { status: 404 });
  }

  if (bet.status !== BetStatus.RESULT_REPORTED) {
    return NextResponse.json(
      { error: `Bet is in ${bet.status} status, expected RESULT_REPORTED` },
      { status: 400 }
    );
  }

  if (!bet.outcome) {
    return NextResponse.json(
      { error: "Bet has no outcome set" },
      { status: 400 }
    );
  }

  if (!bet.playerBId) {
    return NextResponse.json(
      { error: "Bet has no player B" },
      { status: 400 }
    );
  }

  const playerBId: string = bet.playerBId;
  let winnerPayout = 0;

  await withTransaction(
    async (tx: TxClient) => {
      // 1. Mark result as verified (skip widget confirm step for demo)
      await tx.bet.update({
        where: { id: betId },
        data: { resultVerified: true },
      });

      // 2. Read escrow balance and verify it equals pot
      const escrowAccount = await getEscrowAccountForBet(tx, betId);
      const escrowBalance = await getAccountBalance(tx, escrowAccount.id);
      const pot = new Decimal(bet.amount.toString()).mul(2);

      if (!escrowBalance.eq(pot)) {
        throw new Error(
          `Escrow balance mismatch: expected ${pot}, got ${escrowBalance}`
        );
      }

      const feePercent = new Decimal(bet.platformFeePercent.toString());

      // 3. Calculate and collect platform fee
      const feeAmount = pot
        .mul(feePercent)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      if (feeAmount.gt(0)) {
        await collectFee(tx, {
          betId,
          feeAmount,
          idempotencyKey: `demo_settle_${betId}_fee`,
        });
      }

      // 4. Developer revenue share
      const revSharePercent = new Decimal(
        bet.game.developerProfile.revSharePercent.toString()
      );

      if (revSharePercent.gt(0) && feeAmount.gt(0)) {
        const devShareAmount = feeAmount
          .mul(revSharePercent)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        if (devShareAmount.gt(0)) {
          await distributeDevShare(tx, {
            developerUserId: bet.game.developerProfile.userId,
            amount: devShareAmount,
            idempotencyKey: `demo_settle_${betId}_devshare`,
          });
        }
      }

      // 5. Release escrow to winner(s)
      const remainingEscrow = pot.sub(feeAmount);
      const outcome = bet.outcome as BetOutcome;

      if (outcome === BetOutcome.DRAW) {
        const halfPayout = remainingEscrow
          .div(2)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        const playerAPayout = halfPayout;
        const playerBPayout = remainingEscrow.sub(playerAPayout);

        await releaseEscrow(tx, {
          betId,
          winnerId: bet.playerAId,
          amount: playerAPayout,
          idempotencyKey: `demo_settle_${betId}_release_a`,
        });

        await releaseEscrow(tx, {
          betId,
          winnerId: playerBId,
          amount: playerBPayout,
          idempotencyKey: `demo_settle_${betId}_release_b`,
        });

        winnerPayout = playerAPayout.toNumber();
      } else {
        const winnerId =
          outcome === BetOutcome.PLAYER_A_WIN
            ? bet.playerAId
            : playerBId;

        console.log("[PAYOUT]", {
          betId,
          outcome,
          winnerId,
          loserId: winnerId === bet.playerAId ? playerBId : bet.playerAId,
          playerAId: bet.playerAId,
          playerBId,
          amount: remainingEscrow.toString(),
        });

        await releaseEscrow(tx, {
          betId,
          winnerId,
          amount: remainingEscrow,
          idempotencyKey: `demo_settle_${betId}_release`,
        });

        winnerPayout = remainingEscrow.toNumber();
      }

      // 6. Verify escrow is drained
      const finalBalance = await getAccountBalance(tx, escrowAccount.id);
      if (!finalBalance.eq(0)) {
        throw new Error(
          `INVARIANT VIOLATION: Escrow balance is ${finalBalance} after settlement, expected 0`
        );
      }

      // 7. Update bet status to SETTLED
      await tx.bet.update({
        where: { id: betId },
        data: {
          status: BetStatus.SETTLED,
          settledAt: new Date(),
          platformFeeAmount: feeAmount,
        },
      });

      // 8. Decrement developer escrow limit
      if (bet.game.developerProfile.escrowLimit) {
        await tx.$executeRaw`
          UPDATE developer_escrow_limits
          SET current_escrow = GREATEST(current_escrow - ${pot}::decimal, 0),
              updated_at = NOW()
          WHERE id = ${bet.game.developerProfile.escrowLimit.id}::uuid
        `;
      }
    },
    { timeout: 30_000 }
  );

  return NextResponse.json({
    success: true,
    betId,
    outcome: bet.outcome,
    winnerPayout,
  });
}
