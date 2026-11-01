import { withRoleGuard } from "@/lib/middleware/auth";
import { errorResponse, ValidationError } from "@/lib/errors";
import { UserRole } from "../../../../../../generated/prisma/client";
import { RECORDING_ACCESS_REASONS, getMatchRecordingsForAdmin } from "@/lib/recordings/admin-access";

/** GET /api/admin/matches/:betId — the match and its recordings (links need a reason). */
export const GET = withRoleGuard([UserRole.ADMIN], async (_request, context, auth) => {
  try {
    const betId = context?.params?.betId;
    if (!betId) throw new ValidationError("Match ID required");
    return Response.json({ match: await getMatchRecordingsForAdmin(auth.userId, betId), reasons: RECORDING_ACCESS_REASONS });
  } catch (error) {
    return errorResponse(error);
  }
});
