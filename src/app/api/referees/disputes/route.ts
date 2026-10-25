import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse } from "@/lib/errors";
import { listReviewableDisputes } from "@/lib/disputes/review";

/** GET /api/referees/disputes — open disputes this reviewer may take. */
export const GET = withSessionAuth(async (_request, _context, auth) => {
  try {
    return Response.json({ disputes: await listReviewableDisputes(auth.userId) });
  } catch (error) {
    return errorResponse(error);
  }
});
