import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, NotFoundError, errorResponse } from "@/lib/errors";
import { removeChatMessage } from "@/lib/matches/chat";

export const dynamic = "force-dynamic";

/** Moderator removal of a chat message (soft delete). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();
    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const { id, messageId } = await params;
    const uuid = z.string().uuid();
    if (!uuid.safeParse(id).success || !uuid.safeParse(messageId).success) {
      throw new NotFoundError("Message not found");
    }
    await removeChatMessage(id, messageId, session.user);
    return NextResponse.json({ removed: true });
  } catch (error) {
    return errorResponse(error);
  }
}
