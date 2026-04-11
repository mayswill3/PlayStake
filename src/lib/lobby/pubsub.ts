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

function getPublisher(): IORedis {
  if (!_publisher) {
    // duplicate() returns a fresh connection using the same options
    _publisher = getRedisConnection().duplicate();
  }
  return _publisher;
}

/**
 * Publish an event to a lobby channel. Never throws — errors are logged and
 * swallowed so that API routes never fail due to pub/sub issues.
 */
export async function publishLobbyEvent(
  channel: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await getPublisher().publish(channel, JSON.stringify(payload));
  } catch (err) {
    console.error("[LOBBY_PUBSUB] publish failed", { channel, err });
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
