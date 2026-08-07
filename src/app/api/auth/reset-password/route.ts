import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "../../../../lib/db/client";
import { hashPassword, validatePasswordStrength } from "../../../../lib/auth/password";
import { resetPasswordSchema } from "../../../../lib/validation/schemas";
import { validateBody } from "../../../../lib/middleware/validate";
import { errorResponse, AppError, ValidationError } from "../../../../lib/errors/index";
import { AuthTokenType } from "../../../../../generated/prisma/client";
import { consumeAuthToken } from "../../../../lib/auth/tokens";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = validateBody(resetPasswordSchema, body);

    // Validate password strength
    const strength = validatePasswordStrength(input.newPassword);
    if (!strength.valid) {
      throw new ValidationError("Password too weak", strength.errors);
    }

    const passwordHash = await hashPassword(input.newPassword);

    await withTransaction(async (tx) => {
      const token = await consumeAuthToken(
        tx,
        input.token,
        AuthTokenType.PASSWORD_RESET,
      );
      if (!token) {
        throw new AppError("Invalid or expired token", 400, "INVALID_TOKEN");
      }

      await tx.user.update({
        where: { id: token.userId },
        data: { passwordHash },
      });
      await tx.session.deleteMany({ where: { userId: token.userId } });
      await tx.authToken.deleteMany({
        where: {
          userId: token.userId,
          type: AuthTokenType.PASSWORD_RESET,
          usedAt: null,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
