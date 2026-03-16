import { NextRequest, NextResponse } from "next/server";
import { BetStatus, BetOutcome } from "../../../../../../generated/prisma/client";
import {
  authenticateApiKey,
  verifyDeveloperOwnsBet,
} from "../../../../../lib/auth/dev-api";
import { prisma } from "../../../../../lib/db/client";
import { apiRateLimit } from "../../../../../lib/middleware/rate-limit";
import { validateBody } from "../../../../../lib/middleware/validate";
import { reportResultSchema } from "../../../../../lib/validation/schemas";
import { sha256Hash } from "../../../../../lib/utils/crypto";
import {
  errorResponse,
  AppError,
  ConflictError,
} from "../../../../../lib/errors/index";

// ---------------------------------------------------------------------------
// POST /api/v1/bets/:betId/result - Game server reports match result
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ betId: string }> }
) {
  try {
    const rateLimited = apiRateLimit(request);
    if (rateLimited) return rateLimited;

    const auth = await authenticateApiKey(request, ["result:report"]);
    const { betId } = await params;

    const body = await request.json();
    const input = validateBody(reportResultSchema, body);

    // Verify developer owns the bet's game
    const { bet } = await verifyDeveloperOwnsBet(
      auth.developerProfileId,
      betId
    );

    // Check if result was already reported with same idempotency key
    if (
      bet.resultIdempotencyKey &&
      bet.resultIdempotencyKey === input.idempotencyKey
    ) {
      // Idempotent replay -- return original response
      return NextResponse.json({
        betId: bet.id,
        status: bet.status,
        outcome: bet.outcome,
        resultVerified: bet.resultVerified,
        resultReportedAt: bet.resultReportedAt?.toISOString() ?? null,
      });
    }

    // Verify bet is in MATCHED status
    if (bet.status !== BetStatus.MATCHED) {
      throw new AppError(
        `Bet is in ${bet.status} status, expected MATCHED`,
        400,
        "INVALID_BET_STATUS"
      );
    }

    // Check for double-report with different idempotency key
    if (bet.resultIdempotencyKey) {
      throw new ConflictError(
        "Result already reported for this bet"
      );
    }

    // Compute server result hash for dual-source verification
    const serverResultHash = sha256Hash(
      betId + input.outcome + input.idempotencyKey
    );

    const now = new Date();

    // Update bet with result
    const updatedBet = await prisma.bet.update({
      where: { id: betId },
      data: {
        status: BetStatus.RESULT_REPORTED,
        outcome: input.outcome as BetOutcome,
        resultPayload: input.resultPayload ?? undefined,
        resultReportedAt: now,
        resultIdempotencyKey: input.idempotencyKey,
        serverResultHash,
      },
    });

    // Estimate settlement time: 2 minutes after widget verification
    const settlementEstimate = new Date(
      now.getTime() + 2 * 60 * 1000
    ).toISOString();

    return NextResponse.json({
      betId: updatedBet.id,
      status: updatedBet.status,
      outcome: updatedBet.outcome,
      resultVerified: false,
      resultReportedAt: updatedBet.resultReportedAt?.toISOString() ?? null,
      settlementEstimate,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
