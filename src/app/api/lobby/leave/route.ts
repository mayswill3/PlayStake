import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, ValidationError, errorResponse } from "@/lib/errors/index";
import { leaveLobby } from "@/lib/lobby/service";

/**
 * DELETE /api/lobby/leave?lobbyEntryId=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();
    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid session");

    const lobbyEntryId = request.nextUrl.searchParams.get("lobbyEntryId");
    if (!lobbyEntryId) throw new ValidationError("lobbyEntryId is required");

    await leaveLobby(session.userId, lobbyEntryId);

    return NextResponse.json({ status: "LEFT" });
  } catch (err) {
    return errorResponse(err);
  }
}
