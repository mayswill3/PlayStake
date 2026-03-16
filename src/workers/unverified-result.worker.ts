// =============================================================================
// PlayStake — Unverified Result Escalation Worker (C7)
// =============================================================================
// Flags bets where the widget result confirmation has not arrived within
// 5 minutes of the server result being reported. Creates anomaly alerts
// and penalizes developers with repeated unverified results.
// =============================================================================

import { Worker, type Job } from "bullmq";
import { Decimal } from "@prisma/client/runtime/client";
import { BetStatus } from "../../generated/prisma/client";
import { getRedisConnection } from "../lib/jobs/queue";
import {
  QUEUE_NAMES,
  type UnverifiedResultScanPayload,
} from "../lib/jobs/types";
import { prisma } from "../lib/db/client";

// ---------------------------------------------------------------------------
// Logging helper
// ---------------------------------------------------------------------------

function log(level: string, msg: string, data?: Record<string, unknown>): void {
  console.log(
    JSON.stringify({ level, msg, worker: "unverified-result", ...data })
  );
}

// ---------------------------------------------------------------------------
// Process a single unverified bet
// ---------------------------------------------------------------------------

async function escalateUnverifiedResult(betId: string): Promise<void> {
  // Fetch bet with game and developer info
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    include: {
      game: {
        include: {
          developerProfile: {
            include: { escrowLimit: true },
          },
        },
      },
    },
  });

  if (!bet) {
    log("warn", "bet_not_found", { betId });
    return;
  }

  // Guard: still in the expected state
  if (
    bet.status !== BetStatus.RESULT_REPORTED ||
    bet.resultVerified !== false
  ) {
    log("info", "skip_already_processed", {
      betId,
      status: bet.status,
      verified: bet.resultVerified,
    });
    return;
  }

  const developerProfileId = bet.game.developerProfileId;

  // Check if an alert was already created for this bet (idempotency)
  const existingAlert = await prisma.anomalyAlert.findFirst({
    where: {
      developerProfileId,
      type: "RESULT_HASH_MISMATCH",
      details: {
        path: ["betId"],
        equals: betId,
      },
    },
  });

  if (existingAlert) {
    log("info", "alert_already_exists", { betId, alertId: existingAlert.id });
    return;
  }

  // Create MEDIUM severity alert
  await prisma.anomalyAlert.create({
    data: {
      developerProfileId,
      gameId: bet.gameId,
      type: "RESULT_HASH_MISMATCH",
      status: "DETECTED",
      severity: "MEDIUM",
      details: {
        betId,
        reason: "Widget result confirmation not received within 5 minutes",
        resultReportedAt: bet.resultReportedAt?.toISOString(),
      },
    },
  });

  log("info", "unverified_result_alert_created", {
    betId,
    developerProfileId,
    severity: "MEDIUM",
  });

  // Check for repeated unverified results in the past 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentUnverifiedCount = await prisma.anomalyAlert.count({
    where: {
      developerProfileId,
      type: "RESULT_HASH_MISMATCH",
      createdAt: { gte: twentyFourHoursAgo },
    },
  });

  if (recentUnverifiedCount >= 3) {
    // Create HIGH severity alert
    await prisma.anomalyAlert.create({
      data: {
        developerProfileId,
        gameId: bet.gameId,
        type: "RESULT_HASH_MISMATCH",
        status: "DETECTED",
        severity: "HIGH",
        autoAction: "escrow_cap_reduced_50pct",
        details: {
          reason: `Developer has ${recentUnverifiedCount} unverified results in 24 hours`,
          threshold: 3,
          actualCount: recentUnverifiedCount,
          triggeredByBetId: betId,
        },
      },
    });

    // Reduce DeveloperEscrowLimit.maxTotalEscrow by 50%
    const escrowLimit = bet.game.developerProfile.escrowLimit;
    if (escrowLimit) {
      const newMax = new Decimal(escrowLimit.maxTotalEscrow.toString())
        .mul(0.5)
        .toDecimalPlaces(2);

      await prisma.developerEscrowLimit.update({
        where: { id: escrowLimit.id },
        data: { maxTotalEscrow: newMax },
      });

      log("warn", "escrow_cap_reduced", {
        developerProfileId,
        previousMax: escrowLimit.maxTotalEscrow.toString(),
        newMax: newMax.toString(),
        reason: "repeated_unverified_results",
      });
    }
  }

  // Tag the bet with metadata noting it was flagged for audit.
  // Settlement will still proceed (graceful degradation) but the bet
  // is marked for post-settlement review.
  const existingMetadata =
    (bet.gameMetadata as Record<string, unknown>) ?? {};
  await prisma.bet.update({
    where: { id: betId },
    data: {
      gameMetadata: {
        ...existingMetadata,
        _unverifiedResultFlag: true,
        _flaggedAt: new Date().toISOString(),
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

async function processUnverifiedResultScan(
  _job: Job<UnverifiedResultScanPayload>
): Promise<void> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const unverifiedBets = await prisma.bet.findMany({
    where: {
      status: BetStatus.RESULT_REPORTED,
      resultVerified: false,
      resultReportedAt: { lt: fiveMinutesAgo },
    },
    select: { id: true },
    take: 50,
  });

  if (unverifiedBets.length === 0) {
    return;
  }

  log("info", "unverified_result_scan_found", {
    count: unverifiedBets.length,
  });

  for (const bet of unverifiedBets) {
    try {
      await escalateUnverifiedResult(bet.id);
    } catch (error) {
      log("error", "unverified_result_escalation_failed", {
        betId: bet.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Worker instance
// ---------------------------------------------------------------------------

export function createUnverifiedResultWorker(): Worker<UnverifiedResultScanPayload> {
  const worker = new Worker<UnverifiedResultScanPayload>(
    QUEUE_NAMES.UNVERIFIED_RESULT,
    processUnverifiedResultScan,
    {
      connection: getRedisConnection(),
      concurrency: 1,
    }
  );

  worker.on("failed", (job, err) => {
    log("error", "unverified_result_job_failed", {
      jobId: job?.id,
      error: err.message,
    });
  });

  worker.on("error", (err) => {
    log("error", "unverified_result_worker_error", { error: err.message });
  });

  log("info", "unverified_result_worker_started");
  return worker;
}
