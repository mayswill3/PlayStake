import { z } from "zod";
import { withRoleGuard } from "@/lib/middleware/auth";
import { UserRole } from "../../../../../../generated/prisma/client";
import { NotFoundError, ValidationError, errorResponse } from "@/lib/errors";
import { actOnAmlCase, getAmlCaseForStaff } from "@/lib/compliance/aml";

export const GET = withRoleGuard([UserRole.ADMIN], async (_request, context) => {
  try {
    const id = context?.params?.id;
    if (!id) throw new ValidationError("Case ID required");
    const amlCase = await getAmlCaseForStaff(id);
    if (!amlCase) throw new NotFoundError("Case not found");
    return Response.json(amlCase);
  } catch (error) {
    return errorResponse(error);
  }
});

const actionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("assign") }),
  z.object({ kind: z.literal("note"), body: z.string().max(5000) }),
  z.object({ kind: z.literal("escalate"), decision: z.string().max(5000) }),
  z.object({ kind: z.literal("sar"), sarReference: z.string().max(100), decision: z.string().max(5000) }),
  z.object({
    kind: z.literal("close"),
    outcome: z.enum(["CLOSED_NO_ACTION", "CLOSED_ACTION_TAKEN"]),
    decision: z.string().max(5000),
  }),
]);

/** POST /api/admin/aml/:id — assign, note, escalate to the MLRO, record a SAR, or close. */
export const POST = withRoleGuard([UserRole.ADMIN], async (request, context, auth) => {
  try {
    const id = context?.params?.id;
    if (!id) throw new ValidationError("Case ID required");
    const parsed = actionSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError("Invalid action", parsed.error.flatten().fieldErrors);
    await actOnAmlCase(id, auth.userId, parsed.data, request);
    return Response.json(await getAmlCaseForStaff(id));
  } catch (error) {
    return errorResponse(error);
  }
});
