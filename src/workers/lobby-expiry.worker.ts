// =============================================================================
// PlayStake — Lobby Expiry Worker
// =============================================================================
// Scans the lobby_entries table on a repeatable schedule:
//   1. Expires WAITING/INVITED entries past their expiresAt
//   2. Times out INVITED entries whose inviteExpiresAt has passed but whose
//      overall expiresAt is still in the future — reverts them to WAITING.
//
// All DB + pub/sub logic lives in src/lib/lobby/service.ts so it is reusable
// outside the worker.
// =============================================================================

import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../lib/jobs/queue";
import { QUEUE_NAMES, type LobbyExpiryScanPayload } from "../lib/jobs/types";
import { runLobbyExpiryScan } from "../lib/lobby/service";

function log(level: string, msg: string, data?: Record<string, unknown>): void {
  console.log(JSON.stringify({ level, msg, worker: "lobby-expiry", ...data }));
}

async function processLobbyExpiryScan(
  _job: Job<LobbyExpiryScanPayload>
): Promise<void> {
  const { expired, inviteTimeouts } = await runLobbyExpiryScan();
  if (expired > 0 || inviteTimeouts > 0) {
    log("info", "lobby_expiry_scan_done", { expired, inviteTimeouts });
  }
}

export function createLobbyExpiryWorker(): Worker<LobbyExpiryScanPayload> {
  const worker = new Worker<LobbyExpiryScanPayload>(
    QUEUE_NAMES.LOBBY_EXPIRY,
    processLobbyExpiryScan,
    {
      connection: getRedisConnection() as unknown as import("bullmq").ConnectionOptions,
      concurrency: 1,
    }
  );

  worker.on("failed", (job, err) => {
    log("error", "lobby_expiry_job_failed", {
      jobId: job?.id,
      error: err.message,
    });
  });

  worker.on("error", (err) => {
    log("error", "lobby_expiry_worker_error", { error: err.message });
  });

  log("info", "lobby_expiry_worker_started");
  return worker;
}
