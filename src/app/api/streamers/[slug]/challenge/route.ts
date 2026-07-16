import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "../../../../../lib/auth/helpers";
import { validateSession } from "../../../../../lib/auth/session";
import { challengeSchema } from "../../../../../lib/validation/schemas";
import { validateBody } from "../../../../../lib/middleware/validate";
import { challengeRateLimit } from "../../../../../lib/middleware/rate-limit";
import { createChallenge } from "../../../../../lib/lobby/service";
import {
  errorResponse,
  AuthenticationError,
} from "../../../../../lib/errors/index";

/**
 * POST /api/streamers/[slug]/challenge
 *
 * A viewer challenges the streamer on this page to a wager. The body carries
 * ONLY the stake amount (integer cents) — the game is resolved server-side from
 * the streamer's declared game, never trusted from the client.
 *
 * Creates a targeted lobby invite (Player A viewer -> INVITED Player B
 * streamer) delivered live over pub/sub. No ledger movement here: escrow only
 * happens if the streamer accepts via /api/lobby/respond.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const limited = challengeRateLimit(request);
    if (limited) return limited;

    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();
    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const { slug } = await params;

    const body = await request.json().catch(() => ({}));
    const { amount } = validateBody(challengeSchema, body);

    const result = await createChallenge({
      challengerUserId: session.userId,
      streamerChannelSlug: slug,
      stakeAmount: amount,
    });

    return NextResponse.json({
      status: "SENT",
      challengeId: result.streamerLobbyEntryId,
      lobbyEntryId: result.challengerLobbyEntryId,
      gameType: result.gameType,
      stakeAmount: result.stakeAmount,
      inviteExpiresAt: result.inviteExpiresAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
