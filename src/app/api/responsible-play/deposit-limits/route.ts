import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse, ValidationError } from "@/lib/errors";
import {
  cancelPendingIncrease,
  removeDepositLimit,
  setDepositLimit,
} from "@/lib/responsible-play/service";
import {
  removeDepositLimitSchema,
  setDepositLimitSchema,
} from "@/lib/validation/schemas";
import { DepositLimitPeriod } from "../../../../../generated/prisma/client";

export const PUT = withSessionAuth(async (request, _context, auth) => {
  try {
    const parsed = setDepositLimitSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ValidationError(
        "Invalid deposit limit",
        parsed.error.flatten().fieldErrors,
      );
    }

    const result = await setDepositLimit(
      auth.userId,
      parsed.data.period as DepositLimitPeriod,
      parsed.data.amount,
    );
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
});

export const DELETE = withSessionAuth(async (request, _context, auth) => {
  try {
    const parsed = removeDepositLimitSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ValidationError(
        "Invalid request",
        parsed.error.flatten().fieldErrors,
      );
    }

    const period = parsed.data.period as DepositLimitPeriod;
    if (parsed.data.scope === "pending") {
      await cancelPendingIncrease(auth.userId, period);
    } else {
      // Dropping a limit loosens things, so it goes through the same staged
      // path as a raise rather than taking effect at once.
      await removeDepositLimit(auth.userId, period);
    }

    return Response.json({ period, scope: parsed.data.scope });
  } catch (error) {
    return errorResponse(error);
  }
});
