import { z } from "zod";
import { withRoleGuard } from "@/lib/middleware/auth";
import {
  DepositLimitPeriod,
  InteractionOutcome,
  UserRole,
} from "../../../../../../generated/prisma/client";
import { ValidationError, errorResponse } from "@/lib/errors";
import { actOnSignal, getSignalForStaff } from "@/lib/responsible-play/interaction";

export const GET = withRoleGuard([UserRole.ADMIN], async (_request, context) => {
  try {
    const id = context?.params?.id;
    if (!id) throw new ValidationError("Signal ID required");
    return Response.json(await getSignalForStaff(id));
  } catch (error) {
    return errorResponse(error);
  }
});

const actionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("review"), status: z.enum(["REVIEWED", "DISMISSED"]), notes: z.string().max(5000) }),
  z.object({
    kind: z.literal("interaction"),
    type: z.enum(["EMAIL", "PHONE_CALL", "NOTE"]),
    message: z.string().max(5000),
    followUpDays: z.number().int().min(1).max(90).optional(),
  }),
  z.object({
    kind: z.literal("apply_limit"),
    period: z.nativeEnum(DepositLimitPeriod),
    amountCents: z.number().int().positive(),
    message: z.string().max(2000),
  }),
  z.object({ kind: z.literal("apply_cool_off"), optionId: z.string().max(10), message: z.string().max(2000) }),
  z.object({
    kind: z.literal("outcome"),
    interactionId: z.string().uuid(),
    outcome: z.nativeEnum(InteractionOutcome),
    notes: z.string().max(5000),
  }),
]);

/** POST /api/admin/harm-signals/:id — review, record an interaction, apply a limit or cool-off, or record an outcome. */
export const POST = withRoleGuard([UserRole.ADMIN], async (request, context, auth) => {
  try {
    const id = context?.params?.id;
    if (!id) throw new ValidationError("Signal ID required");
    const parsed = actionSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError("Invalid action", parsed.error.flatten().fieldErrors);
    await actOnSignal(id, auth.userId, parsed.data, request);
    return Response.json(await getSignalForStaff(id));
  } catch (error) {
    return errorResponse(error);
  }
});
