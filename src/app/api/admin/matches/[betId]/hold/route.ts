import { withRoleGuard } from "@/lib/middleware/auth";
import { errorResponse, ValidationError } from "@/lib/errors";
import { UserRole } from "../../../../../../../generated/prisma/client";
import { setRecordingHold } from "@/lib/recordings/admin-access";

/** POST /api/admin/matches/:betId/hold { hold, reason } — place or release an investigation hold. */
export const POST = withRoleGuard([UserRole.ADMIN], async (request, context, auth) => {
  try {
    const betId = context?.params?.betId;
    if (!betId) throw new ValidationError("Match ID required");
    const body = (await request.json().catch(() => ({}))) as { hold?: boolean; reason?: string };
    return Response.json(
      await setRecordingHold({ adminId: auth.userId, betId, hold: body.hold === true, reason: body.reason ?? "", request }),
    );
  } catch (error) {
    return errorResponse(error);
  }
});
