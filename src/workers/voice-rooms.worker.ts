// =============================================================================
// PlayStake — Voice Rooms Worker
// =============================================================================
// Every minute: closes the voice room of any match that is no longer live
// (result recorded, cancelled, voided). Closing the room ends its recording,
// which LiveKit then reports to /api/webhooks/livekit.
// =============================================================================

import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../lib/jobs/queue";
import { QUEUE_NAMES, type VoiceRoomsPayload } from "../lib/jobs/types";
import { reportJobFailure } from "../lib/observability/job-failure";
import { liveKitConfig } from "../lib/voice/config";
import { closeFinishedVoiceRooms } from "../lib/voice/service";

function log(level: string, msg: string, data?: Record<string, unknown>): void {
  console.log(JSON.stringify({ level, msg, worker: "voice-rooms", ...data }));
}

async function processVoiceRooms(_job: Job<VoiceRoomsPayload>): Promise<void> {
  if (!liveKitConfig()) return;
  const closed = await closeFinishedVoiceRooms();
  if (closed > 0) log("info", "voice_rooms_closed", { count: closed });
}

export function createVoiceRoomsWorker(): Worker<VoiceRoomsPayload> {
  const worker = new Worker<VoiceRoomsPayload>(QUEUE_NAMES.VOICE_ROOMS, processVoiceRooms, {
    connection: getRedisConnection() as unknown as import("bullmq").ConnectionOptions,
    concurrency: 1,
  });
  worker.on("failed", (job, err) => {
    reportJobFailure("voice-rooms", job, err);
    log("error", "voice_rooms_job_failed", { jobId: job?.id, error: err.message });
  });
  worker.on("error", (err) => log("error", "voice_rooms_worker_error", { error: err.message }));
  log("info", "voice_rooms_worker_started");
  return worker;
}
