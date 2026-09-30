import { z } from "zod";
import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse, ValidationError } from "@/lib/errors";
import { requestReturnFromSelfExclusion } from "@/lib/responsible-play/service";

const returnSchema = z.object({
  /** Returning is a deliberate decision; the client must confirm it. */
  acknowledged: z.literal(true),
});

/**
 * POST /api/responsible-play/break/return
 *
 * Ask to come back after a self-exclusion period has ended. Nothing reopens
 * straight away: access resumes after a 24-hour cooling-off.
 */
export const POST = withSessionAuth(async (request, _context, auth) => {
  try {
    const parsed = returnSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError("Please confirm you want to return");
    }
    const { returnEffectiveAt } = await requestReturnFromSelfExclusion(auth.userId);
    return Response.json({ returnEffectiveAt: returnEffectiveAt.toISOString() });
  } catch (error) {
    return errorResponse(error);
  }
});
