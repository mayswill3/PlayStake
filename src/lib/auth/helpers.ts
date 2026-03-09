import { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "playstake_session";

/**
 * Extract the session token from the playstake_session cookie.
 */
export function getSessionToken(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/**
 * Build a Set-Cookie header value for the session cookie.
 */
export function sessionCookieValue(
  token: string,
  expiresAt: Date
): string {
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=${expiresAt.toUTCString()}`;
}

/**
 * Build a Set-Cookie header value that clears the session cookie.
 */
export function clearSessionCookieValue(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

/**
 * Strip sensitive fields from a user object for API responses.
 */
export function sanitizeUser(user: Record<string, unknown>): Record<string, unknown> {
  const {
    passwordHash,
    twoFactorSecret,
    deletedAt,
    stripeCustomerId,
    ...safe
  } = user;
  return safe;
}
