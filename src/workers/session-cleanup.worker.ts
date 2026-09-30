// =============================================================================
// PlayStake — Session Cleanup Worker
// =============================================================================
// Hourly: deletes login sessions past their 7-day lifetime or idle for longer
// than the timeout. validateSession already refuses both, so this is
// housekeeping — it keeps dead session hashes from piling up in the table.
// =============================================================================

import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../lib/jobs/queue";
import { QUEUE_NAMES, type SessionCleanupPayload } from "../lib/jobs/types";
import { cleanExpiredSessions } from "../lib/auth/session";
import { reportJobFailure } from "../lib/observability/job-failure";

function log(level: string, msg: string, data?: Record<string, unknown>): void {
  console.log(JSON.stringify({ level, msg, worker: "session-cleanup", ...data }));
}

async function processSessionCleanup(_job: Job<SessionCleanupPayload>): Promise<void> {
  const deleted = await cleanExpiredSessions();
  if (deleted > 0) log("info", "sessions_deleted", { count: deleted });
}

export function createSessionCleanupWorker(): Worker<SessionCleanupPayload> {
  const worker = new Worker<SessionCleanupPayload>(
    QUEUE_NAMES.SESSION_CLEANUP,
    processSessionCleanup,
    {
      connection: getRedisConnection() as unknown as import("bullmq").ConnectionOptions,
      concurrency: 1,
    },
  );

  worker.on("failed", (job, err) => {
    reportJobFailure("session-cleanup", job, err);
    log("error", "session_cleanup_job_failed", { jobId: job?.id, error: err.message });
  });
  worker.on("error", (err) => {
    log("error", "session_cleanup_worker_error", { error: err.message });
  });

  log("info", "session_cleanup_worker_started");
  return worker;
}
