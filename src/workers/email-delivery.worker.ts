// =============================================================================
// PlayStake — Email Delivery Worker
// =============================================================================
// Sends the notification emails queued in the email_outbox table. Keeping this
// out of request handlers and money transactions means a mail-provider outage
// delays emails but never blocks a deposit, settlement or payout.
// =============================================================================

import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../lib/jobs/queue";
import { QUEUE_NAMES, type EmailDeliveryScanPayload } from "../lib/jobs/types";
import { flushEmailOutbox } from "../lib/email/outbox";

function log(level: string, msg: string, data?: Record<string, unknown>): void {
  console.log(JSON.stringify({ level, msg, worker: "email-delivery", ...data }));
}

async function processEmailDeliveryScan(
  job: Job<EmailDeliveryScanPayload>,
): Promise<void> {
  const result = await flushEmailOutbox();

  if (result.sent > 0 || result.failed > 0 || result.exhausted > 0) {
    log("info", "email_scan_done", {
      jobId: job.id,
      sent: result.sent,
      retrying: result.failed,
      givenUp: result.exhausted,
    });
  }
}

export function createEmailDeliveryWorker(): Worker<EmailDeliveryScanPayload> {
  const worker = new Worker<EmailDeliveryScanPayload>(
    QUEUE_NAMES.EMAIL_DELIVERY,
    processEmailDeliveryScan,
    {
      connection: getRedisConnection() as unknown as import("bullmq").ConnectionOptions,
      concurrency: 1,
    },
  );

  worker.on("failed", (job, err) => {
    log("error", "email_delivery_job_failed", { jobId: job?.id, error: err.message });
  });

  worker.on("error", (err) => {
    log("error", "email_delivery_worker_error", { error: err.message });
  });

  log("info", "email_delivery_worker_started");
  return worker;
}
