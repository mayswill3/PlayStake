import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse, ValidationError } from "@/lib/errors";
import { adminResolveDisputeSchema } from "@/lib/validation/schemas";
import { auditContextFromRequest } from "@/lib/referees/audit";
import { claimDispute, getDisputeEvidence, resolveDispute } from "@/lib/disputes/review";

/** GET /api/referees/disputes/:id — the evidence for a dispute you may review. */
export const GET = withSessionAuth(async (_request, context, auth) => {
  try {
    const id = context?.params?.id;
    if (!id) throw new ValidationError("Dispute ID required");
    return Response.json(await getDisputeEvidence(auth.userId, id));
  } catch (error) {
    return errorResponse(error);
  }
});

/** POST /api/referees/disputes/:id — take the dispute so only you decide it. */
export const POST = withSessionAuth(async (request, context, auth) => {
  try {
    const id = context?.params?.id;
    if (!id) throw new ValidationError("Dispute ID required");
    return Response.json(await claimDispute(auth.userId, id, auditContextFromRequest(request)));
  } catch (error) {
    return errorResponse(error);
  }
});

/** PATCH /api/referees/disputes/:id — decide it, with written reasons. */
export const PATCH = withSessionAuth(async (request, context, auth) => {
  try {
    const id = context?.params?.id;
    if (!id) throw new ValidationError("Dispute ID required");
    const parsed = adminResolveDisputeSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError("Invalid decision", parsed.error.flatten().fieldErrors);
    return Response.json(
      await resolveDispute({
        userId: auth.userId,
        disputeId: id,
        status: parsed.data.status,
        resolution: parsed.data.resolution,
        context: auditContextFromRequest(request),
        request,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
});
