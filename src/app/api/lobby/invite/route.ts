import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, ValidationError, errorResponse } from "@/lib/errors/index";
import { inviteLobbyPlayer } from "@/lib/lobby/service";

/**
 * POST /api/lobby/invite
 *
 * Body: { lobbyEntryId: string (caller, Player A), targetEntryId: string (Player B) }
 */
export async function POST(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();
    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid session");

    const body = await request.json().catch(() => ({}));
    if (typeof body?.lobbyEntryId !== "string") {
      throw new ValidationError("lobbyEntryId is required");
    }
    if (typeof body?.targetEntryId !== "string") {
      throw new ValidationError("targetEntryId is required");
    }

    const result = await inviteLobbyPlayer({
      callerUserId: session.userId,
      lobbyEntryId: body.lobbyEntryId,
      targetEntryId: body.targetEntryId,
    });

    return NextResponse.json({
      inviteId: result.inviteId,
      status: result.status,
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
