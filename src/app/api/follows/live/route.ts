import { NextResponse } from "next/server";
import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse } from "@/lib/errors";
import { liveFollowedForAlerts } from "@/lib/follows/service";

/**
 * GET /api/follows/live — followed streamers who are live now, for in-app
 * alerts. Empty while the caller is on a break, excluded or restricted.
 */
export const GET = withSessionAuth(async (_request, _context, auth) => {
  try {
    return NextResponse.json({ live: await liveFollowedForAlerts(auth.userId) });
  } catch (error) {
    return errorResponse(error);
  }
});
