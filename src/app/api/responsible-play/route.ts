import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse, ValidationError } from "@/lib/errors";
import {
  getResponsiblePlayState,
  setSessionReminderMinutes,
} from "@/lib/responsible-play/service";
import {
  BREAK_OPTIONS,
  PERIOD_LABEL,
  SESSION_REMINDER_INTERVALS,
} from "@/lib/responsible-play/constants";
import { sessionReminderSchema } from "@/lib/validation/schemas";

export const GET = withSessionAuth(async (_request, _context, auth) => {
  try {
    const state = await getResponsiblePlayState(auth.userId);
    return Response.json({
      ...state,
      options: {
        breaks: BREAK_OPTIONS,
        periodLabels: PERIOD_LABEL,
        reminderIntervals: SESSION_REMINDER_INTERVALS,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
});

export const PATCH = withSessionAuth(async (request, _context, auth) => {
  try {
    const parsed = sessionReminderSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ValidationError(
        "Invalid reminder interval",
        parsed.error.flatten().fieldErrors,
      );
    }

    await setSessionReminderMinutes(auth.userId, parsed.data.minutes);
    return Response.json({ sessionReminderMinutes: parsed.data.minutes });
  } catch (error) {
    return errorResponse(error);
  }
});
