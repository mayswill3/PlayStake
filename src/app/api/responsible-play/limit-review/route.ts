import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse } from "@/lib/errors";
import { getLimitReviewStatus, recordLimitReview } from "@/lib/responsible-play/limit-review";

/** GET /api/responsible-play/limit-review — is the six-monthly review due? */
export const GET = withSessionAuth(async (_request, _context, auth) => {
  try {
    const status = await getLimitReviewStatus(auth.userId);
    return Response.json({ due: status.due, hasLimits: status.hasLimits });
  } catch (error) {
    return errorResponse(error);
  }
});

/** POST /api/responsible-play/limit-review — the customer answered the reminder. */
export const POST = withSessionAuth(async (_request, _context, auth) => {
  try {
    await recordLimitReview(auth.userId);
    return Response.json({ recorded: true });
  } catch (error) {
    return errorResponse(error);
  }
});
