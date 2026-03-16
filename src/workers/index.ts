// =============================================================================
// PlayStake — Worker Entry Point
// =============================================================================
// Initializes all background workers, registers repeatable job schedules,
// and handles graceful shutdown on SIGTERM / SIGINT.
//
// Run with: npx tsx src/workers/index.ts
// =============================================================================

import "dotenv/config";
import type { Worker } from "bullmq";
import { registerSchedules } from "../lib/jobs/schedules";
import { closeAllQueues } from "../lib/jobs/queue";
import { createSettlementWorker } from "./settlement.worker";
import { createConsentExpiryWorker } from "./consent-expiry.worker";
import { createBetExpiryWorker } from "./bet-expiry.worker";
import { createWebhookDeliveryWorker } from "./webhook-delivery.worker";
import { createUnverifiedResultWorker } from "./unverified-result.worker";
import { createAnomalyDetectionWorker } from "./anomaly-detection.worker";
import { createDisputeEscalationWorker } from "./dispute-escalation.worker";
import { createLedgerAuditWorker } from "./ledger-audit.worker";

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(level: string, msg: string, data?: Record<string, unknown>): void {
  console.log(JSON.stringify({ level, msg, process: "workers", ...data }));
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const workers: Worker[] = [];

async function start(): Promise<void> {
  log("info", "starting_workers");

  // 1. Create all worker instances
  workers.push(createSettlementWorker());
  workers.push(createConsentExpiryWorker());
  workers.push(createBetExpiryWorker());
  workers.push(createWebhookDeliveryWorker());
  workers.push(createUnverifiedResultWorker());
  workers.push(createAnomalyDetectionWorker());
  workers.push(createDisputeEscalationWorker());
  workers.push(createLedgerAuditWorker());

  log("info", "workers_created", { count: workers.length });

  // 2. Register repeatable job schedules
  await registerSchedules();

  log("info", "all_workers_running", {
    workerCount: workers.length,
    pid: process.pid,
  });
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log("info", "shutdown_initiated", { signal });

  // Close all workers (stop accepting new jobs, finish current ones)
  const closePromises = workers.map(async (worker) => {
    try {
      await worker.close();
    } catch (err) {
      log("error", "worker_close_error", {
        workerName: worker.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Give workers up to 30 seconds to finish current jobs
  const timeout = new Promise<void>((resolve) =>
    setTimeout(() => {
      log("warn", "shutdown_timeout_reached", { timeoutMs: 30_000 });
      resolve();
    }, 30_000)
  );

  await Promise.race([Promise.all(closePromises), timeout]);

  // Close all queue connections
  try {
    await closeAllQueues();
  } catch (err) {
    log("error", "queue_close_error", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  log("info", "shutdown_complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  log("error", "uncaught_exception", {
    error: error.message,
    stack: error.stack,
  });
  shutdown("uncaughtException").catch(() => process.exit(1));
});

process.on("unhandledRejection", (reason) => {
  log("error", "unhandled_rejection", {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

start().catch((error) => {
  log("error", "startup_failed", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
