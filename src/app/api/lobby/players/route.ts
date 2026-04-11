import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, ValidationError, errorResponse } from "@/lib/errors/index";
import { listLobbyPlayers, parseLobbyRole } from "@/lib/lobby/service";

/**
 * GET /api/lobby/players?gameType=bullseye&role=PLAYER_B
 *
 * Returns the list of players waiting in the opposite role. Caller must be
 * in the same lobby on the opposite side.
 */
export async function GET(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();
    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid session");

    const gameType = request.nextUrl.searchParams.get("gameType");
    const roleParam = request.nextUrl.searchParams.get("role");

    if (!gameType) throw new ValidationError("gameType is required");
    if (!roleParam) throw new ValidationError("role is required");

    const role = parseLobbyRole(roleParam);

    const result = await listLobbyPlayers({
      callerUserId: session.userId,
      gameType,
      role,
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
