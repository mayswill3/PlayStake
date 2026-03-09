import { NextRequest, NextResponse } from "next/server";
import { Decimal } from "@prisma/client/runtime/client";
import { prisma } from "../../../../lib/db/client.js";
import { BetStatus } from "../../../../../generated/prisma/client.js";
import { validateSession } from "../../../../lib/auth/session.js";
import { getSessionToken } from "../../../../lib/auth/helpers.js";
import { dollarsToCents } from "../../../../lib/utils/money.js";
import { errorResponse, AuthenticationError } from "../../../../lib/errors/index.js";

export async function GET(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const userId = session.userId;

    // All bets where the user is a participant
    const allBets = await prisma.bet.findMany({
      where: {
        OR: [{ playerAId: userId }, { playerBId: userId }],
        status: {
          notIn: [BetStatus.PENDING_CONSENT, BetStatus.CANCELLED],
        },
      },
      select: {
        id: true,
        playerAId: true,
        playerBId: true,
        amount: true,
        status: true,
        outcome: true,
        platformFeeAmount: true,
      },
    });

    let wins = 0;
    let losses = 0;
    let draws = 0;
    let totalWagered = 0;
    let totalWon = 0;
    let totalLost = 0;
    let activeBets = 0;

    const activeStatuses = new Set<string>([
      BetStatus.OPEN,
      BetStatus.MATCHED,
      BetStatus.RESULT_REPORTED,
      BetStatus.DISPUTED,
    ]);

    for (const bet of allBets) {
      const amountCents = dollarsToCents(bet.amount);
      const feeCents = bet.platformFeeAmount
        ? dollarsToCents(bet.platformFeeAmount)
        : 0;

      if (activeStatuses.has(bet.status)) {
        activeBets++;
      }

      // Only count wagered/results for settled bets
      if (bet.status === BetStatus.SETTLED && bet.outcome) {
        totalWagered += amountCents;
        const myRole =
          bet.playerAId === userId ? "PLAYER_A" : "PLAYER_B";

        if (bet.outcome === "DRAW") {
          draws++;
          // In a draw, you get back your stake minus half the fee
          const halfFee = Math.round(feeCents / 2);
          totalLost += halfFee;
        } else if (
          (bet.outcome === "PLAYER_A_WIN" && myRole === "PLAYER_A") ||
          (bet.outcome === "PLAYER_B_WIN" && myRole === "PLAYER_B")
        ) {
          wins++;
          // Won: gain the opponent's stake minus fees
          totalWon += amountCents - feeCents;
        } else {
          losses++;
          totalLost += amountCents;
        }
      }
    }

    const totalBets = wins + losses + draws;
    const winRate = totalBets > 0 ? Math.round((wins / totalBets) * 1000) / 1000 : 0;
    const netProfit = totalWon - totalLost;

    return NextResponse.json({
      totalBets,
      wins,
      losses,
      draws,
      winRate,
      totalWagered,
      totalWon,
      totalLost,
      netProfit,
      activeBets,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
