import { z } from "zod";
import { withRoleGuard } from "@/lib/middleware/auth";
import { ComplaintOutcome, UserRole } from "../../../../../../generated/prisma/client";
import { ValidationError, errorResponse } from "@/lib/errors";
import { actOnComplaint, getComplaintForStaff } from "@/lib/complaints/service";

export const GET = withRoleGuard([UserRole.ADMIN], async (_request, context) => {
  try {
    const id = context?.params?.id;
    if (!id) throw new ValidationError("Complaint ID required");
    return Response.json(await getComplaintForStaff(id));
  } catch (error) {
    return errorResponse(error);
  }
});

const actionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("note"), body: z.string().max(5000) }),
  z.object({ kind: z.literal("message"), body: z.string().max(5000) }),
  z.object({ kind: z.literal("status"), status: z.enum(["INVESTIGATING", "AWAITING_CUSTOMER"]) }),
  z.object({
    kind: z.literal("final_response"),
    outcome: z.nativeEnum(ComplaintOutcome),
    response: z.string().max(10000),
  }),
]);

/** POST /api/admin/complaints/:id — add a note, message the customer, change status, or issue the final response. */
export const POST = withRoleGuard([UserRole.ADMIN], async (request, context, auth) => {
  try {
    const id = context?.params?.id;
    if (!id) throw new ValidationError("Complaint ID required");
    const parsed = actionSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError("Invalid action", parsed.error.flatten().fieldErrors);
    }
    await actOnComplaint(id, auth.userId, parsed.data, request);
    return Response.json(await getComplaintForStaff(id));
  } catch (error) {
    return errorResponse(error);
  }
});
