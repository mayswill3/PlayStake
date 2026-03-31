import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/client";
import { validateSession, destroyAllUserSessions, createSession } from "../../../../lib/auth/session";
import { verifyPassword, hashPassword, validatePasswordStrength } from "../../../../lib/auth/password";
import { getSessionToken, sessionCookieValue } from "../../../../lib/auth/helpers";
import { changePasswordSchema } from "../../../../lib/validation/schemas";
import { validateBody } from "../../../../lib/middleware/validate";
import { getClientIp } from "../../../../lib/middleware/rate-limit";
import {
  errorResponse,
  AuthenticationError,
  ValidationError,
} from "../../../../lib/errors/index";

export async function PATCH(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const body = await request.json();
    const input = validateBody(changePasswordSchema, body);

    // Google-only accounts have no password to change
    if (!session.user.passwordHash) {
      throw new AuthenticationError(
        "This account uses Google Sign-In and has no password to change."
      );
    }

    // Verify current password
    const passwordValid = await verifyPassword(
      input.currentPassword,
      session.user.passwordHash
    );
    if (!passwordValid) {
      throw new AuthenticationError("Current password is incorrect");
    }

    // Validate new password strength
    const strength = validatePasswordStrength(input.newPassword);
    if (!strength.valid) {
      throw new ValidationError("New password too weak", strength.errors);
    }

    // Hash and update
    const newHash = await hashPassword(input.newPassword);
    await prisma.user.update({
      where: { id: session.userId },
      data: { passwordHash: newHash },
    });

    // Destroy all sessions (including current) to force re-auth
    await destroyAllUserSessions(session.userId);

    // Create a new session for the current user so they stay logged in
    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") ?? undefined;
    const newSession = await createSession(session.userId, ip, userAgent);

    const response = NextResponse.json({ ok: true });
    response.headers.set(
      "Set-Cookie",
      sessionCookieValue(newSession.sessionToken, newSession.expiresAt)
    );

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
