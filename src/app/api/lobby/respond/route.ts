import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, ValidationError, errorResponse } from "@/lib/errors/index";
import { respondToInvite } from "@/lib/lobby/service";

/**
 * POST /api/lobby/respond
 *
 * Body: { lobbyEntryId: string (caller, Player B), response: 'ACCEPT' | 'DECLINE' }
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
    if (body?.response !== "ACCEPT" && body?.response !== "DECLINE") {
      throw new ValidationError("response must be 'ACCEPT' or 'DECLINE'");
    }

    const result = await respondToInvite({
      callerUserId: session.userId,
      lobbyEntryId: body.lobbyEntryId,
      response: body.response,
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
