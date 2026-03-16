import type { User } from "../../../generated/prisma/client";
import { prisma } from "../db/client";
import { generateRandomToken, sha256Hash } from "../utils/crypto";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Create a new session for a user.
 *
 * Generates a random 32-byte base62 token, stores the SHA-256 hash
 * in the sessions table, and returns the raw token (to be placed in
 * the httpOnly cookie) along with the expiry timestamp.
 */
export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ sessionToken: string; expiresAt: Date }> {
  const sessionToken = generateRandomToken(32);
  const tokenHash = sha256Hash(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ? userAgent.substring(0, 500) : null,
      expiresAt,
    },
  });

  return { sessionToken, expiresAt };
}

/**
 * Validate a session token.
 *
 * Hashes the raw token, looks it up in the sessions table,
 * checks that it has not expired, and returns the associated user.
 *
 * Returns null if the token is invalid or expired.
 */
export async function validateSession(
  sessionToken: string
): Promise<{ userId: string; user: User } | null> {
  const tokenHash = sha256Hash(sessionToken);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  // Check expiry
  if (session.expiresAt < new Date()) {
    // Expired — clean it up and return null
    await prisma.session
      .delete({ where: { id: session.id } })
      .catch(() => {});
    return null;
  }

  // Check user is not soft-deleted
  if (session.user.deletedAt !== null) {
    return null;
  }

  return { userId: session.userId, user: session.user };
}

/**
 * Destroy a single session by its raw token.
 */
export async function destroySession(sessionToken: string): Promise<void> {
  const tokenHash = sha256Hash(sessionToken);
  await prisma.session
    .delete({ where: { tokenHash } })
    .catch(() => {
      // Ignore if session was already deleted
    });
}

/**
 * Destroy all sessions for a user.
 *
 * Use after password changes, 2FA changes, or security events
 * to force re-authentication on all devices.
 */
export async function destroyAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

/**
 * Delete all expired sessions from the database.
 *
 * Returns the number of sessions deleted. Intended to be called
 * periodically by a background job.
 */
export async function cleanExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
