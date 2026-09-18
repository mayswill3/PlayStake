import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse, ValidationError } from "@/lib/errors";
import { startBreak } from "@/lib/responsible-play/service";
import { startPlayBreakSchema } from "@/lib/validation/schemas";
import { PlayBreakType } from "../../../../../generated/prisma/client";
import { emailBreakStarted } from "@/lib/email/events";

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

    await emailBreakStarted({
      userId: auth.userId,
      breakId: started.id,
      kind: started.type,
      endsAt: started.endsAt,
    });

    return Response.json(started, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
});
