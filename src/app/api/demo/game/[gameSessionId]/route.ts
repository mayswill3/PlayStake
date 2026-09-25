import { NextResponse } from "next/server";
import { withSessionAuth } from "@/lib/middleware/auth";
import { prisma } from "@/lib/db/client";
import {
  errorResponse,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { assertParticipant, sideOf } from "@/lib/demo/access";
import { getSession, makeMove, joinSession, resolveGame } from "../store";
import type { GameSession } from "../store";

function loadSession(params?: Record<string, string>): GameSession {
  const session = params?.gameSessionId ? getSession(params.gameSessionId) : undefined;
  if (!session) throw new NotFoundError("Game not found");
  return session;
}

/**
 * A session may only be tied to a bet between the same two people, on the
 * same sides. This is what makes "settle this bet from this session" safe.
 */
async function assertBetMatchesSession(
  userId: string,
  betId: string,
  session: GameSession,
): Promise<void> {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    select: { playerAId: true, playerBId: true },
  });
  if (!bet) throw new NotFoundError("Bet not found");
  assertParticipant(userId, bet, "this bet");
  if (
    bet.playerAId !== session.playerAId ||
    (session.playerBId !== null && bet.playerBId !== session.playerBId)
  ) {
    throw new AuthorizationError("That bet belongs to a different match");
  }
}

/** GET /api/demo/game/:id — game state, polled by both players. */
export const GET = withSessionAuth(async (_request, context) => {
  try {
    // Any signed-in user may read a session: joining by code needs to see the
    // game type before the caller is a participant. Board state is not secret.
    return NextResponse.json(loadSession(context.params));
  } catch (error) {
    return errorResponse(error);
  }
});

/**
 * PATCH /api/demo/game/:id — join, move, resolve, or sync game data.
 *
 * Every action takes the acting player from the session cookie. The body no
 * longer says who is moving or joining; it can only say what they did.
 */
export const PATCH = withSessionAuth(async (request, context, auth) => {
  try {
    const session = loadSession(context.params);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    if (body.action === "join") {
      if (session.status !== "waiting") {
        throw new ValidationError("Game already started");
      }
      if (auth.userId === session.playerAId) {
        throw new ValidationError("Cannot play against yourself");
      }
      if (body.gameType && body.gameType !== session.gameType) {
        throw new ValidationError(`This code is for a different game (${session.gameType})`);
      }
      const betId = typeof body.betId === "string" ? body.betId : undefined;
      const effectiveBetId = betId ?? session.betId;
      if (effectiveBetId) {
        await assertBetMatchesSession(auth.userId, effectiveBetId, session);
      }
      joinSession(session, auth.userId, betId);
      return NextResponse.json(session);
    }

    // Everything below requires being one of the two players already.
    assertParticipant(auth.userId, session, "this game");

    if (body.action === "setBetId") {
      if (typeof body.betId !== "string" || !body.betId) {
        throw new ValidationError("betId required");
      }
      await assertBetMatchesSession(auth.userId, body.betId, session);
      session.betId = body.betId;
      return NextResponse.json(session);
    }

    if (body.action === "move") {
      // The side is derived from who is asking, so a player can't move for
      // their opponent by naming the other side.
      const player = sideOf(auth.userId, session);
      if (!player) throw new AuthorizationError("You are not a player in this game");
      const result = makeMove(session, Number(body.cell), player);
      if (!result.success) throw new ValidationError(result.error ?? "Invalid move");
      return NextResponse.json(session);
    }

    if (body.action === "resolve") {
      if (body.winner !== "A" && body.winner !== "B" && body.winner !== "draw") {
        throw new ValidationError("winner required");
      }
      const result = resolveGame(session, body.winner);
      if (!result.success) throw new ValidationError(result.error ?? "Cannot resolve");
      return NextResponse.json(session);
    }

    if (body.action === "setGameData") {
      if (!body.data || typeof body.data !== "object") {
        throw new ValidationError("data object required");
      }
      session.gameData = { ...session.gameData, ...(body.data as Record<string, unknown>) };
      return NextResponse.json(session);
    }

    throw new ValidationError("Invalid action");
  } catch (error) {
    return errorResponse(error);
  }
});
