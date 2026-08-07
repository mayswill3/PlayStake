import { AuthTokenType } from "../../../../../generated/prisma/client";
import { issueAuthToken } from "@/lib/auth/tokens";
import { sendVerificationEmail } from "@/lib/email/resend";
import { withSessionAuth } from "@/lib/middleware/auth";
import { verificationEmailRateLimit } from "@/lib/middleware/rate-limit";

export const POST = withSessionAuth(async (request, _context, auth) => {
  const rateLimited = verificationEmailRateLimit(request);
  if (rateLimited) return rateLimited;

  if (auth.user.emailVerified) {
    return Response.json({ ok: true, alreadyVerified: true });
  }

  try {
    const token = await issueAuthToken(
      auth.userId,
      AuthTokenType.EMAIL_VERIFICATION,
    );
    await sendVerificationEmail({
      email: auth.user.email,
      displayName: auth.user.displayName,
      token: token.rawToken,
      tokenId: token.id,
    });
  } catch (error) {
    console.error(
      `[Auth] Verification email could not be resent for user ${auth.userId}:`,
      error,
    );
    return Response.json(
      { error: "Verification email is temporarily unavailable" },
      { status: 503 },
    );
  }

  return Response.json({ ok: true });
});
