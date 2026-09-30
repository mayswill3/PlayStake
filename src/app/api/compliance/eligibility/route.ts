import { withSessionAuth } from "@/lib/middleware/auth";
import { AppError, errorResponse } from "@/lib/errors";
import { assertEligibleToGamble } from "@/lib/compliance/eligibility";

/**
 * GET /api/compliance/eligibility
 *
 * Whether the signed-in customer may gamble right now, and if not, why — so
 * the games can explain the block before the customer runs into it.
 */
export const GET = withSessionAuth(async (_request, _context, auth) => {
  try {
    await assertEligibleToGamble(auth.userId);
    return Response.json({ eligible: true });
  } catch (error) {
    if (error instanceof AppError && error.statusCode < 500) {
      return Response.json({ eligible: false, code: error.code, message: error.message });
    }
    return errorResponse(error);
  }
});
