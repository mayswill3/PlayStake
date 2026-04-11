import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, ValidationError, errorResponse } from "@/lib/errors/index";
import { getLobbyStatus } from "@/lib/lobby/service";

/**
 * GET /api/lobby/status?lobbyEntryId=xxx
 *
 * Polling fallback — returns the current state of the caller's lobby entry,
 * including pending invite details if status is INVITED.
 */
export async function GET(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();
    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid session");

    const lobbyEntryId = request.nextUrl.searchParams.get("lobbyEntryId");
    if (!lobbyEntryId) throw new ValidationError("lobbyEntryId is required");

    const result = await getLobbyStatus(session.userId, lobbyEntryId);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
