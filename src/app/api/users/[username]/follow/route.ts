import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse, ValidationError } from "@/lib/errors";
import { followPlayer, unfollowPlayer } from "@/lib/users/directory";

/** POST /api/users/:username/follow — follow this player. */
export const POST = withSessionAuth(async (_request, context, auth) => {
  try {
    const username = context?.params?.username;
    if (!username) throw new ValidationError("Username required");
    await followPlayer(auth.userId, username);
    return Response.json({ following: true });
  } catch (error) {
    return errorResponse(error);
  }
});

/** DELETE /api/users/:username/follow — stop following. */
export const DELETE = withSessionAuth(async (_request, context, auth) => {
  try {
    const username = context?.params?.username;
    if (!username) throw new ValidationError("Username required");
    await unfollowPlayer(auth.userId, username);
    return Response.json({ following: false });
  } catch (error) {
    return errorResponse(error);
  }
});
