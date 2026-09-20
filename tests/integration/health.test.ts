// =============================================================================
// Integration Tests: Health check
// =============================================================================
// This endpoint is what an uptime monitor polls, so the thing that matters is
// that it goes red when it should. A green health check that stays green
// through a worker outage is worse than no health check at all.
// =============================================================================

import { describe, it, expect, afterAll, beforeEach } from "vitest";
import { callApi, disconnectTestPrisma } from "./helpers.js";
import { getRedisConnection } from "../../src/lib/jobs/queue.js";
import {
  WORKER_HEARTBEAT_KEY,
  HEARTBEAT_TTL_SECONDS,
  writeHeartbeat,
  clearHeartbeat,
  readHeartbeat,
} from "../../src/lib/jobs/heartbeat.js";

beforeEach(async () => {
  await clearHeartbeat();
});

afterAll(async () => {
  await clearHeartbeat();
  await getRedisConnection().quit();
  await disconnectTestPrisma();
});

describe("GET /api/health", () => {
  it("reports ok while the workers are beating", async () => {
    await writeHeartbeat(11);

    const response = await callApi("GET", "/api/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.checks.database.status).toBe("up");
    expect(response.body.checks.redis.status).toBe("up");
    expect(response.body.checks.workers.status).toBe("up");
    expect(response.body.checks.workers.workerCount).toBe(11);
    expect(response.body.checks.workers.lastBeatSecondsAgo).toBeLessThanOrEqual(1);
  });

  it("goes red when the worker process stops beating", async () => {
    // No heartbeat written: the process is gone, or was never started — which
    // is exactly the state production was in before the worker service existed.
    const response = await callApi("GET", "/api/health");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("degraded");
    expect(response.body.checks.workers.status).toBe("down");
    // The database is fine, and the endpoint should still say so.
    expect(response.body.checks.database.status).toBe("up");
  });

  it("treats a stale heartbeat as down rather than trusting the key's presence", async () => {
    // Redis normally expires the key itself, so this can only happen through
    // clock skew or a hand-written key. Either way it isn't a live process.
    const stale = new Date(Date.now() - (HEARTBEAT_TTL_SECONDS + 60) * 1000);
    await getRedisConnection().set(
      WORKER_HEARTBEAT_KEY,
      JSON.stringify({ at: stale.toISOString(), workerCount: 11 }),
      "EX",
      HEARTBEAT_TTL_SECONDS,
    );

    const response = await callApi("GET", "/api/health");

    expect(response.status).toBe(503);
    expect(response.body.checks.workers.status).toBe("down");
  });

  it("is never cached, so a monitor sees the current state", async () => {
    await writeHeartbeat(11);
    const response = await callApi("GET", "/api/health");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});

describe("Worker heartbeat", () => {
  it("round-trips the beat and clears it on shutdown", async () => {
    await writeHeartbeat(11);

    const beat = await readHeartbeat();
    expect(beat?.workerCount).toBe(11);
    expect(Number.isNaN(Date.parse(beat?.at ?? ""))).toBe(false);

    await clearHeartbeat();
    expect(await readHeartbeat()).toBeNull();
  });

  it("expires on its own, so a killed process needs nothing to notice it died", async () => {
    await writeHeartbeat(11);

    const ttl = await getRedisConnection().ttl(WORKER_HEARTBEAT_KEY);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(HEARTBEAT_TTL_SECONDS);
  });
});
