import { NextRequest, NextResponse } from "next/server";
import { BetStatus } from "../../../../../../../generated/prisma/client";
import { authenticateWidget } from "../../../../../../lib/auth/dev-api";
import { withTransaction, type TxClient } from "../../../../../../lib/db/client";
import { prisma } from "../../../../../../lib/db/client";
import { holdEscrow } from "../../../../../../lib/ledger/escrow";
import { apiRateLimit } from "../../../../../../lib/middleware/rate-limit";
import { validateBody } from "../../../../../../lib/middleware/validate";
import { consentBetSchema } from "../../../../../../lib/validation/schemas";
import { dollarsToCents } from "../../../../../../lib/utils/money";
import {
  errorResponse,
  AppError,
  NotFoundError,
  AuthorizationError,
} from "../../../../../../lib/errors/index";

// ---------------------------------------------------------------------------
// POST /api/v1/bets/:betId/consent - Player A consents to the bet
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ betId: string }> }
) {
  try {
    const rateLimited = apiRateLimit(request);
    if (rateLimited) return rateLimited;

    // Widget token auth -- proves it is the actual player
    const widgetAuth = await authenticateWidget(request);
    const { betId } = await params;

    const body = await request.json();
    const input = validateBody(consentBetSchema, body);

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

    // Verify the authenticated player is playerA for this bet
    if (widgetAuth.userId !== bet.playerAId) {
      throw new AuthorizationError(
        "Only the proposing player (Player A) can consent to this bet"
      );
    }

    // Verify bet is in PENDING_CONSENT status
    if (bet.status !== BetStatus.PENDING_CONSENT) {
      throw new AppError(
        `Bet is in ${bet.status} status, expected PENDING_CONSENT`,
        400,
        "INVALID_BET_STATUS"
      );
    }

    // Verify consent hasn't expired
    if (bet.consentExpiresAt && bet.consentExpiresAt < new Date()) {
      throw new AppError(
        "Consent window has expired",
        400,
        "CONSENT_EXPIRED"
      );
    }

    // Execute escrow and status transition inside a transaction
    const result = await withTransaction(async (tx: TxClient) => {
      // Hold escrow for Player A
      const escrowResult = await holdEscrow(tx, {
        playerId: bet.playerAId,
        betId: bet.id,
        amount: bet.amount,
        idempotencyKey: input.idempotencyKey,
      });

      // Transition bet to OPEN
      const updatedBet = await tx.bet.update({
        where: { id: bet.id },
        data: {
          status: BetStatus.OPEN,
          playerAConsentedAt: new Date(),
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
      amount: dollarsToCents(result.bet.amount),
      escrowTransactionId: result.escrowTransactionId,
      playerA: bet.playerA
        ? { id: bet.playerA.id, displayName: bet.playerA.displayName }
        : null,
      expiresAt: result.bet.expiresAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
