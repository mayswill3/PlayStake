import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "../../../../lib/db/client";
import { verifyEmailSchema } from "../../../../lib/validation/schemas";
import { validateBody } from "../../../../lib/middleware/validate";
import { errorResponse, AppError } from "../../../../lib/errors/index";
import { AuthTokenType } from "../../../../../generated/prisma/client";
import { consumeAuthToken } from "../../../../lib/auth/tokens";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = validateBody(verifyEmailSchema, body);

    await withTransaction(async (tx) => {
      const token = await consumeAuthToken(
        tx,
        input.token,
        AuthTokenType.EMAIL_VERIFICATION,
        { allowAlreadyUsed: true },
      );
      if (!token) {
        throw new AppError("Invalid or expired token", 400, "INVALID_TOKEN");
      }

      await tx.user.update({
        where: { id: token.userId },
        data: { emailVerified: true },
      });
      await tx.authToken.deleteMany({
        where: {
          userId: token.userId,
          type: AuthTokenType.EMAIL_VERIFICATION,
          usedAt: null,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
