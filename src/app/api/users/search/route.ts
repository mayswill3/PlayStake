import { withSessionAuth } from "@/lib/middleware/auth";
import { userSearchRateLimit } from "@/lib/middleware/rate-limit";
import { errorResponse } from "@/lib/errors";
import { searchPlayers } from "@/lib/users/directory";

/** GET /api/users/search?q= — streamers and players who allow it. */
export const GET = withSessionAuth(async (request, _context, auth) => {
  try {
    const limited = userSearchRateLimit(request);
    if (limited) return limited;
    const q = new URL(request.url).searchParams.get("q") ?? "";
    return Response.json({ results: await searchPlayers(auth.userId, q.slice(0, 50)) });
  } catch (error) {
    return errorResponse(error);
  }
});
