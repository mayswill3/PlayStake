// =============================================================================
// PlayStake — Recording Retention Worker
// =============================================================================
// Hourly: deletes match recordings past their retention date (30 days after
// an undisputed match; 12 months after a dispute is decided) from storage.
// Recordings of a match with an open dispute are never deleted.
// =============================================================================

import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../lib/jobs/queue";
import { QUEUE_NAMES, type RecordingRetentionPayload } from "../lib/jobs/types";
import { reportJobFailure } from "../lib/observability/job-failure";
import { r2Config } from "../lib/recordings/config";
import { deleteExpiredRecordings } from "../lib/recordings/service";

function log(level: string, msg: string, data?: Record<string, unknown>): void {
  console.log(JSON.stringify({ level, msg, worker: "recording-retention", ...data }));
}

async function processRecordingRetention(_job: Job<RecordingRetentionPayload>): Promise<void> {
  if (!r2Config()) return;
  const deleted = await deleteExpiredRecordings();
  if (deleted > 0) log("info", "recordings_deleted", { count: deleted });
}

export function createRecordingRetentionWorker(): Worker<RecordingRetentionPayload> {
  const worker = new Worker<RecordingRetentionPayload>(QUEUE_NAMES.RECORDING_RETENTION, processRecordingRetention, {
    connection: getRedisConnection() as unknown as import("bullmq").ConnectionOptions,
    concurrency: 1,
  });
  worker.on("failed", (job, err) => {
    reportJobFailure("recording-retention", job, err);
    log("error", "recording_retention_job_failed", { jobId: job?.id, error: err.message });
  });
  worker.on("error", (err) => log("error", "recording_retention_worker_error", { error: err.message }));
  log("info", "recording_retention_worker_started");
  return worker;
}
