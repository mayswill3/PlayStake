import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, errorResponse } from "@/lib/errors";
import { listLiveMatches } from "@/lib/matches/spectator";

export const dynamic = "force-dynamic";

/** Refereed stream matches in progress, for spectators (dashboard slideshow, /watch). */
export async function GET(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();
    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");
    return NextResponse.json({ matches: await listLiveMatches() });
  } catch (error) {
    return errorResponse(error);
  }
}
