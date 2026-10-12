import { NextResponse } from "next/server";
import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse } from "@/lib/errors";
import { listFollowing } from "@/lib/follows/service";

/** GET /api/follows — streamers the caller follows, live first. */
export const GET = withSessionAuth(async (_request, _context, auth) => {
  try {
    return NextResponse.json({ following: await listFollowing(auth.userId) });
  } catch (error) {
    return errorResponse(error);
  }
});
