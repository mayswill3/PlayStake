import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse, ValidationError } from "@/lib/errors";
import { auditContextFromRequest } from "@/lib/referees/audit";
import { withdrawFromMatch } from "@/lib/matches/withdraw";

/**
 * POST /api/bets/:id/withdraw — pull out of an agreed match before the
 * referee presses Start. Voids it and refunds both stakes in full.
 */
export const POST = withSessionAuth(async (request, context, auth) => {
  try {
    const id = context?.params?.id;
    if (!id) throw new ValidationError("Match ID required");
    return Response.json(await withdrawFromMatch({ userId: auth.userId, betId: id, context: auditContextFromRequest(request) }));
  } catch (error) {
    return errorResponse(error);
  }
});
