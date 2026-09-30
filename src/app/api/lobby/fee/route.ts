import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { NotFoundError, ValidationError, errorResponse } from "@/lib/errors/index";
import { isLobbyGameType, LOBBY_GAME_META } from "@/lib/lobby/games";
import { STREAM_GAME_CATALOGUE } from "@/lib/games/catalogue";

/**
 * GET /api/lobby/fee?gameType=darts
 *
 * The platform fee taken from the pot for this game, so the stake screens can
 * show what a win (or a draw) pays before anyone commits. Public: it is the
 * same for everyone and is part of the game's terms.
 */
export async function GET(request: NextRequest) {
  try {
    const gameType = request.nextUrl.searchParams.get("gameType");
    if (!gameType) throw new ValidationError("gameType is required");

    const slug = isLobbyGameType(gameType)
      ? LOBBY_GAME_META[gameType].slug
      : (STREAM_GAME_CATALOGUE as Record<string, { slug: string }>)[gameType]?.slug;
    if (!slug) throw new NotFoundError("Unknown game");

    const game = await prisma.game.findUnique({
      where: { slug },
      select: { platformFeePercent: true },
    });
    if (!game) throw new NotFoundError("Game not available");

    return NextResponse.json(
      { gameType, feePercent: Number(game.platformFeePercent) },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
