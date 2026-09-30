import { AccountStatus, type User } from "../../../generated/prisma/client";
import { prisma } from "../db/client";
import { generateRandomToken, sha256Hash } from "../utils/crypto";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
/** A session nobody has used for this long is signed out. */
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
/** Don't rewrite lastSeenAt on every request; once a minute is plenty. */
const LAST_SEEN_RESOLUTION_MS = 60 * 1000;

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

  const now = new Date();

  // Check expiry: absolute lifetime, or left idle too long (an unattended
  // device should not stay signed in to a real-money account).
  if (
    session.expiresAt < now ||
    now.getTime() - session.lastSeenAt.getTime() > SESSION_IDLE_TIMEOUT_MS
  ) {
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

  // Closed accounts (including under-18 closures) cannot be used at all.
  // Suspended ones can still sign in — to see their balance and contact
  // support — but the eligibility gate blocks deposits and gambling.
  if (
    session.user.accountStatus === AccountStatus.CLOSED ||
    session.user.accountStatus === AccountStatus.CLOSED_UNDERAGE
  ) {
    return null;
  }

  if (now.getTime() - session.lastSeenAt.getTime() > LAST_SEEN_RESOLUTION_MS) {
    await prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: now } })
      .catch(() => {});
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
 * Delete all expired or idle-timed-out sessions from the database.
 *
 * Returns the number of sessions deleted. Intended to be called
 * periodically by a background job.
 */
export async function cleanExpiredSessions(now: Date = new Date()): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        { lastSeenAt: { lt: new Date(now.getTime() - SESSION_IDLE_TIMEOUT_MS) } },
      ],
    },
  });
  return result.count;
}
