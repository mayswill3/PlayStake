import { NextResponse } from "next/server";
import { withSessionAuth } from "@/lib/middleware/auth";
import { isParticipant, sameParticipants } from "@/lib/demo/access";
import { settleBetFromSession, SettleError } from "@/lib/demo/settle";
import { getGameSession } from "@/lib/games/sessions";
import { BetMatchType } from "../../../../../generated/prisma/client";
import { prisma, withTransaction, type TxClient } from "@/lib/db/client";
import { validateApiKey } from "@/lib/auth/api-key";

/**
 * POST /api/demo/settle-bet
 *
 * Settles a /play match in a single step once the server has decided it,
 * bypassing the widget confirm/dispute flow and the settlement worker. The
 * outcome comes from the persisted game session, never from the caller.
 */
export const POST = withSessionAuth(async (request, _context, auth) => {
  const body = await request.json();
  const { betId, apiKey, sessionId } = body;

  if (!betId || !apiKey) {
    return NextResponse.json(
      { error: "betId and apiKey required" },
      { status: 400 }
    );
  }

  // Verify API key belongs to a valid developer
  const validKey = await validateApiKey(apiKey);
  if (!validKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  // Load the bet
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    select: {
      playerAId: true,
      playerBId: true,
      matchType: true,
      game: { select: { developerProfileId: true } },
    },
  });

  if (!bet) {
    return NextResponse.json({ error: "Bet not found" }, { status: 404 });
  }

  // Identity comes from the session, never the body. Only the two players in
  // this bet may settle it, and only with a key issued to the game's own
  // developer — a demo key must not reach into another developer's games.
  if (!isParticipant(auth.userId, bet)) {
    return NextResponse.json(
      { error: "You are not a player in this bet", code: "FORBIDDEN" },
      { status: 403 },
    );
  }
  if (validKey.developerProfileId !== bet.game.developerProfileId) {
    return NextResponse.json(
      { error: "This API key was not issued for that game", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  // Stream-vs-stream matches cannot use the demo fast-settlement shortcut.
  // Only the assigned referee decision plus the dispute hold may release them.
  if (bet.matchType === BetMatchType.STREAM_VS_STREAM) {
    return NextResponse.json(
      {
        error:
          "This live match is awaiting its human referee and dispute window",
        code: "REFEREE_SETTLEMENT_REQUIRED",
      },
      { status: 409 },
    );
  }

  // A session named in the body must be this bet's own session: same bet,
  // same two players on the same sides. The winner itself is never taken from
  // the request; it is read from the server-decided session below.
  if (typeof sessionId === "string" && sessionId) {
    const session = await getGameSession(sessionId);
    if (session && (session.betId !== betId || !sameParticipants(session, bet))) {
      return NextResponse.json(
        { error: "That game session does not belong to this bet", code: "FORBIDDEN" },
        { status: 403 },
      );
    }
  }

  try {
    const result = await withTransaction((tx: TxClient) => settleBetFromSession(tx, betId), {
      timeout: 30_000,
    });
    return NextResponse.json({ success: true, betId, ...result });
  } catch (error) {
    if (error instanceof SettleError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    throw error;
  }
});
