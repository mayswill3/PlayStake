import { NextRequest, NextResponse } from "next/server";
import { prisma, withTransaction, type TxClient } from "@/lib/db/client";
import { refundEscrow } from "@/lib/ledger/escrow";
import { BetStatus } from "../../../../../generated/prisma/client";

/**
 * POST /api/demo/cleanup-bets
 *
 * Demo-only endpoint that voids stale bets and refunds escrowed funds.
 * Called on page refresh so the widget starts with a clean state.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { playerId, gameId } = body;

  if (!playerId || !gameId) {
    return NextResponse.json(
      { error: "playerId and gameId required" },
      { status: 400 }
    );
  }

  // Void unmatched bets immediately, and orphaned matched/reported bets after 10 min
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);

  const staleBets = await prisma.bet.findMany({
    where: {
      OR: [
        // Unmatched bets — always safe to void
        {
          status: { in: [BetStatus.PENDING_CONSENT, BetStatus.OPEN] },
          OR: [{ playerAId: playerId }, { playerBId: playerId }],
        },
        // Orphaned matched/reported bets — only if older than 10 minutes
        // (game session is gone after server restart, bet can't settle)
        {
          status: { in: [BetStatus.MATCHED, BetStatus.RESULT_REPORTED] },
          OR: [{ playerAId: playerId }, { playerBId: playerId }],
          updatedAt: { lt: tenMinAgo },
        },
      ],
    },
    select: {
      id: true,
      status: true,
      amount: true,
      playerAId: true,
      playerBId: true,
    },
  });

  if (staleBets.length === 0) {
    return NextResponse.json({ voidedCount: 0, bets: [] });
  }

  const voidedBets: { betId: string; previousStatus: string }[] = [];

  for (const bet of staleBets) {
    try {
      await withTransaction(async (tx: TxClient) => {
        // Set status to VOIDED first (required for refundEscrow on RESULT_REPORTED bets)
        await tx.bet.update({
          where: { id: bet.id },
          data: { status: BetStatus.VOIDED },
        });

        // Skip refund for PENDING_CONSENT — no escrow account exists yet
        if (bet.status === BetStatus.PENDING_CONSENT) {
          return;
        }

        // Refund Player A
        try {
          await refundEscrow(tx, {
            betId: bet.id,
            playerId: bet.playerAId,
            amount: bet.amount,
            idempotencyKey: `cleanup-refund-a-${bet.id}`,
          });
        } catch {
          // Escrow account may not exist or balance may already be zero
        }

        // Refund Player B (for MATCHED/RESULT_REPORTED bets)
        if (bet.playerBId) {
          try {
            await refundEscrow(tx, {
              betId: bet.id,
              playerId: bet.playerBId,
              amount: bet.amount,
              idempotencyKey: `cleanup-refund-b-${bet.id}`,
            });
          } catch {
            // Escrow account may not exist or balance may already be zero
          }
        }
      });

      voidedBets.push({ betId: bet.id, previousStatus: bet.status });
    } catch {
      // If the entire transaction fails, skip this bet
    }
  }

  return NextResponse.json({ voidedCount: voidedBets.length, bets: voidedBets });
}
