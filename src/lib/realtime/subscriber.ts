// =============================================================================
// PlayStake — Shared Redis subscriber
// =============================================================================
// One subscriber connection per process, fanned out to every listener, so the
// number of Redis connections doesn't grow with the number of open SSE tabs.
// ioredis re-subscribes to active channels on reconnect.
// =============================================================================

import type IORedis from "ioredis";
import { getRedisConnection } from "@/lib/jobs/queue";

type Listener = (message: string) => void;

/** How long a first subscribe may take before the caller gives up on SSE. */
const SUBSCRIBE_TIMEOUT_MS = 2000;

let _subscriber: IORedis | undefined;
const listeners = new Map<string, Set<Listener>>();

function getSubscriber(): IORedis {
  if (!_subscriber) {
    _subscriber = getRedisConnection().duplicate();
    _subscriber.on("message", (channel: string, message: string) => {
      for (const listener of listeners.get(channel) ?? []) {
        try {
          listener(message);
        } catch (err) {
          console.error("[REALTIME] listener failed", err);
        }
      }
    });
    // Swallow connection errors so an unhandled 'error' can't crash the process.
    _subscriber.on("error", (err) => {
      console.error("[REALTIME] redis subscriber error:", err.message);
    });
  }
  return _subscriber;
}

async function subscribeWithTimeout(channel: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      getSubscriber().subscribe(channel),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`subscribe timed out after ${SUBSCRIBE_TIMEOUT_MS}ms`)),
          SUBSCRIBE_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Call `listener` for every message on `channel`. Resolves to an unsubscribe
 * function; rejects if Redis can't be reached, so callers can fall back.
 */
export async function subscribeChannel(
  channel: string,
  listener: Listener,
): Promise<() => void> {
  let set = listeners.get(channel);
  if (!set) {
    set = new Set();
    listeners.set(channel, set);
  }
  set.add(listener);

  if (set.size === 1) {
    try {
      await subscribeWithTimeout(channel);
    } catch (err) {
      unsubscribe(channel, listener);
      throw err;
    }
  }

  return () => unsubscribe(channel, listener);
}

function unsubscribe(channel: string, listener: Listener): void {
  const set = listeners.get(channel);
  if (!set?.delete(listener)) return;
  if (set.size === 0) {
    listeners.delete(channel);
    void getSubscriber().unsubscribe(channel).catch(() => {});
  }
}
