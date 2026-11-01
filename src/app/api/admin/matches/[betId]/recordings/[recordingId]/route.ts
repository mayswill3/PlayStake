import { withRoleGuard } from "@/lib/middleware/auth";
import { errorResponse, ValidationError } from "@/lib/errors";
import { UserRole } from "../../../../../../../../generated/prisma/client";
import { getAdminPlayback } from "@/lib/recordings/admin-access";

/**
 * POST /api/admin/matches/:betId/recordings/:recordingId { reason, note }
 * A 15-minute link to watch or listen, for a stated reason. Logged.
 */
export const POST = withRoleGuard([UserRole.ADMIN], async (request, context, auth) => {
  try {
    const betId = context?.params?.betId;
    const recordingId = context?.params?.recordingId;
    if (!betId || !recordingId) throw new ValidationError("Match and recording IDs required");
    const body = (await request.json().catch(() => ({}))) as { reason?: string; note?: string };
    const playback = await getAdminPlayback({
      adminId: auth.userId, betId, recordingId, reason: body.reason ?? "", note: body.note ?? "", request,
    });
    return Response.json(playback, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
});
