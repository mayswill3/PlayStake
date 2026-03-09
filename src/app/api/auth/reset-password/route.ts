import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/client.js";
import { hashPassword, validatePasswordStrength } from "../../../../lib/auth/password.js";
import { destroyAllUserSessions } from "../../../../lib/auth/session.js";
import { resetPasswordSchema } from "../../../../lib/validation/schemas.js";
import { validateBody } from "../../../../lib/middleware/validate.js";
import { errorResponse, AppError, ValidationError } from "../../../../lib/errors/index.js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = validateBody(resetPasswordSchema, body);

    // Validate password strength
    const strength = validatePasswordStrength(input.newPassword);
    if (!strength.valid) {
      throw new ValidationError("Password too weak", strength.errors);
    }

    // TODO: In production, verify a signed token that encodes the user ID
    // and expiry, and check it against a stored token hash. For now, we
    // treat the token as the user ID directly (stub).

    const user = await prisma.user.findUnique({
      where: { id: input.token },
    });

    if (!user) {
      throw new AppError("Invalid or expired token", 400, "INVALID_TOKEN");
    }

    const passwordHash = await hashPassword(input.newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Destroy all sessions to force re-authentication
    await destroyAllUserSessions(user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
