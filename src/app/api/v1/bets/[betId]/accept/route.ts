import { NextRequest, NextResponse } from "next/server";
import { BetStatus } from "../../../../../../generated/prisma/client";
import { authenticateWidget } from "../../../../../lib/auth/dev-api";
import { withTransaction, type TxClient } from "../../../../../lib/db/client";
import { prisma } from "../../../../../lib/db/client";
import { holdEscrow } from "../../../../../lib/ledger/escrow";
import { apiRateLimit } from "../../../../../lib/middleware/rate-limit";
import { validateBody } from "../../../../../lib/middleware/validate";
import { acceptBetSchema } from "../../../../../lib/validation/schemas";
import { dollarsToCents } from "../../../../../lib/utils/money";
import {
  errorResponse,
  AppError,
  NotFoundError,
} from "../../../../../lib/errors/index";

// ---------------------------------------------------------------------------
// POST /api/v1/bets/:betId/accept - Player B accepts the bet
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ betId: string }> }
) {
  try {
    const rateLimited = apiRateLimit(request);
    if (rateLimited) return rateLimited;

    // Widget token auth -- Player B is identified from the token
    const widgetAuth = await authenticateWidget(request);
    const { betId } = await params;

    const body = await request.json();
    const input = validateBody(acceptBetSchema, body);

    // Fetch the bet
    const bet = await prisma.bet.findUnique({
      where: { id: betId },
      include: {
        playerA: { select: { id: true, displayName: true } },
      },
    });

    if (!bet) {
      throw new NotFoundError(`Bet ${betId} not found`);
    }

    // Verify bet is in OPEN status
    if (bet.status !== BetStatus.OPEN) {
      throw new AppError(
        `Bet is in ${bet.status} status, expected OPEN`,
        400,
        "INVALID_BET_STATUS"
      );
    }

    // Verify bet hasn't expired
    if (bet.expiresAt < new Date()) {
      throw new AppError(
        "Bet has expired",
        410,
        "BET_EXPIRED"
      );
    }

    // Self-bet prevention: playerB cannot be playerA
    if (widgetAuth.userId === bet.playerAId) {
      throw new AppError(
        "A player cannot accept their own bet",
        400,
        "SELF_BET_PROHIBITED"
      );
    }

    // Fetch Player B details
    const playerB = await prisma.user.findUnique({
      where: { id: widgetAuth.userId },
      select: { id: true, displayName: true },
    });

    // Execute escrow for Player B and match the bet
    const result = await withTransaction(async (tx: TxClient) => {
      // Hold escrow for Player B
      const escrowResult = await holdEscrow(tx, {
        playerId: widgetAuth.userId,
        betId: bet.id,
        amount: bet.amount,
        idempotencyKey: input.idempotencyKey,
      });

      // Transition bet to MATCHED, set playerBId from widget token
      const updatedBet = await tx.bet.update({
        where: { id: bet.id },
        data: {
          status: BetStatus.MATCHED,
          playerBId: widgetAuth.userId,
          playerBConsentedAt: new Date(),
          matchedAt: new Date(),
        },
      });

      return {
        bet: updatedBet,
        escrowTransactionId: escrowResult.transaction.id,
      };
    });

    return NextResponse.json({
      betId: result.bet.id,
      status: result.bet.status,
      playerA: bet.playerA
        ? { id: bet.playerA.id, displayName: bet.playerA.displayName }
        : null,
      playerB: playerB
        ? { id: playerB.id, displayName: playerB.displayName }
        : null,
      matchedAt: result.bet.matchedAt?.toISOString() ?? null,
      escrowTransactionId: result.escrowTransactionId,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
