import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, ValidationError, errorResponse } from "@/lib/errors/index";
import { joinLobby, parseLobbyRole } from "@/lib/lobby/service";

/**
 * POST /api/lobby/join
 *
 * Body: { gameType: string, role: 'PLAYER_A' | 'PLAYER_B', stakeAmount: number (cents) }
 */
export async function POST(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();
    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid session");

    const body = await request.json().catch(() => ({}));
    if (typeof body?.gameType !== "string") {
      throw new ValidationError("gameType is required");
    }
    const role = parseLobbyRole(body.role);
    const stakeAmount = Number.isFinite(body.stakeAmount) ? Number(body.stakeAmount) : 0;

    const result = await joinLobby({
      userId: session.userId,
      gameType: body.gameType,
      role,
      stakeAmount,
    });

    return NextResponse.json({
      lobbyEntryId: result.lobbyEntryId,
      status: result.status,
      expiresAt: result.expiresAt.toISOString(),
      position: result.position,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
