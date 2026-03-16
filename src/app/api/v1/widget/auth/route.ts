import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, verifyDeveloperOwnsGame } from "../../../../../lib/auth/dev-api";
import { generateWidgetToken } from "../../../../../lib/auth/widget-token";
import { apiRateLimit } from "../../../../../lib/middleware/rate-limit";
import { validateBody } from "../../../../../lib/middleware/validate";
import { widgetAuthSchema } from "../../../../../lib/validation/schemas";
import { errorResponse, NotFoundError } from "../../../../../lib/errors/index";
import { prisma } from "../../../../../lib/db/client";

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const rateLimited = apiRateLimit(request);
    if (rateLimited) return rateLimited;

    // Authenticate API key with widget:auth permission
    const auth = await authenticateApiKey(request, ["widget:auth"]);

    const body = await request.json();
    const input = validateBody(widgetAuthSchema, body);

    // Verify the game belongs to this developer
    await verifyDeveloperOwnsGame(auth.developerProfileId, input.gameId);

    // Validate that the player exists
    const player = await prisma.user.findUnique({
      where: { id: input.playerId },
      select: { id: true, deletedAt: true },
    });

    if (!player || player.deletedAt !== null) {
      throw new NotFoundError("Player not found");
    }

    // Generate widget token
    const { widgetToken, expiresAt } = await generateWidgetToken(
      input.gameId,
      input.playerId,
      auth.developerProfileId
    );

    return NextResponse.json({
      widgetToken,
      expiresAt: expiresAt.toISOString(),
      playerId: input.playerId,
      gameId: input.gameId,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
