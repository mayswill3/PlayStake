import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/client.js";
import { validateSession } from "../../../../lib/auth/session.js";
import { getSessionToken } from "../../../../lib/auth/helpers.js";
import { dollarsToCents } from "../../../../lib/utils/money.js";
import {
  errorResponse,
  AuthenticationError,
  NotFoundError,
  AuthorizationError,
} from "../../../../lib/errors/index.js";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const { id } = await params;

    const bet = await prisma.bet.findUnique({
      where: { id },
      include: {
        game: { select: { id: true, name: true, logoUrl: true } },
        playerA: { select: { id: true, displayName: true } },
        playerB: { select: { id: true, displayName: true } },
      },
    });

    if (!bet) {
      throw new NotFoundError("Bet not found");
    }

    // Verify user is a participant
    if (
      bet.playerAId !== session.userId &&
      bet.playerBId !== session.userId
    ) {
      throw new AuthorizationError("You are not a participant in this bet");
    }

    return NextResponse.json({
      id: bet.id,
      externalId: bet.externalId,
      game: {
        id: bet.game.id,
        name: bet.game.name,
        logoUrl: bet.game.logoUrl,
      },
      playerA: {
        id: bet.playerA.id,
        displayName: bet.playerA.displayName,
      },
      playerB: bet.playerB
        ? {
            id: bet.playerB.id,
            displayName: bet.playerB.displayName,
          }
        : null,
      amount: dollarsToCents(bet.amount),
      currency: bet.currency,
      status: bet.status,
      outcome: bet.outcome,
      platformFeeAmount: bet.platformFeeAmount
        ? dollarsToCents(bet.platformFeeAmount)
        : null,
      gameMetadata: bet.gameMetadata,
      resultPayload: bet.resultPayload,
      createdAt: bet.createdAt.toISOString(),
      matchedAt: bet.matchedAt?.toISOString() ?? null,
      resultReportedAt: bet.resultReportedAt?.toISOString() ?? null,
      settledAt: bet.settledAt?.toISOString() ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
