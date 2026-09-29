// =============================================================================
// PlayStake — Kick Live Sync Worker
// =============================================================================
// Polls every linked Kick channel on a repeatable schedule and syncs the
// `isLive` flag. Kick's webhook is the fast path; this is the backstop for
// late or undeliverable webhooks. Flips are published to the live-status
// channel, which open pages hear over /api/live/stream.
//
// All Kick + DB logic lives in src/lib/kick/live-sync.ts, shared with
// GET /api/kick/live.
// =============================================================================

import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../lib/jobs/queue";
import { QUEUE_NAMES, type KickLiveSyncPayload } from "../lib/jobs/types";
import { refreshKickLiveStatus } from "../lib/kick/live-sync";
import { reportJobFailure } from "../lib/observability/job-failure";

function log(level: string, msg: string, data?: Record<string, unknown>): void {
  console.log(JSON.stringify({ level, msg, worker: "kick-live-sync", ...data }));
}

async function processKickLiveSync(_job: Job<KickLiveSyncPayload>): Promise<void> {
  // Without app credentials every poll would fail; the webhook path still works.
  if (!process.env.KICK_CLIENT_ID || !process.env.KICK_CLIENT_SECRET) return;
  await refreshKickLiveStatus();
}

export function createKickLiveSyncWorker(): Worker<KickLiveSyncPayload> {
  const worker = new Worker<KickLiveSyncPayload>(
    QUEUE_NAMES.KICK_LIVE_SYNC,
    processKickLiveSync,
    {
      connection: getRedisConnection() as unknown as import("bullmq").ConnectionOptions,
      concurrency: 1,
    }
  );

  worker.on("failed", (job, err) => {
    reportJobFailure("kick-live-sync", job, err);
    log("error", "kick_live_sync_job_failed", {
      jobId: job?.id,
      error: err.message,
    });
  });

  worker.on("error", (err) => {
    log("error", "kick_live_sync_worker_error", { error: err.message });
  });

  log("info", "kick_live_sync_worker_started");
  return worker;
}
