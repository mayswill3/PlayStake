import { z } from "zod";
import { withRoleGuard } from "@/lib/middleware/auth";
import { ValidationError, errorResponse } from "@/lib/errors";
import { PlayBreakType, UserRole } from "../../../../../../../generated/prisma/client";
import { startBreak } from "@/lib/responsible-play/service";
import { recordAdminAction } from "@/lib/admin/audit";
import { emailBreakStarted } from "@/lib/email/events";

const schema = z.object({
  optionId: z.enum(["6mo", "1y", "2y", "5y"]),
  /** How the request reached us, e.g. "Customer emailed support on 3 Oct asking to self-exclude for 1 year". */
  reason: z.string().trim().min(10, "Record how the customer asked (at least 10 characters)").max(500),
});

/**
 * POST /api/admin/users/:id/self-exclusion
 *
 * Self-exclude a customer who asked by email or phone rather than through
 * Responsible play. Same rules as self-service: it can't be shortened or
 * lifted early by anyone, and open activity is withdrawn.
 */
export const POST = withRoleGuard([UserRole.ADMIN], async (request, context, auth) => {
  try {
    const id = context?.params?.id;
    if (!id) throw new ValidationError("User ID required");
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError("Invalid request", parsed.error.flatten().fieldErrors);

    const started = await startBreak(id, PlayBreakType.SELF_EXCLUSION, parsed.data.optionId);
    await recordAdminAction({
      actorId: auth.userId,
      action: "user.self_exclusion",
      targetType: "user",
      targetId: id,
      details: { optionId: parsed.data.optionId, endsAt: started.endsAt.toISOString(), reason: parsed.data.reason },
      request,
    });
    await emailBreakStarted({ userId: id, breakId: started.id, kind: started.type, endsAt: started.endsAt });
    return Response.json(started, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
});
