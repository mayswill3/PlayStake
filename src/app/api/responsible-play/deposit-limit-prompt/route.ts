import { z } from "zod";
import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse, ValidationError } from "@/lib/errors";
import { recordDepositLimitPrompt } from "@/lib/responsible-play/interaction";

const promptSchema = z.object({ decision: z.literal("declined") });

/**
 * POST /api/responsible-play/deposit-limit-prompt
 *
 * The customer chose not to set a deposit limit before their first deposit.
 * (Setting one records the answer too, via PUT /deposit-limits.)
 */
export const POST = withSessionAuth(async (request, _context, auth) => {
  try {
    const parsed = promptSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError("Invalid choice");
    await recordDepositLimitPrompt(auth.userId);
    return Response.json({ recorded: true });
  } catch (error) {
    return errorResponse(error);
  }
});
