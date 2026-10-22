import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse, ValidationError } from "@/lib/errors";
import { applyDiditDecision } from "@/lib/kyc/didit-decisions";
import { getDiditDecision, isDiditEnabled } from "@/lib/kyc/didit";
import { getKycState } from "@/lib/kyc/service";

/**
 * POST /api/kyc/didit/sync — called when the player comes back from Didit.
 * Reads the decision straight away rather than waiting for the webhook.
 * Only the player the session belongs to can sync it.
 */
export const POST = withSessionAuth(async (request, _context, auth) => {
  try {
    const body = (await request.json().catch(() => ({}))) as { sessionId?: unknown };
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new ValidationError("A Didit session id is required");
    if (!isDiditEnabled()) return Response.json({ outcome: "ignored", state: await getKycState(auth.userId) });

    const decision = await getDiditDecision(sessionId);
    const outcome = decision.vendor_data === auth.userId ? await applyDiditDecision(decision) : "ignored";
    return Response.json({ outcome, status: decision.status, state: await getKycState(auth.userId) });
  } catch (error) {
    if (error instanceof Error && error.name === "DiditApiError") {
      console.error("[KYC] Didit decision could not be read:", error.message);
      return Response.json({ outcome: "ignored", error: "We'll update your status as soon as Didit confirms the result." }, { status: 202 });
    }
    return errorResponse(error);
  }
});
