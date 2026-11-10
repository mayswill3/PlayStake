import { withSessionAuth } from "@/lib/middleware/auth";
import { kycSubmissionRateLimit } from "@/lib/middleware/rate-limit";
import { errorResponse } from "@/lib/errors";
import { getAddressStatus, startAddressUpdate } from "@/lib/kyc/address-update";

/** GET /api/kyc/address — your verified address and any update in progress. */
export const GET = withSessionAuth(async (_request, _context, auth) => {
  try {
    return Response.json(await getAddressStatus(auth.userId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
});

/** POST /api/kyc/address — start a proof-of-address check for a new address. */
export const POST = withSessionAuth(async (request, _context, auth) => {
  try {
    const limited = kycSubmissionRateLimit(request);
    if (limited) return limited;
    return Response.json(await startAddressUpdate(auth.userId));
  } catch (error) {
    if (error instanceof Error && error.name === "DiditApiError") {
      console.error("[KYC] Didit address session could not be created:", error.message);
      return Response.json({ error: "Address updates aren't available right now. Try again shortly." }, { status: 503 });
    }
    return errorResponse(error);
  }
});
