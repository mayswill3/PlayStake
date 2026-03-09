/**
 * In-memory login attempt rate limiter.
 *
 * Tracks failed login attempts per identifier (typically IP address or email).
 * After MAX_ATTEMPTS failures within the WINDOW_MS, the identifier is locked
 * out for LOCKOUT_MS.
 *
 * This implementation uses a Map and is suitable for a single-process
 * deployment. For multi-process or multi-server deployments, replace
 * with a Redis-backed implementation.
 */

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes

interface AttemptRecord {
  /** Timestamps of failed attempts within the current window. */
  attempts: number[];
  /** If set, the identifier is locked until this time. */
  lockedUntil?: number;
}

const store = new Map<string, AttemptRecord>();

/**
 * Periodically clean up expired entries to prevent unbounded memory growth.
 * Runs every 5 minutes.
 */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupRunning(): void {
  if (cleanupTimer !== null) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      // Remove entries where the lockout has expired and all attempts are stale
      const lockExpired = !record.lockedUntil || record.lockedUntil <= now;
      const attemptsStale = record.attempts.every(
        (ts) => now - ts > WINDOW_MS
      );
      if (lockExpired && attemptsStale) {
        store.delete(key);
      }
    }
    // If store is empty, stop the interval to allow clean process exit
    if (store.size === 0 && cleanupTimer !== null) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow the process to exit even if the timer is running
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

/**
 * Check whether a login attempt is allowed for the given identifier.
 *
 * @returns allowed — whether the attempt should proceed.
 * @returns remainingAttempts — how many attempts remain in the current window.
 * @returns lockedUntil — if the identifier is locked, when it unlocks.
 */
export async function checkLoginAttempts(
  identifier: string
): Promise<{
  allowed: boolean;
  remainingAttempts: number;
  lockedUntil?: Date;
}> {
  const now = Date.now();
  const record = store.get(identifier);

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  // Check active lockout
  if (record.lockedUntil && record.lockedUntil > now) {
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil: new Date(record.lockedUntil),
    };
  }

  // Lockout expired — clear it
  if (record.lockedUntil && record.lockedUntil <= now) {
    record.lockedUntil = undefined;
    record.attempts = [];
  }

  // Prune attempts outside the window
  record.attempts = record.attempts.filter((ts) => now - ts < WINDOW_MS);

  const remaining = Math.max(0, MAX_ATTEMPTS - record.attempts.length);

  return { allowed: remaining > 0, remainingAttempts: remaining };
}

/**
 * Record a failed login attempt.
 *
 * If this pushes the identifier past MAX_ATTEMPTS within WINDOW_MS,
 * the identifier is locked for LOCKOUT_MS.
 */
export async function recordFailedAttempt(identifier: string): Promise<void> {
  ensureCleanupRunning();

  const now = Date.now();
  let record = store.get(identifier);

  if (!record) {
    record = { attempts: [] };
    store.set(identifier, record);
  }

  // Prune old attempts
  record.attempts = record.attempts.filter((ts) => now - ts < WINDOW_MS);

  // Record the new attempt
  record.attempts.push(now);

  // Check if we should lock
  if (record.attempts.length >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
  }
}

/**
 * Clear all recorded attempts for an identifier.
 *
 * Call this on successful login to reset the counter.
 */
export async function clearAttempts(identifier: string): Promise<void> {
  store.delete(identifier);
}

/**
 * Reset the entire store. Intended for testing only.
 */
export function _resetStore(): void {
  store.clear();
  if (cleanupTimer !== null) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
