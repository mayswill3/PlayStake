import { NextRequest, NextResponse } from "next/server";
import { Decimal } from "@prisma/client/runtime/client";
import { prisma } from "../../../lib/db/client";
import { type BetStatus, type BetOutcome } from "../../../../generated/prisma/client";
import { validateSession } from "../../../lib/auth/session";
import { getSessionToken } from "../../../lib/auth/helpers";
import { betListQuerySchema } from "../../../lib/validation/schemas";
import { validateQuery } from "../../../lib/middleware/validate";
import { dollarsToCents } from "../../../lib/utils/money";
import { errorResponse, AuthenticationError } from "../../../lib/errors/index";

export async function GET(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const url = new URL(request.url);
    const query = validateQuery(betListQuerySchema, url.searchParams);

    const where: Record<string, unknown> = {
      OR: [
        { playerAId: session.userId },
        { playerBId: session.userId },
      ],
    };

    if (query.status) {
      where.status = query.status as BetStatus;
    }
    if (query.gameId) {
      where.gameId = query.gameId;
    }

    const [bets, totalCount] = await Promise.all([
      prisma.bet.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          game: { select: { id: true, name: true } },
          playerA: { select: { id: true, displayName: true } },
          playerB: { select: { id: true, displayName: true } },
        },
      }),
      prisma.bet.count({ where }),
    ]);

    const data = bets.map((bet) => {
      const myRole =
        bet.playerAId === session.userId ? "PLAYER_A" : "PLAYER_B";
      const opponent =
        myRole === "PLAYER_A"
          ? bet.playerB
            ? { id: bet.playerB.id, displayName: bet.playerB.displayName }
            : null
          : { id: bet.playerA.id, displayName: bet.playerA.displayName };

      // Calculate netResult for settled bets
      let netResult: number | null = null;
      if (bet.outcome && bet.status === "SETTLED") {
        const amountCents = dollarsToCents(bet.amount);
        const feeCents = bet.platformFeeAmount
          ? dollarsToCents(bet.platformFeeAmount)
          : 0;

        if (bet.outcome === "DRAW") {
          // In a draw, each player gets back their stake minus half the fee
          netResult = Math.round(-feeCents / 2);
        } else if (
          (bet.outcome === "PLAYER_A_WIN" && myRole === "PLAYER_A") ||
          (bet.outcome === "PLAYER_B_WIN" && myRole === "PLAYER_B")
        ) {
          // Won: gain opponent's stake minus fees
          netResult = amountCents - feeCents;
        } else {
          // Lost: lose entire stake
          netResult = -amountCents;
        }
      }

      return {
        id: bet.id,
        gameId: bet.game.id,
        gameName: bet.game.name,
        opponent,
        amount: dollarsToCents(bet.amount),
        status: bet.status,
        outcome: bet.outcome,
        myRole,
        netResult,
        createdAt: bet.createdAt.toISOString(),
        settledAt: bet.settledAt?.toISOString() ?? null,
      };
    });

    return NextResponse.json({
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalCount,
        totalPages: Math.ceil(totalCount / query.limit),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
