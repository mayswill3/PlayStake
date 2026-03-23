import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, authenticateApiKeyOrWidget, verifyDeveloperOwnsGame } from "../../../../lib/auth/dev-api";
import { apiRateLimit } from "../../../../lib/middleware/rate-limit";
import { validateBody, validateQuery } from "../../../../lib/middleware/validate";
import {
  createBetSchema,
  betListV1QuerySchema,
} from "../../../../lib/validation/schemas";
import { prisma } from "../../../../lib/db/client";
import { centsToDollars, dollarsToCents } from "../../../../lib/utils/money";
import {
  errorResponse,
  AppError,
  NotFoundError,
  ConflictError,
} from "../../../../lib/errors/index";
import { BetStatus } from "../../../../../generated/prisma/client";

// ---------------------------------------------------------------------------
// GET /api/v1/bets - List bets for developer's games
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const rateLimited = apiRateLimit(request);
    if (rateLimited) return rateLimited;

    const auth = await authenticateApiKeyOrWidget(request, ["bet:read"]);

    const { searchParams } = new URL(request.url);
    const query = validateQuery(betListV1QuerySchema, searchParams);

    // For widget auth, use the game from the token; for API key, verify ownership
    if (auth.type === "widget") {
      // Widget tokens are scoped to a game — override gameId from token
      query.gameId = auth.gameId;
    } else {
      await verifyDeveloperOwnsGame(auth.developerProfileId, query.gameId);
    }

    const where: Record<string, unknown> = {
      gameId: query.gameId,
    };
    if (query.status) {
      where.status = query.status as BetStatus;
    }

    const [bets, totalCount] = await Promise.all([
      prisma.bet.findMany({
        where,
        include: {
          playerA: { select: { id: true, displayName: true } },
          playerB: { select: { id: true, displayName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.bet.count({ where }),
    ]);

    const data = bets.map((bet) => ({
      betId: bet.id,
      externalId: bet.externalId,
      gameId: bet.gameId,
      status: bet.status,
      amount: dollarsToCents(bet.amount),
      currency: bet.currency,
      playerA: bet.playerA
        ? { id: bet.playerA.id, displayName: bet.playerA.displayName }
        : null,
      playerB: bet.playerB
        ? { id: bet.playerB.id, displayName: bet.playerB.displayName }
        : null,
      outcome: bet.outcome,
      resultVerified: bet.resultVerified,
      platformFeeAmount: bet.platformFeeAmount
        ? dollarsToCents(bet.platformFeeAmount)
        : null,
      gameMetadata: bet.gameMetadata,
      createdAt: bet.createdAt.toISOString(),
      matchedAt: bet.matchedAt?.toISOString() ?? null,
      expiresAt: bet.expiresAt.toISOString(),
    }));

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

// ---------------------------------------------------------------------------
// POST /api/v1/bets - Propose a new bet
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const rateLimited = apiRateLimit(request);
    if (rateLimited) return rateLimited;

    const auth = await authenticateApiKeyOrWidget(request, ["bet:create"]);

    const body = await request.json();
    const input = validateBody(createBetSchema, body);

    // For widget auth, use the game and player from the token
    if (auth.type === "widget") {
      input.gameId = auth.gameId;
      input.playerAId = auth.userId;
    } else {
      if (!input.gameId || !input.playerAId) {
        throw new AppError("gameId and playerAId are required", 400, "VALIDATION_ERROR");
      }
      await verifyDeveloperOwnsGame(auth.developerProfileId, input.gameId);
    }

    // Fetch game to check bet limits
    const game = await prisma.game.findUniqueOrThrow({
      where: { id: input.gameId },
      include: {
        developerProfile: {
          include: { escrowLimit: true },
        },
      },
    });

    if (!game.isActive) {
      throw new AppError("Game is not active", 400, "GAME_INACTIVE");
    }

    const amountDollars = centsToDollars(input.amount);

    // Check amount against game min/max
    if (amountDollars.lt(game.minBetAmount)) {
      throw new AppError(
        `Amount ${input.amount} cents is below the game minimum of ${dollarsToCents(game.minBetAmount)} cents`,
        400,
        "AMOUNT_BELOW_MIN"
      );
    }
    if (amountDollars.gt(game.maxBetAmount)) {
      throw new AppError(
        `Amount ${input.amount} cents exceeds the game maximum of ${dollarsToCents(game.maxBetAmount)} cents`,
        400,
        "AMOUNT_ABOVE_MAX"
      );
    }

    // Pre-check developer escrow cap (soft check; the atomic check happens at consent)
    const escrowLimit = game.developerProfile.escrowLimit;
    if (escrowLimit) {
      if (amountDollars.gt(escrowLimit.maxSingleBet)) {
        throw new AppError(
          "Amount exceeds developer's maximum single bet limit",
          429,
          "ESCROW_CAP_EXCEEDED"
        );
      }
      const projectedEscrow = escrowLimit.currentEscrow.plus(amountDollars);
      if (projectedEscrow.gt(escrowLimit.maxTotalEscrow)) {
        throw new AppError(
          "Developer escrow cap would be exceeded",
          429,
          "ESCROW_CAP_EXCEEDED"
        );
      }
    }

    // Validate player A exists
    const playerA = await prisma.user.findUnique({
      where: { id: input.playerAId },
      select: { id: true, displayName: true, deletedAt: true },
    });

    if (!playerA || playerA.deletedAt !== null) {
      throw new NotFoundError("Player A not found");
    }

    // Calculate timestamps
    const now = new Date();
    const consentExpiresAt = new Date(
      now.getTime() + input.consentTimeoutSeconds * 1000
    );
    const expiresAt = new Date(
      now.getTime() + input.expiresInSeconds * 1000
    );

    // Create the bet
    const bet = await prisma.bet.create({
      data: {
        gameId: input.gameId,
        playerAId: input.playerAId,
        amount: amountDollars,
        currency: input.currency,
        status: BetStatus.PENDING_CONSENT,
        externalId: input.externalId ?? null,
        gameMetadata: (input.gameMetadata as any) ?? undefined,
        platformFeePercent: game.platformFeePercent,
        consentExpiresAt,
        expiresAt,
      },
    });

    return NextResponse.json(
      {
        betId: bet.id,
        externalId: bet.externalId,
        status: bet.status,
        amount: input.amount,
        currency: bet.currency,
        playerA: { id: playerA.id, displayName: playerA.displayName },
        consentExpiresAt: consentExpiresAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
