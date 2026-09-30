import { NextResponse } from "next/server";
import { withSessionAuth } from "@/lib/middleware/auth";
import { prisma } from "@/lib/db/client";
import {
  errorResponse,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { assertParticipant } from "@/lib/demo/access";
import {
  getGameSession,
  joinGameSession,
  playAction,
  setSessionBet,
  type GameSessionView,
} from "@/lib/games/sessions";

async function loadSession(params?: Record<string, string>): Promise<GameSessionView> {
  const session = params?.gameSessionId ? await getGameSession(params.gameSessionId) : null;
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
  session: GameSessionView,
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
    // game type before the caller is a participant. The view never includes
    // the undealt deck, so nothing here helps anyone predict a draw.
    return NextResponse.json(await loadSession(context.params));
  } catch (error) {
    return errorResponse(error);
  }
});

/**
 * PATCH /api/demo/game/:id — join, link a bet, or play.
 *
 * Every action takes the acting player from the session cookie. The body only
 * says what the player did (a cell, a higher/lower call, an aim point); the
 * server works out what happened, including every random draw and the winner.
 * There is no way for a client to declare a result.
 */
export const PATCH = withSessionAuth(async (request, context, auth) => {
  try {
    const session = await loadSession(context.params);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    if (body.action === "join") {
      const betId = typeof body.betId === "string" ? body.betId : undefined;
      const joined = await joinGameSession(session.id, auth.userId, {
        betId,
        gameType: body.gameType,
        beforeJoin: async (current) => {
          const effectiveBetId = betId ?? current.betId;
          if (effectiveBetId) await assertBetMatchesSession(auth.userId, effectiveBetId, current);
        },
      });
      return NextResponse.json(joined);
    }

    // Everything below requires being one of the two players already.
    assertParticipant(auth.userId, session, "this game");

    if (body.action === "setBetId") {
      if (typeof body.betId !== "string" || !body.betId) {
        throw new ValidationError("betId required");
      }
      await assertBetMatchesSession(auth.userId, body.betId, session);
      return NextResponse.json(await setSessionBet(session.id, body.betId));
    }

    if (body.action === "move" || body.action === "guess" || body.action === "throw") {
      return NextResponse.json(await playAction(session.id, auth.userId, body));
    }

    throw new ValidationError("Invalid action");
  } catch (error) {
    return errorResponse(error);
  }
});
