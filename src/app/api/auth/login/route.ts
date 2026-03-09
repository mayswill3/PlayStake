import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/client.js";
import { verifyPassword } from "../../../../lib/auth/password.js";
import { createSession } from "../../../../lib/auth/session.js";
import {
  checkLoginAttempts,
  recordFailedAttempt,
  clearAttempts,
} from "../../../../lib/auth/login-protection.js";
import { loginRateLimit, getClientIp } from "../../../../lib/middleware/rate-limit.js";
import { loginSchema } from "../../../../lib/validation/schemas.js";
import { validateBody } from "../../../../lib/middleware/validate.js";
import { sessionCookieValue } from "../../../../lib/auth/helpers.js";
import {
  errorResponse,
  AuthenticationError,
  RateLimitError,
} from "../../../../lib/errors/index.js";

export async function POST(request: NextRequest) {
  try {
    // Rate limit check
    const rateLimited = loginRateLimit(request);
    if (rateLimited) {
      return rateLimited;
    }

    const body = await request.json();
    const input = validateBody(loginSchema, body);

    const ip = getClientIp(request);

    // Check login attempt protection
    const attemptCheck = await checkLoginAttempts(ip);
    if (!attemptCheck.allowed) {
      throw new RateLimitError(
        `Account locked due to too many failed attempts. Try again after ${attemptCheck.lockedUntil?.toISOString() ?? "30 minutes"}.`
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user || user.deletedAt !== null) {
      await recordFailedAttempt(ip);
      throw new AuthenticationError("Invalid credentials");
    }

    // Verify password
    const passwordValid = await verifyPassword(input.password, user.passwordHash);
    if (!passwordValid) {
      await recordFailedAttempt(ip);
      throw new AuthenticationError("Invalid credentials");
    }

    // Check 2FA if enabled
    if (user.twoFactorEnabled) {
      if (!input.twoFactorCode) {
        // Don't record this as a failed attempt — credentials are correct
        return NextResponse.json(
          {
            error: "Two-factor authentication required",
            code: "2FA_REQUIRED",
            twoFactorRequired: true,
          },
          { status: 403 }
        );
      }

      // TODO: Verify TOTP code against user.twoFactorSecret
      // For now, accept any 6-digit code as a stub.
      // In production, use a TOTP library (e.g., otplib) to verify.
    }

    // Clear failed attempts on successful login
    await clearAttempts(ip);

    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Create session
    const userAgent = request.headers.get("user-agent") ?? undefined;
    const { sessionToken, expiresAt } = await createSession(
      user.id,
      ip,
      userAgent
    );

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });

    // Set session cookie
    response.headers.set(
      "Set-Cookie",
      sessionCookieValue(sessionToken, expiresAt)
    );

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
