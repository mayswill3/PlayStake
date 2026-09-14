import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionToken } from "@/lib/auth/helpers";
import { validateSession } from "@/lib/auth/session";
import { AuthenticationError, NotFoundError, ValidationError, errorResponse } from "@/lib/errors";
import { CHAT_MAX_LENGTH, getChatRoom, postChatMessage } from "@/lib/matches/chat";
import { chatMessageRateLimit } from "@/lib/middleware/rate-limit";

export const dynamic = "force-dynamic";

const postSchema = z.object({ body: z.string().min(1).max(CHAT_MAX_LENGTH * 2) });

async function requireViewer(request: NextRequest) {
  const token = getSessionToken(request);
  if (!token) throw new AuthenticationError();
  const session = await validateSession(token);
  if (!session) throw new AuthenticationError("Invalid or expired session");
  return session.user;
}

async function matchId(params: Promise<{ id: string }>) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) throw new NotFoundError("Match not found");
  return id;
}

/** Chat messages for a match. `?after=<cursor>` returns only what's new since. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await requireViewer(request);
    const betId = await matchId(params);
    const afterParam = request.nextUrl.searchParams.get("after");
    const after = afterParam ? new Date(afterParam) : undefined;
    if (after && Number.isNaN(after.getTime())) throw new ValidationError("after must be an ISO timestamp");
    return NextResponse.json(await getChatRoom(betId, viewer, after));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const limited = chatMessageRateLimit(request);
    if (limited) return limited;
    const viewer = await requireViewer(request);
    const betId = await matchId(params);
    const parsed = postSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ValidationError("Message body is required");
    const message = await postChatMessage(betId, viewer, parsed.data.body);
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
