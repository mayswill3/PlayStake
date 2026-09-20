// =============================================================================
// PlayStake — Health check
// =============================================================================
// GET /api/health — what an uptime monitor polls.
//
// 200 when the web process can reach Postgres and Redis and the worker process
// is beating; 503 otherwise. Deliberately unauthenticated, because a monitor
// has no session, and deliberately thin on detail, because it is public: each
// check reports up or down and how long it took, never why it failed. The
// reason belongs in the logs, not on an open endpoint.
// =============================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getRedisConnection } from "@/lib/jobs/queue";
import { readHeartbeat, HEARTBEAT_TTL_SECONDS } from "@/lib/jobs/heartbeat";

/** Never cache a health check. */
export const dynamic = "force-dynamic";

/** A hung dependency must not hang the monitor. */
const CHECK_TIMEOUT_MS = 3_000;

type CheckStatus = "up" | "down";

interface CheckResult {
  status: CheckStatus;
  latencyMs: number;
}

interface WorkerCheckResult extends CheckResult {
  /** Seconds since the worker process last beat, when it is up. */
  lastBeatSecondsAgo?: number;
  workerCount?: number;
}

/** Resolve to null rather than hanging past the deadline. */
async function withTimeout<T>(work: Promise<T>): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), CHECK_TIMEOUT_MS);
  });

  try {
    return await Promise.race([work, deadline]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function checkDatabase(): Promise<CheckResult> {
  const startedAt = Date.now();
  const result = await withTimeout(prisma.$queryRaw`SELECT 1`);
  return {
    status: result === null ? "down" : "up",
    latencyMs: Date.now() - startedAt,
  };
}

async function checkRedis(): Promise<CheckResult> {
  const startedAt = Date.now();
  const result = await withTimeout(getRedisConnection().ping());
  return {
    status: result === "PONG" ? "up" : "down",
    latencyMs: Date.now() - startedAt,
  };
}

async function checkWorkers(): Promise<WorkerCheckResult> {
  const startedAt = Date.now();
  const beat = await withTimeout(readHeartbeat());
  const latencyMs = Date.now() - startedAt;

  if (!beat) {
    // No key: the process is gone, was never started, or Redis is unreachable.
    return { status: "down", latencyMs };
  }

  const secondsAgo = Math.round((Date.now() - new Date(beat.at).getTime()) / 1000);

  // Redis expires the key on its own, so a beat this old means a clock skew or
  // a hand-written key rather than a live process. Treat it as down either way.
  if (!Number.isFinite(secondsAgo) || secondsAgo > HEARTBEAT_TTL_SECONDS) {
    return { status: "down", latencyMs, lastBeatSecondsAgo: secondsAgo };
  }

  return {
    status: "up",
    latencyMs,
    lastBeatSecondsAgo: Math.max(secondsAgo, 0),
    workerCount: beat.workerCount,
  };
}

export async function GET() {
  const [database, redis, workers] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkWorkers(),
  ]);

  const checks = { database, redis, workers };
  const healthy = Object.values(checks).every((check) => check.status === "up");

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checkedAt: new Date().toISOString(),
      checks,
    },
    {
      status: healthy ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
