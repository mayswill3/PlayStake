import { NextResponse } from "next/server";
import { withSessionAuth } from "@/lib/middleware/auth";
import { assertEligibleToGamble } from "@/lib/compliance/eligibility";
import { prisma } from "@/lib/db/client";
import { errorResponse, NotFoundError, ValidationError } from "@/lib/errors";
import { assertParticipant } from "@/lib/demo/access";
import {
  GAME_TYPES,
  createGameSession,
  listWaitingSessions,
  type GameType,
} from "@/lib/games/sessions";

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

    // An unknown or withdrawn game (e.g. Higher / Lower) is refused rather
    // than quietly turned into a different game.
    if (gameType !== undefined && !GAME_TYPES.includes(gameType as GameType)) {
      throw new ValidationError("That game is not available");
    }
    const type: GameType = (gameType as GameType | undefined) ?? "tictactoe";
    const explicitId =
      typeof sessionId === "string" && sessionId.length > 0 ? sessionId : undefined;

    let playerAId = auth.userId;
    let boundBetId: string | null = null;

    // A game with no bet is free play, which still needs a verified adult who
    // may gamble. A game for an agreed bet was cleared when it was accepted.
    if (!(typeof betId === "string" && betId.length > 0)) {
      await assertEligibleToGamble(auth.userId);
    }

    if (typeof betId === "string" && betId.length > 0) {
      const bet = await prisma.bet.findUnique({
        where: { id: betId },
        select: { playerAId: true, playerBId: true },
      });
      if (!bet) throw new NotFoundError("Bet not found");
      assertParticipant(auth.userId, bet, "this bet");
      playerAId = bet.playerAId;
      boundBetId = betId;
      // The shared id is always derived from the bet, so an explicit id can
      // only ever land on this bet's own session.
      if (explicitId && explicitId !== betId.slice(0, 8).toUpperCase()) {
        throw new ValidationError("sessionId does not match this bet");
      }
    } else if (explicitId) {
      // Explicit ids exist only so lobby-matched players can meet on one
      // session. Without a bet to check against, an explicit id would let a
      // caller pick up someone else's session by guessing it.
      throw new ValidationError("sessionId may only be used with a betId");
    }

    const session = await createGameSession({
      playerAId,
      betId: boundBetId,
      gameType: type,
      explicitId,
    });
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
});

/** GET /api/demo/game — list sessions waiting for an opponent. */
export const GET = withSessionAuth(async () => {
  return NextResponse.json({ sessions: await listWaitingSessions() });
});
