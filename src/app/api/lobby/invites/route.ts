import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, errorResponse } from "@/lib/errors/index";
import { listMyInvites } from "@/lib/lobby/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/lobby/invites
 *
 * The caller's pending incoming challenges (INVITED Player B entries). Backs the
 * challenge inbox and the ambient notification listener. `sseEnabled` tells the
 * client whether it can upgrade from polling to the live SSE stream.
 *
 * Read-only — Accept/Decline still go through POST /api/lobby/respond.
 */
export async function GET(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();
    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const invites = await listMyInvites(session.userId);

    return NextResponse.json({
      invites,
      sseEnabled: process.env.ENABLE_LOBBY_SSE === "true",
    });
  } catch (err) {
    return errorResponse(err);
  }
}
