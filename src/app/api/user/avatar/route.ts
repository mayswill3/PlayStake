import { withSessionAuth } from "@/lib/middleware/auth";
import { avatarUploadRateLimit } from "@/lib/middleware/rate-limit";
import { errorResponse, ValidationError } from "@/lib/errors";
import { MAX_AVATAR_UPLOAD_BYTES, removeAvatar, saveAvatar } from "@/lib/avatars/service";

/** POST /api/user/avatar — upload a profile photo (multipart field "avatar"). */
export const POST = withSessionAuth(async (request, _context, auth) => {
  try {
    const limited = avatarUploadRateLimit(request);
    if (limited) return limited;

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ValidationError("Expected a multipart/form-data upload");
    }
    const file = form.get("avatar");
    if (!(file instanceof File)) throw new ValidationError("Choose an image to upload");
    // Reject oversized files before buffering them into memory.
    if (file.size > MAX_AVATAR_UPLOAD_BYTES) {
      throw new ValidationError("That image is over 5MB. Choose a smaller one.");
    }

    const avatarUrl = await saveAvatar(auth.userId, Buffer.from(await file.arrayBuffer()));
    return Response.json({ avatarUrl });
  } catch (error) {
    return errorResponse(error);
  }
});

/** DELETE /api/user/avatar — remove the profile photo. */
export const DELETE = withSessionAuth(async (_request, _context, auth) => {
  try {
    await removeAvatar(auth.userId);
    return Response.json({ avatarUrl: null });
  } catch (error) {
    return errorResponse(error);
  }
});
