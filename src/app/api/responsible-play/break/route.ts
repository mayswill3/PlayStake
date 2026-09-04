import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse, ValidationError } from "@/lib/errors";
import { startBreak } from "@/lib/responsible-play/service";
import { startPlayBreakSchema } from "@/lib/validation/schemas";
import { PlayBreakType } from "../../../../../generated/prisma/client";

export const POST = withSessionAuth(async (request, _context, auth) => {
  try {
    const parsed = startPlayBreakSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ValidationError(
        "Invalid break request",
        parsed.error.flatten().fieldErrors,
      );
    }

    const started = await startBreak(
      auth.userId,
      parsed.data.type as PlayBreakType,
      parsed.data.optionId,
    );

    return Response.json(started, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
});
