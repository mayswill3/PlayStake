import { NextRequest, NextResponse } from "next/server";
import {
  authenticateApiKey,
  verifyDeveloperOwnsGame,
} from "../../../../lib/auth/dev-api.js";
import { prisma } from "../../../../lib/db/client.js";
import { apiRateLimit } from "../../../../lib/middleware/rate-limit.js";
import { validateBody } from "../../../../lib/middleware/validate.js";
import { createWebhookSchema } from "../../../../lib/validation/schemas.js";
import { generateRandomToken } from "../../../../lib/utils/crypto.js";
import { errorResponse } from "../../../../lib/errors/index.js";
import { WebhookEventType } from "../../../../../generated/prisma/client.js";

// ---------------------------------------------------------------------------
// GET /api/v1/webhooks - List webhook configs for developer's games
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const rateLimited = apiRateLimit(request);
    if (rateLimited) return rateLimited;

    const auth = await authenticateApiKey(request, ["webhook:manage"]);

    // Find all games for this developer
    const games = await prisma.game.findMany({
      where: { developerProfileId: auth.developerProfileId },
      select: { id: true },
    });

    const gameIds = games.map((g) => g.id);

    const configs = await prisma.webhookConfig.findMany({
      where: { gameId: { in: gameIds } },
      select: {
        id: true,
        gameId: true,
        url: true,
        events: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      data: configs.map((c) => ({
        id: c.id,
        gameId: c.gameId,
        url: c.url,
        events: c.events,
        isActive: c.isActive,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/webhooks - Create webhook config
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const rateLimited = apiRateLimit(request);
    if (rateLimited) return rateLimited;

    const auth = await authenticateApiKey(request, ["webhook:manage"]);

    const body = await request.json();
    const input = validateBody(createWebhookSchema, body);

    // Verify game belongs to developer
    await verifyDeveloperOwnsGame(auth.developerProfileId, input.gameId);

    // Generate signing secret
    const secret = "whsec_" + generateRandomToken(32);

    const config = await prisma.webhookConfig.create({
      data: {
        gameId: input.gameId,
        url: input.url,
        secret,
        events: input.events as WebhookEventType[],
        isActive: true,
      },
    });

    return NextResponse.json(
      {
        id: config.id,
        secret,
        gameId: config.gameId,
        url: config.url,
        events: config.events,
        isActive: config.isActive,
        createdAt: config.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
