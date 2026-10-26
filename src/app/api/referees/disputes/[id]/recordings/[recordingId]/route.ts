import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse, ValidationError } from "@/lib/errors";
import { getDisputePlayback } from "@/lib/recordings/service";

/**
 * GET /api/referees/disputes/:id/recordings/:recordingId — a 15-minute private
 * link to watch the match recording. Admins and the dispute's reviewers only,
 * under the same conflict checks as the evidence; every viewing is logged.
 */
export const GET = withSessionAuth(async (request, context, auth) => {
  try {
    const id = context?.params?.id;
    const recordingId = context?.params?.recordingId;
    if (!id || !recordingId) throw new ValidationError("Dispute and recording IDs required");
    const playback = await getDisputePlayback(auth.userId, id, recordingId, request);
    return Response.json(playback, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
});
