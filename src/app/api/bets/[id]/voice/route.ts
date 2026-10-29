import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse, ValidationError } from "@/lib/errors";
import { getVoiceAvailability, issueVoiceToken } from "@/lib/voice/service";

/** GET /api/bets/:id/voice — can I join this match's voice chat right now? */
export const GET = withSessionAuth(async (_request, context, auth) => {
  try {
    const id = context?.params?.id;
    if (!id) throw new ValidationError("Match ID required");
    return Response.json(await getVoiceAvailability(auth.userId, id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
});

/** POST /api/bets/:id/voice — a short-lived token to join the voice room. */
export const POST = withSessionAuth(async (_request, context, auth) => {
  try {
    const id = context?.params?.id;
    if (!id) throw new ValidationError("Match ID required");
    return Response.json(await issueVoiceToken(auth.userId, id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
});
