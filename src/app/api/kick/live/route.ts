import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "../../../../lib/auth/session";
import { getSessionToken } from "../../../../lib/auth/helpers";
import { refreshKickLiveStatus } from "../../../../lib/kick/live-sync";
import { errorResponse, AuthenticationError } from "../../../../lib/errors/index";

export const dynamic = "force-dynamic";

/**
 * Return PlayStake users whose linked Kick channel is currently live.
 * See `refreshKickLiveStatus` for how Kick is polled and the flag synced.
 */
export async function GET(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const live = await refreshKickLiveStatus();
    return NextResponse.json({ live });
  } catch (error) {
    return errorResponse(error);
  }
}
