import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse, ValidationError } from "@/lib/errors";
import { getPlayerProfile } from "@/lib/users/directory";

/** GET /api/users/:username — a player's public profile (identity only). */
export const GET = withSessionAuth(async (_request, context, auth) => {
  try {
    const username = context?.params?.username;
    if (!username) throw new ValidationError("Username required");
    return Response.json({ profile: await getPlayerProfile(auth.userId, username) });
  } catch (error) {
    return errorResponse(error);
  }
});
