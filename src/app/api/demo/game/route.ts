import { NextResponse } from "next/server";
import { withSessionAuth } from "@/lib/middleware/auth";
import { prisma } from "@/lib/db/client";
import { errorResponse, NotFoundError, ValidationError } from "@/lib/errors";
import { assertParticipant } from "@/lib/demo/access";
import { createSession, listWaitingSessions } from "./store";
import type { GameType } from "./store";

const VALID_TYPES: GameType[] = ["tictactoe", "cards", "darts"];

/**
 * POST /api/demo/game — create a game session.
 *
 * Side A is never taken from the body. For a plain demo game it is the caller.
 * For a lobby match it is the bet's player A, whichever player arrives first —
 * both derive the same session id from the bet, and createSession is
 * idempotent on it, so the second arrival just gets the existing row.
 */
export const POST = withSessionAuth(async (request, _context, auth) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { betId, gameType, sessionId } = body as {
      betId?: unknown;
      gameType?: unknown;
      sessionId?: unknown;
    };

    const type: GameType = VALID_TYPES.includes(gameType as GameType)
      ? (gameType as GameType)
      : "tictactoe";
    const explicitId =
      typeof sessionId === "string" && sessionId.length > 0 ? sessionId : undefined;

    let playerAId = auth.userId;
    let boundBetId: string | null = null;

    if (typeof betId === "string" && betId.length > 0) {
      const bet = await prisma.bet.findUnique({
        where: { id: betId },
        select: { playerAId: true, playerBId: true },
      });
      if (!bet) throw new NotFoundError("Bet not found");
      assertParticipant(auth.userId, bet, "this bet");
      playerAId = bet.playerAId;
      boundBetId = betId;
    } else if (explicitId) {
      // Explicit ids exist only so lobby-matched players can meet on one
      // session. Without a bet to check against, an explicit id would let a
      // caller pick up someone else's session by guessing it.
      throw new ValidationError("sessionId may only be used with a betId");
    }

    const session = createSession(playerAId, boundBetId, type, explicitId);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
});

/** GET /api/demo/game — list sessions waiting for an opponent. */
export const GET = withSessionAuth(async () => {
  return NextResponse.json({ sessions: listWaitingSessions() });
});
