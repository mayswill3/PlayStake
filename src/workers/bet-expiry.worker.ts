// =============================================================================
// PlayStake — Bet Expiry Worker (C2)
// =============================================================================
// Cancels OPEN bets that have passed their expiresAt. Refunds Player A's
// escrowed funds and decrements the developer's escrow usage.
// =============================================================================

import { Worker, type Job } from "bullmq";
import { Decimal } from "@prisma/client/runtime/client";
import { BetStatus } from "../../generated/prisma/client.js";
import { getRedisConnection } from "../lib/jobs/queue.js";
import { QUEUE_NAMES, type BetExpiryScanPayload } from "../lib/jobs/types.js";
import { prisma, withTransaction, type TxClient } from "../lib/db/client.js";
import { refundEscrow } from "../lib/ledger/escrow.js";
import { dispatchWebhook } from "../lib/webhooks/dispatch.js";

// ---------------------------------------------------------------------------
// Logging helper
// ---------------------------------------------------------------------------

function log(level: string, msg: string, data?: Record<string, unknown>): void {
  console.log(
    JSON.stringify({ level, msg, worker: "bet-expiry", ...data })
  );
}

// ---------------------------------------------------------------------------
// Expire a single bet
// ---------------------------------------------------------------------------

async function expireBet(betId: string): Promise<void> {
  let gameId: string | undefined;

  await withTransaction(async (tx: TxClient) => {
    // Acquire advisory lock
    const lockResult: { locked: boolean }[] = await tx.$queryRaw`
      SELECT pg_try_advisory_xact_lock(hashtext(${betId})) as locked
    `;

    if (!lockResult[0]?.locked) {
      log("info", "skip_locked", { betId });
      return;
    }

    // Re-read bet with FOR UPDATE
    const bets: {
      id: string;
      status: string;
      amount: Decimal;
      player_a_id: string;
      game_id: string;
    }[] = await tx.$queryRaw`
      SELECT id, status, amount, player_a_id, game_id
      FROM bets
      WHERE id = ${betId}::uuid
      FOR UPDATE
    `;

    const bet = bets[0];
    if (!bet) {
      log("warn", "bet_not_found", { betId });
      return;
    }

    if (bet.status !== BetStatus.OPEN) {
      log("info", "skip_wrong_status", { betId, status: bet.status });
      return;
    }

    gameId = bet.game_id;

    // Refund Player A's escrow.
    // refundEscrow handles the escrow limit decrement internally.
    await refundEscrow(tx, {
      betId,
      playerId: bet.player_a_id,
      amount: bet.amount,
      idempotencyKey: `expire_${betId}`,
    });

    // Transition bet to CANCELLED
    await tx.bet.update({
      where: { id: betId },
      data: {
        status: BetStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    log("info", "bet_expired", {
      betId,
      playerA: bet.player_a_id,
      amount: bet.amount.toString(),
    });
  });

  // Dispatch webhook outside the transaction
  if (gameId) {
    try {
      await dispatchWebhook("BET_CANCELLED", gameId, betId, {
        betId,
        reason: "bet_expired",
        cancelledAt: new Date().toISOString(),
      });
    } catch (webhookErr) {
      log("error", "webhook_dispatch_failed", {
        betId,
        error:
          webhookErr instanceof Error
            ? webhookErr.message
            : String(webhookErr),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

async function processBetExpiryScan(
  _job: Job<BetExpiryScanPayload>
): Promise<void> {
  const now = new Date();

  const expiredBets = await prisma.bet.findMany({
    where: {
      status: BetStatus.OPEN,
      expiresAt: { lt: now },
    },
    select: { id: true },
    take: 100,
  });

  if (expiredBets.length === 0) {
    return;
  }

  log("info", "bet_expiry_scan_found", { count: expiredBets.length });

  for (const bet of expiredBets) {
    try {
      await expireBet(bet.id);
    } catch (error) {
      log("error", "bet_expiry_failed", {
        betId: bet.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Worker instance
// ---------------------------------------------------------------------------

export function createBetExpiryWorker(): Worker<BetExpiryScanPayload> {
  const worker = new Worker<BetExpiryScanPayload>(
    QUEUE_NAMES.BET_EXPIRY,
    processBetExpiryScan,
    {
      connection: getRedisConnection(),
      concurrency: 1,
    }
  );

  worker.on("failed", (job, err) => {
    log("error", "bet_expiry_job_failed", {
      jobId: job?.id,
      error: err.message,
    });
  });

  worker.on("error", (err) => {
    log("error", "bet_expiry_worker_error", { error: err.message });
  });

  log("info", "bet_expiry_worker_started");
  return worker;
}
