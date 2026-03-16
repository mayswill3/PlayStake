// =============================================================================
// PlayStake — Consent Expiry Worker (C0)
// =============================================================================
// Cancels bets that are still in PENDING_CONSENT after their consent window
// has elapsed. No ledger operations are needed because no funds were escrowed
// at the PENDING_CONSENT stage.
// =============================================================================

import { Worker, type Job } from "bullmq";
import { BetStatus } from "../../generated/prisma/client";
import { getRedisConnection } from "../lib/jobs/queue";
import { QUEUE_NAMES, type ConsentExpiryScanPayload } from "../lib/jobs/types";
import { prisma } from "../lib/db/client";
import { dispatchWebhook } from "../lib/webhooks/dispatch";

// ---------------------------------------------------------------------------
// Logging helper
// ---------------------------------------------------------------------------

function log(level: string, msg: string, data?: Record<string, unknown>): void {
  console.log(
    JSON.stringify({ level, msg, worker: "consent-expiry", ...data })
  );
}

// ---------------------------------------------------------------------------
// Process a single expired consent bet
// ---------------------------------------------------------------------------

async function expireConsent(betId: string, gameId: string): Promise<void> {
  // No transaction needed — no ledger operations, just a status update.
  // Use an atomic update with status guard to prevent double-processing.
  const result = await prisma.bet.updateMany({
    where: {
      id: betId,
      status: BetStatus.PENDING_CONSENT,
    },
    data: {
      status: BetStatus.CANCELLED,
      cancelledAt: new Date(),
    },
  });

  if (result.count === 0) {
    log("info", "skip_already_transitioned", { betId });
    return;
  }

  log("info", "consent_expired", { betId });

  // Fire BET_CANCELLED webhook
  try {
    await dispatchWebhook("BET_CANCELLED", gameId, betId, {
      betId,
      reason: "consent_timeout",
      cancelledAt: new Date().toISOString(),
    });
  } catch (webhookErr) {
    log("error", "webhook_dispatch_failed", {
      betId,
      error: webhookErr instanceof Error ? webhookErr.message : String(webhookErr),
    });
  }
}

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

async function processConsentExpiryScan(
  _job: Job<ConsentExpiryScanPayload>
): Promise<void> {
  const now = new Date();

  const expiredBets = await prisma.bet.findMany({
    where: {
      status: BetStatus.PENDING_CONSENT,
      consentExpiresAt: { lt: now },
    },
    select: { id: true, gameId: true },
    take: 100,
  });

  if (expiredBets.length === 0) {
    return;
  }

  log("info", "consent_expiry_scan_found", { count: expiredBets.length });

  for (const bet of expiredBets) {
    try {
      await expireConsent(bet.id, bet.gameId);
    } catch (error) {
      log("error", "consent_expiry_failed", {
        betId: bet.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Worker instance
// ---------------------------------------------------------------------------

export function createConsentExpiryWorker(): Worker<ConsentExpiryScanPayload> {
  const worker = new Worker<ConsentExpiryScanPayload>(
    QUEUE_NAMES.CONSENT_EXPIRY,
    processConsentExpiryScan,
    {
      connection: getRedisConnection(),
      concurrency: 1,
    }
  );

  worker.on("failed", (job, err) => {
    log("error", "consent_expiry_job_failed", {
      jobId: job?.id,
      error: err.message,
    });
  });

  worker.on("error", (err) => {
    log("error", "consent_expiry_worker_error", { error: err.message });
  });

  log("info", "consent_expiry_worker_started");
  return worker;
}
