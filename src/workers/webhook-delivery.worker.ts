// =============================================================================
// PlayStake — Webhook Delivery Worker (C4)
// =============================================================================
// Sends outbound webhook HTTP POST requests to game developers. Handles
// retries with exponential backoff (1min, 5min, 30min, 2hr, 12hr) and
// marks deliveries as FAILED after 5 unsuccessful attempts.
// =============================================================================

import { Worker, type Job } from "bullmq";
import { WebhookDeliveryStatus } from "../../generated/prisma/client";
import { getRedisConnection } from "../lib/jobs/queue";
import {
  QUEUE_NAMES,
  type WebhookDeliveryScanPayload,
} from "../lib/jobs/types";
import { prisma } from "../lib/db/client";
import { signWebhookPayload } from "../lib/webhooks/sign";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Backoff intervals in milliseconds for each retry attempt */
const BACKOFF_INTERVALS_MS = [
  1 * 60 * 1000,      // Attempt 1: +1 minute
  5 * 60 * 1000,      // Attempt 2: +5 minutes
  30 * 60 * 1000,     // Attempt 3: +30 minutes
  2 * 60 * 60 * 1000, // Attempt 4: +2 hours
  12 * 60 * 60 * 1000, // Attempt 5: +12 hours
];

const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Logging helper
// ---------------------------------------------------------------------------

function log(level: string, msg: string, data?: Record<string, unknown>): void {
  console.log(
    JSON.stringify({ level, msg, worker: "webhook-delivery", ...data })
  );
}

// ---------------------------------------------------------------------------
// Deliver a single webhook
// ---------------------------------------------------------------------------

async function deliverWebhook(deliveryId: string): Promise<void> {
  // Fetch the delivery log with its webhook config
  const delivery = await prisma.webhookDeliveryLog.findUnique({
    where: { id: deliveryId },
    include: {
      webhookConfig: true,
    },
  });

  if (!delivery) {
    log("warn", "delivery_not_found", { deliveryId });
    return;
  }

  // Guard: only process PENDING or RETRYING
  if (
    delivery.status !== WebhookDeliveryStatus.PENDING &&
    delivery.status !== WebhookDeliveryStatus.RETRYING
  ) {
    return;
  }

  const config = delivery.webhookConfig;
  if (!config || !config.isActive) {
    // Webhook config was deactivated, mark as failed
    await prisma.webhookDeliveryLog.update({
      where: { id: deliveryId },
      data: { status: WebhookDeliveryStatus.FAILED },
    });
    return;
  }

  // Build payload and signature
  const payloadJson = JSON.stringify(delivery.payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signWebhookPayload(config.secret, timestamp, payloadJson);
  const signatureHeader = `t=${timestamp},v1=${signature}`;

  // Send HTTP POST with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let httpStatus: number | null = null;
  let responseBody: string | null = null;
  let success = false;

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PlayStake-Signature": signatureHeader,
        "X-PlayStake-Event": delivery.eventType,
        "X-PlayStake-Delivery": delivery.id,
      },
      body: payloadJson,
      signal: controller.signal,
    });

    httpStatus = response.status;

    // Read response body (limit to 4KB to avoid memory issues)
    try {
      const text = await response.text();
      responseBody = text.substring(0, 4096);
    } catch {
      responseBody = null;
    }

    success = response.ok; // 2xx status
  } catch (error) {
    const errMsg =
      error instanceof Error ? error.message : String(error);

    if (errMsg.includes("abort")) {
      responseBody = "Request timed out";
    } else {
      responseBody = `Network error: ${errMsg}`;
    }
  } finally {
    clearTimeout(timeoutId);
  }

  // Update the delivery record
  const newAttemptCount = delivery.attemptCount + 1;

  if (success) {
    await prisma.webhookDeliveryLog.update({
      where: { id: deliveryId },
      data: {
        status: WebhookDeliveryStatus.DELIVERED,
        httpStatus,
        responseBody,
        attemptCount: newAttemptCount,
        deliveredAt: new Date(),
      },
    });

    log("info", "webhook_delivered", {
      deliveryId,
      url: config.url,
      httpStatus,
      attempts: newAttemptCount,
    });
  } else if (newAttemptCount >= MAX_ATTEMPTS) {
    // Max retries exceeded — mark as FAILED
    await prisma.webhookDeliveryLog.update({
      where: { id: deliveryId },
      data: {
        status: WebhookDeliveryStatus.FAILED,
        httpStatus,
        responseBody,
        attemptCount: newAttemptCount,
      },
    });

    log("warn", "webhook_failed_permanently", {
      deliveryId,
      url: config.url,
      httpStatus,
      attempts: newAttemptCount,
    });
  } else {
    // Schedule retry with exponential backoff
    const backoffMs = BACKOFF_INTERVALS_MS[newAttemptCount - 1] ?? BACKOFF_INTERVALS_MS[BACKOFF_INTERVALS_MS.length - 1];
    const nextRetryAt = new Date(Date.now() + backoffMs);

    await prisma.webhookDeliveryLog.update({
      where: { id: deliveryId },
      data: {
        status: WebhookDeliveryStatus.RETRYING,
        httpStatus,
        responseBody,
        attemptCount: newAttemptCount,
        nextRetryAt,
      },
    });

    log("info", "webhook_retry_scheduled", {
      deliveryId,
      url: config.url,
      httpStatus,
      attempts: newAttemptCount,
      nextRetryAt: nextRetryAt.toISOString(),
    });
  }
}

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

async function processWebhookDeliveryScan(
  _job: Job<WebhookDeliveryScanPayload>
): Promise<void> {
  const now = new Date();

  const pendingDeliveries = await prisma.webhookDeliveryLog.findMany({
    where: {
      OR: [
        {
          status: WebhookDeliveryStatus.PENDING,
        },
        {
          status: WebhookDeliveryStatus.RETRYING,
          nextRetryAt: { lte: now },
        },
      ],
    },
    select: { id: true },
    take: 50,
    orderBy: { createdAt: "asc" },
  });

  if (pendingDeliveries.length === 0) {
    return;
  }

  log("info", "webhook_scan_found", { count: pendingDeliveries.length });

  // Process deliveries with limited concurrency (5 at a time)
  const concurrency = 5;
  for (let i = 0; i < pendingDeliveries.length; i += concurrency) {
    const batch = pendingDeliveries.slice(i, i + concurrency);
    await Promise.allSettled(
      batch.map((delivery) => deliverWebhook(delivery.id))
    );
  }
}

// ---------------------------------------------------------------------------
// Worker instance
// ---------------------------------------------------------------------------

export function createWebhookDeliveryWorker(): Worker<WebhookDeliveryScanPayload> {
  const worker = new Worker<WebhookDeliveryScanPayload>(
    QUEUE_NAMES.WEBHOOK_DELIVERY,
    processWebhookDeliveryScan,
    {
      connection: getRedisConnection() as unknown as import("bullmq").ConnectionOptions,
      concurrency: 1,
    }
  );

  worker.on("failed", (job, err) => {
    log("error", "webhook_delivery_job_failed", {
      jobId: job?.id,
      error: err.message,
    });
  });

  worker.on("error", (err) => {
    log("error", "webhook_delivery_worker_error", { error: err.message });
  });

  log("info", "webhook_delivery_worker_started");
  return worker;
}
