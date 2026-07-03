// =============================================================================
// PlayStake — Lobby Pub/Sub Helper
// =============================================================================
// Lightweight wrapper around Redis pub/sub for lobby real-time events.
// Uses a separate connection from BullMQ (IORedis pub/sub locks the connection
// into subscribe mode, so we cannot share it with queue operations).
// Fails silently — polling fallback (GET /api/lobby/status) is the safety net.
// =============================================================================

import type IORedis from "ioredis";
import { getRedisConnection } from "@/lib/jobs/queue";

let _publisher: IORedis | undefined;

/**
 * Hard upper bound on how long a publish may take. Even a fail-fast connection
 * can leave a command pending across a reconnect window, so we race every
 * publish against this timeout — the API route that awaits it must never block
 * on pub/sub (polling is the safety net).
 */
const PUBLISH_TIMEOUT_MS = 1000;

function getPublisher(): IORedis {
  if (!_publisher) {
    // duplicate() inherits the base connection's options — which for the
    // BullMQ connection means `maxRetriesPerRequest: null` and (by default)
    // `enableOfflineQueue: true`. With those, a publish to an unreachable
    // Redis is queued and NEVER settles, hanging whatever route awaited it
    // (e.g. /api/lobby/join → stuck "Joining lobby…"). Override with
    // fail-fast options so an unavailable Redis rejects immediately instead.
    _publisher = getRedisConnection().duplicate({
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 1000,
    });
    // A disconnected fail-fast connection emits 'error' events; swallow them
    // so an unhandled 'error' can't crash the process.
    _publisher.on("error", (err) => {
      console.error("[LOBBY_PUBSUB] redis connection error:", err.message);
    });
  }
  return _publisher;
}

/**
 * Publish an event to a lobby channel. Never throws and never blocks longer
 * than PUBLISH_TIMEOUT_MS — errors and timeouts are logged and swallowed so
 * that API routes never fail (or hang) due to pub/sub issues.
 */
export async function publishLobbyEvent(
  channel: string,
  payload: Record<string, unknown>
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`publish timed out after ${PUBLISH_TIMEOUT_MS}ms`)),
        PUBLISH_TIMEOUT_MS
      );
    });
    await Promise.race([
      getPublisher().publish(channel, JSON.stringify(payload)),
      timeout,
    ]);
  } catch (err) {
    console.error("[LOBBY_PUBSUB] publish failed", {
      channel,
      err: err instanceof Error ? err.message : err,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Channel name helpers — keep all channel naming in one place.
 */
export const LobbyChannels = {
  game: (gameType: string) => `lobby:${gameType}`,
  invite: (userId: string) => `lobby:invite:${userId}`,
  matched: (userId: string) => `lobby:matched:${userId}`,
  inviteDeclined: (userId: string) => `lobby:invite-declined:${userId}`,
  inviteExpired: (userId: string) => `lobby:invite-expired:${userId}`,
  expired: (userId: string) => `lobby:expired:${userId}`,
};
