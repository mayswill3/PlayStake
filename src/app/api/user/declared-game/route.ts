import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/client";
import { validateSession } from "../../../../lib/auth/session";
import { getSessionToken } from "../../../../lib/auth/helpers";
import { setDeclaredGameSchema } from "../../../../lib/validation/schemas";
import { validateBody } from "../../../../lib/middleware/validate";
import {
  getStreamGameId,
} from "../../../../lib/lobby/games";
import {
  STREAM_GAME_CATALOGUE,
  STREAM_GAME_TYPES,
  streamGameTypeForSlug,
} from "../../../../lib/games/catalogue";
import {
  errorResponse,
  AuthenticationError,
  ValidationError,
} from "../../../../lib/errors/index";

export const dynamic = "force-dynamic";

/**
 * Shape the stored declared Game (FK) back into the gameType vocabulary the
 * rest of the stream/challenge flow speaks. Returns null when nothing is
 * declared or the stored row is no longer in the supported catalogue.
 */
function toDeclaredGameDTO(
  declaredGame: { slug: string; name: string } | null,
): { gameType: string; name: string; slug: string } | null {
  if (!declaredGame) return null;
  const gameType = streamGameTypeForSlug(declaredGame.slug);
  if (!gameType) return null;
  return { gameType, name: declaredGame.name, slug: declaredGame.slug };
}

/**
 * GET /api/user/declared-game
 *
 * The caller's streaming setup: whether their Kick account is connected, the
 * currently-declared game (if any), and the list of games they can declare.
 */
export async function GET(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();
    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const account = await prisma.kickAccount.findUnique({
      where: { userId: session.userId },
      select: { declaredGame: { select: { slug: true, name: true } } },
    });

    const options = STREAM_GAME_TYPES.map((gameType) => ({
      gameType,
      name: STREAM_GAME_CATALOGUE[gameType].name,
      category: STREAM_GAME_CATALOGUE[gameType].category,
      requiresReferee: STREAM_GAME_CATALOGUE[gameType].mode === "refereed",
    }));

    return NextResponse.json({
      connected: account !== null,
      declaredGame: account ? toDeclaredGameDTO(account.declaredGame) : null,
      options,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PUT /api/user/declared-game
 *
 * Set or clear the streamer's declared game. Body: `{ gameType }` where
 * gameType is a supported streaming game, or `null` to clear. Editable while
 * offline — this is meant to be set before going live. Requires a linked Kick
 * account (only streamers declare games).
 */
export async function PUT(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();
    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const body = await request.json().catch(() => ({}));
    const { gameType } = validateBody(setDeclaredGameSchema, body);

    const account = await prisma.kickAccount.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!account) {
      throw new ValidationError("Connect your Kick account before declaring a game");
    }

    // Resolve gameType -> real Game row (FK). null clears the declaration.
    const declaredGameId = gameType ? await getStreamGameId(gameType) : null;

    const updated = await prisma.kickAccount.update({
      where: { id: account.id },
      data: { declaredGameId },
      select: { declaredGame: { select: { slug: true, name: true } } },
    });

    return NextResponse.json({
      declaredGame: toDeclaredGameDTO(updated.declaredGame),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
