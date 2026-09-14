import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, NotFoundError, errorResponse } from "@/lib/errors";
import { getSpectatorMatch } from "@/lib/matches/spectator";

export const dynamic = "force-dynamic";

/** Spectator view of one refereed stream match — open to any signed-in user. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();
    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const { id } = await params;
    // Only stream matches are spectatable; anything else (or a malformed id)
    // is indistinguishable from a missing match.
    const match = z.string().uuid().safeParse(id).success ? await getSpectatorMatch(id) : null;
    if (!match) throw new NotFoundError("Match not found");
    return NextResponse.json({ match });
  } catch (error) {
    return errorResponse(error);
  }
}
