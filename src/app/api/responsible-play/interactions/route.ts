import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse } from "@/lib/errors";
import { listPendingPrompts } from "@/lib/responsible-play/interaction";

/** GET /api/responsible-play/interactions — messages waiting for the customer to respond to. */
export const GET = withSessionAuth(async (_request, _context, auth) => {
  try {
    return Response.json({ prompts: await listPendingPrompts(auth.userId) });
  } catch (error) {
    return errorResponse(error);
  }
});
