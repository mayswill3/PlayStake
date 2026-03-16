// =============================================================================
// PlayStake — BullMQ Queue Setup
// =============================================================================
// Central Redis connection and named queue instances for all background jobs.
// =============================================================================

import { Queue } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_NAMES, type QueueName } from "./types";

// ---------------------------------------------------------------------------
// Redis connection (shared across all queues and workers)
// ---------------------------------------------------------------------------

let _connection: IORedis | undefined;

export function getRedisConnection(): IORedis {
  if (!_connection) {
    const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
    _connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false,
    });
  }
  return _connection;
}

// ---------------------------------------------------------------------------
// Queue instances — one per named queue
// ---------------------------------------------------------------------------

const _queues = new Map<string, Queue>();

export function getQueue<T = unknown>(name: QueueName): Queue<T> {
  if (!_queues.has(name)) {
    const queue = new Queue<T>(name, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    });
    _queues.set(name, queue);
  }
  return _queues.get(name) as Queue<T>;
}

// ---------------------------------------------------------------------------
// Convenience: get all queues at once
// ---------------------------------------------------------------------------

export function getAllQueues(): Map<string, Queue> {
  for (const name of Object.values(QUEUE_NAMES)) {
    getQueue(name);
  }
  return _queues;
}

// ---------------------------------------------------------------------------
// Helper to add a job to a named queue
// ---------------------------------------------------------------------------

export async function addJob<T>(
  queueName: QueueName,
  jobName: string,
  data: T,
  opts?: { delay?: number; priority?: number; jobId?: string }
): Promise<void> {
  const queue = getQueue<T>(queueName);
  await queue.add(jobName, data, {
    delay: opts?.delay,
    priority: opts?.priority,
    jobId: opts?.jobId,
  });
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

export async function closeAllQueues(): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const queue of _queues.values()) {
    promises.push(queue.close());
  }
  await Promise.all(promises);
  _queues.clear();

  if (_connection) {
    await _connection.quit();
    _connection = undefined;
  }
}
