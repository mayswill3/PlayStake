import { z } from "zod";
import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse, ValidationError } from "@/lib/errors";
import { respondToPrompt } from "@/lib/responsible-play/interaction";

const responseSchema = z.object({ response: z.enum(["ok", "set_limit", "take_break"]) });

/** POST /api/responsible-play/interactions/:id — the customer responds to a message. */
export const POST = withSessionAuth(async (request, context, auth) => {
  try {
    const id = context?.params?.id;
    if (!id) throw new ValidationError("Message ID required");
    const parsed = responseSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError("Invalid response");
    await respondToPrompt(auth.userId, id, parsed.data.response);
    return Response.json({ acknowledged: true });
  } catch (error) {
    return errorResponse(error);
  }
});
