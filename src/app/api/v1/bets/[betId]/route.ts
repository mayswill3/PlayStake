import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, verifyDeveloperOwnsBet } from "../../../../../lib/auth/dev-api.js";
import { apiRateLimit } from "../../../../../lib/middleware/rate-limit.js";
import { dollarsToCents } from "../../../../../lib/utils/money.js";
import { errorResponse } from "../../../../../lib/errors/index.js";

// ---------------------------------------------------------------------------
// GET /api/v1/bets/:betId - Get bet details
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ betId: string }> }
) {
  try {
    const rateLimited = apiRateLimit(request);
    if (rateLimited) return rateLimited;

    const auth = await authenticateApiKey(request, ["bet:read"]);
    const { betId } = await params;

    // Verify developer owns the bet's game
    const { bet } = await verifyDeveloperOwnsBet(
      auth.developerProfileId,
      betId
    );

    return NextResponse.json({
      betId: bet.id,
      externalId: bet.externalId,
      gameId: bet.gameId,
      status: bet.status,
      amount: dollarsToCents(bet.amount),
      currency: bet.currency,
      playerA: (bet as any).playerA
        ? { id: (bet as any).playerA.id, displayName: (bet as any).playerA.displayName }
        : null,
      playerB: (bet as any).playerB
        ? { id: (bet as any).playerB.id, displayName: (bet as any).playerB.displayName }
        : null,
      outcome: bet.outcome,
      platformFeeAmount: bet.platformFeeAmount
        ? dollarsToCents(bet.platformFeeAmount)
        : null,
      gameMetadata: bet.gameMetadata,
      resultPayload: bet.resultPayload,
      resultVerified: bet.resultVerified,
      createdAt: bet.createdAt.toISOString(),
      matchedAt: bet.matchedAt?.toISOString() ?? null,
      resultReportedAt: bet.resultReportedAt?.toISOString() ?? null,
      settledAt: bet.settledAt?.toISOString() ?? null,
      expiresAt: bet.expiresAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
