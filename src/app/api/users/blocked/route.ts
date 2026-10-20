import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse } from "@/lib/errors";
import { listBlocked } from "@/lib/users/directory";

/** GET /api/users/blocked — the people this user has blocked. */
export const GET = withSessionAuth(async (_request, _context, auth) => {
  try {
    return Response.json({ blocked: await listBlocked(auth.userId) });
  } catch (error) {
    return errorResponse(error);
  }
});
