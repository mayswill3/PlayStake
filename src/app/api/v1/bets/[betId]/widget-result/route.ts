import { NextRequest, NextResponse } from "next/server";
import { BetStatus, AnomalyType, AnomalyStatus } from "../../../../../../../generated/prisma/client";
import { authenticateWidget } from "../../../../../../lib/auth/dev-api";
import { prisma } from "../../../../../../lib/db/client";
import { apiRateLimit } from "../../../../../../lib/middleware/rate-limit";
import { validateBody } from "../../../../../../lib/middleware/validate";
import { widgetResultSchema } from "../../../../../../lib/validation/schemas";
import { sha256Hash } from "../../../../../../lib/utils/crypto";
import {
  errorResponse,
  AppError,
  NotFoundError,
  AuthorizationError,
  ConflictError,
} from "../../../../../../lib/errors/index";

// ---------------------------------------------------------------------------
// POST /api/v1/bets/:betId/widget-result - Widget submits result for
// dual-source verification
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ betId: string }> }
) {
  try {
    const rateLimited = apiRateLimit(request);
    if (rateLimited) return rateLimited;

    // Widget token auth
    const widgetAuth = await authenticateWidget(request);
    const { betId } = await params;

    const body = await request.json();
    const input = validateBody(widgetResultSchema, body);

    // Fetch the bet with game info
    const bet = await prisma.bet.findUnique({
      where: { id: betId },
      include: { game: true },
    });

    if (!bet) {
      throw new NotFoundError(`Bet ${betId} not found`);
    }

    // Verify player is a participant in this bet
    if (
      widgetAuth.userId !== bet.playerAId &&
      widgetAuth.userId !== bet.playerBId
    ) {
      throw new AuthorizationError(
        "Only bet participants can submit widget results"
      );
    }

    // Verify bet is in RESULT_REPORTED status
    if (bet.status !== BetStatus.RESULT_REPORTED) {
      throw new AppError(
        `Bet is in ${bet.status} status, expected RESULT_REPORTED`,
        400,
        "INVALID_BET_STATUS"
      );
    }

    // Check if widget result was already submitted
    if (bet.widgetResultHash) {
      throw new ConflictError(
        "Widget result already submitted for this bet"
      );
    }

    // Compute widget result hash for audit trail
    const widgetResultHash = sha256Hash(betId + input.outcome);

    // Compare outcomes directly (simplest approach per spec)
    // The server hash includes the idempotency key so we cannot compare
    // hashes directly. Instead, compare the outcome strings.
    const outcomesMatch = bet.outcome === input.outcome;

    if (outcomesMatch) {
      // Results agree -- mark as verified
      await prisma.bet.update({
        where: { id: betId },
        data: {
          widgetResultHash,
          resultVerified: true,
        },
      });

      const settlementEstimate = new Date(
        Date.now() + 2 * 60 * 1000
      ).toISOString();

      return NextResponse.json({
        betId: bet.id,
        resultVerified: true,
        mismatch: false,
        settlementEstimate,
      });
    } else {
      // Results disagree -- transition to DISPUTED and create anomaly alert
      await prisma.bet.update({
        where: { id: betId },
        data: {
          status: BetStatus.DISPUTED,
          widgetResultHash,
          resultVerified: false,
        },
      });

      // Create anomaly alert for the mismatch
      await prisma.anomalyAlert.create({
        data: {
          developerProfileId: bet.game.developerProfileId,
          gameId: bet.gameId,
          type: AnomalyType.RESULT_HASH_MISMATCH,
          status: AnomalyStatus.DETECTED,
          severity: "HIGH",
          details: {
            betId: bet.id,
            serverOutcome: bet.outcome,
            widgetOutcome: input.outcome,
            serverResultHash: bet.serverResultHash,
            widgetResultHash,
            reportedBy: widgetAuth.userId,
          },
        },
      });

      return NextResponse.json({
        betId: bet.id,
        resultVerified: false,
        mismatch: true,
        status: BetStatus.DISPUTED,
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
