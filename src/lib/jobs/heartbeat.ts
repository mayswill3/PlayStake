// =============================================================================
// PlayStake — Worker heartbeat
// =============================================================================
// The worker process is where every time-sensitive money transition happens:
// settlement, consent and bet expiry, refunds, dispute escalation. A silent
// outage there looks exactly like a quiet night — nothing errors, nothing
// alerts, bets simply stop settling.
//
// So the process writes a heartbeat while it lives and /api/health reads it.
// The key carries a TTL a few beats long, which means a dead process needs no
// detection: Redis drops the key on its own and the health check goes red.
// =============================================================================

import { getRedisConnection } from "./queue";

export const WORKER_HEARTBEAT_KEY = "playstake:workers:heartbeat";

/** How often the worker process refreshes the key. */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * How long Redis keeps the key without a refresh. Four missed beats, so a slow
 * event loop or a brief Redis blip doesn't page anyone, but a genuinely dead
 * process shows up inside a minute.
 */
export const HEARTBEAT_TTL_SECONDS = 60;

export interface WorkerHeartbeat {
  /** ISO timestamp of the last beat. */
  at: string;
  /** Number of BullMQ workers the process booted. */
  workerCount: number;
}

/** Write a single beat. Never throws — a failed beat must not kill the process. */
export async function writeHeartbeat(workerCount: number): Promise<boolean> {
  const beat: WorkerHeartbeat = {
    at: new Date().toISOString(),
    workerCount,
  };

  try {
    await getRedisConnection().set(
      WORKER_HEARTBEAT_KEY,
      JSON.stringify(beat),
      "EX",
      HEARTBEAT_TTL_SECONDS,
    );
    return true;
  } catch {
    // The health check will report workers down, which is the correct
    // signal: if we can't reach Redis, the workers can't take jobs either.
    return false;
  }
}

/**
 * Begin beating, immediately and then on an interval.
 * Returns a stop function for graceful shutdown.
 */
export function startHeartbeat(workerCount: number): () => Promise<void> {
  void writeHeartbeat(workerCount);

  const timer = setInterval(() => {
    void writeHeartbeat(workerCount);
  }, HEARTBEAT_INTERVAL_MS);

  return async () => {
    clearInterval(timer);
    await clearHeartbeat();
  };
}

/** Read the current beat, or null if the process is gone or Redis is unreachable. */
export async function readHeartbeat(): Promise<WorkerHeartbeat | null> {
  let raw: string | null;
  try {
    raw = await getRedisConnection().get(WORKER_HEARTBEAT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as WorkerHeartbeat;
    return typeof parsed?.at === "string" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Drop the key on a clean shutdown, so a deliberate restart reports down
 * straight away rather than looking alive until the TTL lapses.
 */
export async function clearHeartbeat(): Promise<void> {
  try {
    await getRedisConnection().del(WORKER_HEARTBEAT_KEY);
  } catch {
    // Shutting down anyway; the TTL will clear it.
  }
}
