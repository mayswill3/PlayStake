import { NextRequest, NextResponse } from "next/server";
import { BetStatus } from "../../../../../../generated/prisma/client.js";
import {
  authenticateApiKey,
  verifyDeveloperOwnsBet,
} from "../../../../../lib/auth/dev-api.js";
import { prisma, withTransaction, type TxClient } from "../../../../../lib/db/client.js";
import { refundEscrow } from "../../../../../lib/ledger/escrow.js";
import { apiRateLimit } from "../../../../../lib/middleware/rate-limit.js";
import { validateBody } from "../../../../../lib/middleware/validate.js";
import { cancelBetSchema } from "../../../../../lib/validation/schemas.js";
import {
  errorResponse,
  AppError,
} from "../../../../../lib/errors/index.js";

// ---------------------------------------------------------------------------
// POST /api/v1/bets/:betId/cancel - Cancel a bet
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ betId: string }> }
) {
  try {
    const rateLimited = apiRateLimit(request);
    if (rateLimited) return rateLimited;

    const auth = await authenticateApiKey(request, ["bet:create"]);
    const { betId } = await params;

    const body = await request.json();
    const input = validateBody(cancelBetSchema, body);

    // Verify developer owns the bet's game
    const { bet } = await verifyDeveloperOwnsBet(
      auth.developerProfileId,
      betId
    );

    // Can only cancel PENDING_CONSENT or OPEN bets
    if (
      bet.status !== BetStatus.PENDING_CONSENT &&
      bet.status !== BetStatus.OPEN
    ) {
      throw new AppError(
        `Cannot cancel bet in ${bet.status} status. Only PENDING_CONSENT or OPEN bets can be cancelled.`,
        400,
        "INVALID_BET_STATUS"
      );
    }

    const now = new Date();

    if (bet.status === BetStatus.PENDING_CONSENT) {
      // No escrow to refund -- just mark as cancelled
      const updatedBet = await prisma.bet.update({
        where: { id: betId },
        data: {
          status: BetStatus.CANCELLED,
          cancelledAt: now,
        },
      });

      return NextResponse.json({
        betId: updatedBet.id,
        status: updatedBet.status,
        refundTransactionId: null,
      });
    }

    // bet.status === OPEN -- refund Player A's escrow
    const result = await withTransaction(async (tx: TxClient) => {
      // Refund escrow to Player A
      const refundResult = await refundEscrow(tx, {
        betId: bet.id,
        playerId: bet.playerAId,
        amount: bet.amount,
        idempotencyKey: input.idempotencyKey,
      });

      // Transition to CANCELLED
      const updatedBet = await tx.bet.update({
        where: { id: bet.id },
        data: {
          status: BetStatus.CANCELLED,
          cancelledAt: now,
        },
      });

      return {
        bet: updatedBet,
        refundTransactionId: refundResult.transaction.id,
      };
    });

    return NextResponse.json({
      betId: result.bet.id,
      status: result.bet.status,
      refundTransactionId: result.refundTransactionId,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
