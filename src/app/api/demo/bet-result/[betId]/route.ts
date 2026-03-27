import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { dollarsToCents } from "@/lib/utils/money";

/**
 * GET /api/demo/bet-result/:betId
 *
 * Returns the outcome and payout for an already-settled bet.
 * Used when the second player tries to settle but the bet was
 * already settled by the first player.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ betId: string }> }
) {
  const { betId } = await params;

  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    select: {
      status: true,
      outcome: true,
      amount: true,
      platformFeeAmount: true,
      playerAId: true,
      playerBId: true,
    },
  });

  if (!bet) {
    return NextResponse.json({ error: "Bet not found" }, { status: 404 });
  }

  if (bet.status !== "SETTLED" || !bet.outcome) {
    return NextResponse.json({ error: "Bet not settled" }, { status: 400 });
  }

  const amountCents = dollarsToCents(bet.amount);
  const feeCents = bet.platformFeeAmount ? dollarsToCents(bet.platformFeeAmount) : 0;
  const pot = amountCents * 2;
  const winnerPayout = (pot - feeCents) / 100; // back to dollars

  return NextResponse.json({
    outcome: bet.outcome,
    winnerPayout,
  });
}
