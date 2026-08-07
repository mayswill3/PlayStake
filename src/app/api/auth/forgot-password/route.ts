import { NextRequest, NextResponse } from "next/server";
import { forgotPasswordSchema } from "../../../../lib/validation/schemas";
import { validateBody } from "../../../../lib/middleware/validate";
import { errorResponse } from "../../../../lib/errors/index";
import { prisma } from "../../../../lib/db/client";
import { AuthTokenType } from "../../../../../generated/prisma/client";
import { issueAuthToken } from "../../../../lib/auth/tokens";
import { sendPasswordResetEmail } from "../../../../lib/email/resend";
import { passwordRecoveryRateLimit } from "../../../../lib/middleware/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const rateLimited = passwordRecoveryRateLimit(request);
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const input = validateBody(forgotPasswordSchema, body);

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        email: true,
        displayName: true,
        passwordHash: true,
        deletedAt: true,
      },
    });

    if (user?.passwordHash && user.deletedAt === null) {
      try {
        const token = await issueAuthToken(user.id, AuthTokenType.PASSWORD_RESET);
        await sendPasswordResetEmail({
          email: user.email,
          displayName: user.displayName,
          token: token.rawToken,
          tokenId: token.id,
        });
      } catch (emailError) {
        // Keep the public response identical to prevent account enumeration.
        console.error(
          `[Auth] Password reset email could not be sent for user ${user.id}:`,
          emailError,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      message: "If an eligible account exists, a reset link has been sent.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
