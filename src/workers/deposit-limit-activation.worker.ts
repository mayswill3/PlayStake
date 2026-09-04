// =============================================================================
// PlayStake — Deposit Limit Activation Worker
// =============================================================================
// Folds matured deposit-limit increases into the active limit.
//
// This worker is a tidying pass, not a control. A staged increase whose
// effective time has passed is already treated as active by
// getDepositLimits(), so the deposit gate stays correct even if this process
// never runs. That asymmetry is deliberate: a stalled worker must never leave
// a limit looser than the user asked for.
// =============================================================================

import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../lib/jobs/queue";
import {
  QUEUE_NAMES,
  type DepositLimitActivationPayload,
} from "../lib/jobs/types";
import { prisma } from "../lib/db/client";

function log(level: string, msg: string, data?: Record<string, unknown>): void {
  console.log(
    JSON.stringify({ level, msg, worker: "deposit-limit-activation", ...data }),
  );
}

async function processActivationScan(
  _job: Job<DepositLimitActivationPayload>,
): Promise<void> {
  const now = new Date();

  const matured = await prisma.depositLimit.findMany({
    where: {
      pendingAmount: { not: null },
      pendingEffectiveAt: { lte: now },
    },
    select: { id: true, userId: true, period: true, pendingAmount: true },
    take: 200,
  });

  if (matured.length === 0) return;

  for (const limit of matured) {
    try {
      // Guard on pendingEffectiveAt so a reduction landing between the read
      // and the write is not overwritten by the stale increase.
      const result = await prisma.depositLimit.updateMany({
        where: {
          id: limit.id,
          pendingAmount: { not: null },
          pendingEffectiveAt: { lte: now },
        },
        data: {
          amount: limit.pendingAmount!,
          pendingAmount: null,
          pendingEffectiveAt: null,
        },
      });

      if (result.count > 0) {
        log("info", "deposit_limit_increase_activated", {
          userId: limit.userId,
          period: limit.period,
        });
      }
    } catch (error) {
      log("error", "deposit_limit_activation_failed", {
        limitId: limit.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export function createDepositLimitActivationWorker(): Worker<DepositLimitActivationPayload> {
  const worker = new Worker<DepositLimitActivationPayload>(
    QUEUE_NAMES.DEPOSIT_LIMIT_ACTIVATION,
    processActivationScan,
    {
      connection:
        getRedisConnection() as unknown as import("bullmq").ConnectionOptions,
      concurrency: 1,
    },
  );

  worker.on("failed", (job, err) => {
    log("error", "deposit_limit_activation_job_failed", {
      jobId: job?.id,
      error: err.message,
    });
  });

  worker.on("error", (err) => {
    log("error", "deposit_limit_activation_worker_error", {
      error: err.message,
    });
  });

  log("info", "deposit_limit_activation_worker_started");
  return worker;
}
