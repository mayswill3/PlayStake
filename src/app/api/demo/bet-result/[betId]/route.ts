import { NextResponse } from "next/server";
import { withSessionAuth } from "@/lib/middleware/auth";
import { prisma } from "@/lib/db/client";
import { errorResponse, NotFoundError, ValidationError } from "@/lib/errors";
import { assertParticipant } from "@/lib/demo/access";
import { dollarsToCents } from "@/lib/utils/money";

/**
 * GET /api/demo/bet-result/:betId
 *
 * Outcome and payout for an already-settled bet, for the player who arrives
 * second and finds the other has already settled. Only the two players may
 * read it — bet ids are not secrets, and a stranger has no business with
 * someone else's result.
 */
export const GET = withSessionAuth(async (_request, context, auth) => {
  try {
    const betId = context.params?.betId;
    if (!betId) throw new NotFoundError("Bet not found");

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
    if (!bet) throw new NotFoundError("Bet not found");
    assertParticipant(auth.userId, bet, "this bet");

    if (bet.status !== "SETTLED" || !bet.outcome) {
      throw new ValidationError("Bet not settled");
    }

    const amountCents = dollarsToCents(bet.amount);
    const feeCents = bet.platformFeeAmount ? dollarsToCents(bet.platformFeeAmount) : 0;
    const winnerPayout = (amountCents * 2 - feeCents) / 100;

    return NextResponse.json({ outcome: bet.outcome, winnerPayout });
  } catch (error) {
    return errorResponse(error);
  }
});
