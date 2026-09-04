// =============================================================================
// PlayStake — Bet Expiry Worker (C2)
// =============================================================================
// Cancels OPEN bets that have passed their expiresAt. Refunds Player A's
// escrowed funds and decrements the developer's escrow usage.
// =============================================================================

import { Worker, type Job } from "bullmq";
import { Decimal } from "@prisma/client/runtime/client";
import { BetStatus } from "../../generated/prisma/client";
import { getRedisConnection } from "../lib/jobs/queue";
import { QUEUE_NAMES, type BetExpiryScanPayload } from "../lib/jobs/types";
import { prisma, withTransaction, type TxClient } from "../lib/db/client";
import { refundEscrow } from "../lib/ledger/escrow";
import { voidNoShowMatch, NO_SHOW_TTL_MS } from "../lib/lobby/match-lifecycle";
import { dispatchWebhook } from "../lib/webhooks/dispatch";

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
// No-show void: a MATCHED bet that was never played (both stakes still locked)
// ---------------------------------------------------------------------------

async function voidStaleMatch(betId: string): Promise<void> {
  await withTransaction(async (tx: TxClient) => {
    const lockResult: { locked: boolean }[] = await tx.$queryRaw`
      SELECT pg_try_advisory_xact_lock(hashtext(${betId})) as locked
    `;
    if (!lockResult[0]?.locked) {
      log("info", "skip_locked", { betId });
      return;
    }
    // voidNoShowMatch re-reads the bet and no-ops unless it is still MATCHED,
    // so a play/result landing at the same moment is never double-handled.
    const { voided, refunded } = await voidNoShowMatch(tx, betId);
    if (voided) {
      // Distinguish the two outcomes: a bet closed without a refund never had
      // funds locked against it, which is a data artifact rather than a
      // no-show, and should not read like money was returned.
      log("info", refunded ? "no_show_voided" : "no_show_voided_unescrowed", {
        betId,
      });
    }
  });
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
    // Oldest first: without an explicit order a row that fails every scan can
    // sit inside the take() window indefinitely and starve bets that would
    // otherwise be refunded.
    orderBy: { expiresAt: "asc" },
    take: 100,
  });

  if (expiredBets.length > 0) {
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

  // No-show sweep: MATCHED bets left unplayed past the orphan window. This is
  // the server-side guarantee behind the accept->play handoff — without it a
  // challenger who never returns would leave both stakes locked forever. Voids
  // the bet and refunds both players (reuses refundEscrow).
  const staleMatches = await prisma.bet.findMany({
    where: {
      status: BetStatus.MATCHED,
      updatedAt: { lt: new Date(now.getTime() - NO_SHOW_TTL_MS) },
    },
    select: { id: true },
    orderBy: { updatedAt: "asc" },
    take: 100,
  });

  if (staleMatches.length > 0) {
    log("info", "no_show_scan_found", { count: staleMatches.length });
    for (const bet of staleMatches) {
      try {
        await voidStaleMatch(bet.id);
      } catch (error) {
        log("error", "no_show_void_failed", {
          betId: bet.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
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
      connection: getRedisConnection() as unknown as import("bullmq").ConnectionOptions,
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
