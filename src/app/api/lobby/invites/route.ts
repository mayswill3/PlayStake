import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, errorResponse } from "@/lib/errors/index";
import {
  listMyInvites,
  listMyMatches,
  listMyOutgoingChallenges,
} from "@/lib/lobby/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/lobby/invites
 *
 * The caller's pending incoming challenges (`invites`, INVITED Player B entries)
 * AND their currently-joinable matches (`matches`, bets that reached MATCHED and
 * haven't been played yet). Backs the challenge inbox, the ambient notification
 * listener, and the accept->play handoff (the ambient listener routes the player
 * into the game session for a joinable match). `sseEnabled` tells the client
 * whether it can upgrade from polling to the live SSE stream.
 *
 * Read-only — Accept/Decline still go through POST /api/lobby/respond.
 */
export async function GET(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();
    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const [invites, matches, outgoing] = await Promise.all([
      listMyInvites(session.userId),
      listMyMatches(session.userId),
      listMyOutgoingChallenges(session.userId),
    ]);

    return NextResponse.json({
      invites,
      matches,
      outgoing,
      sseEnabled: process.env.ENABLE_LOBBY_SSE === "true",
    });
  } catch (err) {
    return errorResponse(err);
  }
}
