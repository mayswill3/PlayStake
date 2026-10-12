import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "../../../../../lib/auth/helpers";
import { validateSession } from "../../../../../lib/auth/session";
import { AuthenticationError, errorResponse } from "../../../../../lib/errors/index";
import { followStreamer, unfollowStreamer } from "../../../../../lib/follows/service";

async function userId(request: NextRequest): Promise<string> {
  const token = getSessionToken(request);
  if (!token) throw new AuthenticationError();
  const session = await validateSession(token);
  if (!session) throw new AuthenticationError("Invalid or expired session");
  return session.userId;
}

/** POST /api/streamers/[slug]/follow — follow this streamer. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    await followStreamer(await userId(request), slug);
    return NextResponse.json({ following: true });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/streamers/[slug]/follow — stop following. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    await unfollowStreamer(await userId(request), slug);
    return NextResponse.json({ following: false });
  } catch (error) {
    return errorResponse(error);
  }
}
