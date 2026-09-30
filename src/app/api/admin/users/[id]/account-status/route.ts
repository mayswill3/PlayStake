import { withRoleGuard } from "@/lib/middleware/auth";
import { errorResponse, ValidationError } from "@/lib/errors";
import { AccountStatus, UserRole } from "../../../../../../../generated/prisma/client";
import { adminAccountStatusSchema } from "@/lib/validation/schemas";
import { setAccountStatus } from "@/lib/compliance/account-actions";

/**
 * POST /api/admin/users/:id/account-status
 *
 * Suspend, reinstate, close, or close as under-18. Audited with the reason.
 */
export const POST = withRoleGuard([UserRole.ADMIN], async (req, context, auth) => {
  try {
    const id = context?.params?.id;
    if (!id) throw new ValidationError("User ID required");
    const parsed = adminAccountStatusSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError("Invalid request", parsed.error.flatten().fieldErrors);
    }
    const result = await setAccountStatus({
      actorId: auth.userId,
      userId: id,
      status: parsed.data.status as AccountStatus,
      reason: parsed.data.reason,
      request: req,
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
});
