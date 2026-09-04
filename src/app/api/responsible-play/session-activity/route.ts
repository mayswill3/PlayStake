import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse, ValidationError } from "@/lib/errors";
import { getSessionActivity } from "@/lib/responsible-play/service";

/** Staked and net position since a timestamp, for the in-session reminder. */
export const GET = withSessionAuth(async (request, _context, auth) => {
  try {
    const since = new URL(request.url).searchParams.get("since");
    const sinceDate = since ? new Date(since) : null;

    if (!sinceDate || Number.isNaN(sinceDate.getTime())) {
      throw new ValidationError("`since` must be an ISO timestamp");
    }
    if (sinceDate > new Date()) {
      throw new ValidationError("`since` cannot be in the future");
    }

    return Response.json(await getSessionActivity(auth.userId, sinceDate));
  } catch (error) {
    return errorResponse(error);
  }
});
