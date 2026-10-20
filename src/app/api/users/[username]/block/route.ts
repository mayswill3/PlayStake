import { withSessionAuth } from "@/lib/middleware/auth";
import { errorResponse, ValidationError } from "@/lib/errors";
import { blockPlayer, unblockPlayer } from "@/lib/users/directory";

/** POST /api/users/:username/block — block this player. */
export const POST = withSessionAuth(async (_request, context, auth) => {
  try {
    const username = context?.params?.username;
    if (!username) throw new ValidationError("Username required");
    await blockPlayer(auth.userId, username);
    return Response.json({ blocked: true });
  } catch (error) {
    return errorResponse(error);
  }
});

/** DELETE /api/users/:username/block — unblock. */
export const DELETE = withSessionAuth(async (_request, context, auth) => {
  try {
    const username = context?.params?.username;
    if (!username) throw new ValidationError("Username required");
    await unblockPlayer(auth.userId, username);
    return Response.json({ blocked: false });
  } catch (error) {
    return errorResponse(error);
  }
});
