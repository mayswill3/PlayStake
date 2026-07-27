import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, errorResponse } from "@/lib/errors/index";
import { cancelStreamChallenge } from "@/lib/lobby/service";

/**
 * DELETE /api/lobby/challenges/[id]
 *
 * Cancels the caller's pending outgoing stream challenge and both lobby entries.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();
    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const { id } = await params;
    await cancelStreamChallenge(session.userId, id);
    return NextResponse.json({ status: "CANCELLED" });
  } catch (error) {
    return errorResponse(error);
  }
}
