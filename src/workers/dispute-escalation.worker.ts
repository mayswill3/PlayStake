// =============================================================================
// PlayStake — Dispute Escalation Worker (C5)
// =============================================================================
// Handles automatic escalation of unresolved disputes:
//   - After 48 hours: OPEN -> UNDER_REVIEW
//   - After 7 days with no admin action: auto-resolve as VOID and refund
//     both players via refundEscrow().
// =============================================================================

import { Worker, type Job } from "bullmq";
import { Decimal } from "@prisma/client/runtime/client";
import { DisputeStatus, BetStatus } from "../../generated/prisma/client";
import { getRedisConnection } from "../lib/jobs/queue";
import {
  QUEUE_NAMES,
  type DisputeEscalationScanPayload,
} from "../lib/jobs/types";
import { prisma, withTransaction, type TxClient } from "../lib/db/client";
import { refundEscrow } from "../lib/ledger/escrow";

// ---------------------------------------------------------------------------
// Logging helper
// ---------------------------------------------------------------------------

function log(level: string, msg: string, data?: Record<string, unknown>): void {
  console.log(
    JSON.stringify({ level, msg, worker: "dispute-escalation", ...data })
  );
}

// ---------------------------------------------------------------------------
// Escalate OPEN disputes to UNDER_REVIEW after 48 hours
// ---------------------------------------------------------------------------

async function escalateOpenDisputes(): Promise<void> {
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const openDisputes = await prisma.dispute.findMany({
    where: {
      status: DisputeStatus.OPEN,
      createdAt: { lt: fortyEightHoursAgo },
    },
    select: { id: true, betId: true },
    take: 50,
  });

  if (openDisputes.length === 0) return;

  log("info", "escalating_open_disputes", { count: openDisputes.length });

  for (const dispute of openDisputes) {
    try {
      const result = await prisma.dispute.updateMany({
        where: {
          id: dispute.id,
          status: DisputeStatus.OPEN,
        },
        data: {
          status: DisputeStatus.UNDER_REVIEW,
        },
      });

      if (result.count > 0) {
        log("info", "dispute_escalated_to_review", {
          disputeId: dispute.id,
          betId: dispute.betId,
        });
      }
    } catch (error) {
      log("error", "dispute_escalation_failed", {
        disputeId: dispute.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Auto-void UNDER_REVIEW disputes with no admin action after 7 days
// ---------------------------------------------------------------------------

async function autoVoidStaleDisputes(): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const staleDisputes = await prisma.dispute.findMany({
    where: {
      status: DisputeStatus.UNDER_REVIEW,
      // No resolvedAt means admin has not acted
      resolvedAt: null,
      // Updated at least 7 days ago (transition to UNDER_REVIEW happened then)
      updatedAt: { lt: sevenDaysAgo },
    },
    select: {
      id: true,
      betId: true,
    },
    take: 20,
  });

  if (staleDisputes.length === 0) return;

  log("info", "auto_voiding_stale_disputes", { count: staleDisputes.length });

  for (const dispute of staleDisputes) {
    try {
      await autoVoidDispute(dispute.id, dispute.betId);
    } catch (error) {
      log("error", "auto_void_failed", {
        disputeId: dispute.id,
        betId: dispute.betId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function autoVoidDispute(
  disputeId: string,
  betId: string
): Promise<void> {
  await withTransaction(async (tx: TxClient) => {
    // Acquire advisory lock on the bet
    const lockResult: { locked: boolean }[] = await tx.$queryRaw`
      SELECT pg_try_advisory_xact_lock(hashtext(${betId})) as locked
    `;

    if (!lockResult[0]?.locked) {
      log("info", "skip_locked_dispute_void", { disputeId, betId });
      return;
    }

    // Re-read dispute under lock
    const dispute = await tx.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute || dispute.status !== DisputeStatus.UNDER_REVIEW) {
      return; // Already resolved by admin
    }

    // Re-read bet
    const bet = await tx.bet.findUnique({
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
      log("warn", "bet_not_found_for_void", { disputeId, betId });
      return;
    }

    // Only void bets that are still holding escrow
    // (RESULT_REPORTED or DISPUTED status)
    if (
      bet.status !== BetStatus.RESULT_REPORTED &&
      bet.status !== BetStatus.DISPUTED
    ) {
      log("info", "skip_void_wrong_bet_status", {
        disputeId,
        betId,
        status: bet.status,
      });
      // Still resolve the dispute even if the bet was already settled
      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: DisputeStatus.RESOLVED_VOID,
          resolution:
            "Auto-voided after 7 days with no admin action. Bet was already in terminal state.",
          resolvedAt: new Date(),
        },
      });
      return;
    }

    // Transition bet to VOIDED first (refundEscrow checks status)
    await tx.bet.update({
      where: { id: betId },
      data: {
        status: BetStatus.VOIDED,
        cancelledAt: new Date(),
      },
    });

    // Refund Player A
    const playerAAmount = bet.amount;
    await refundEscrow(tx, {
      betId,
      playerId: bet.playerAId,
      amount: playerAAmount,
      idempotencyKey: `dispute_void_${betId}_refund_a`,
    });

    // Refund Player B (if matched)
    if (bet.playerBId) {
      await refundEscrow(tx, {
        betId,
        playerId: bet.playerBId,
        amount: playerAAmount, // Both players escrowed the same amount
        idempotencyKey: `dispute_void_${betId}_refund_b`,
      });
    }

    // Resolve the dispute
    await tx.dispute.update({
      where: { id: disputeId },
      data: {
        status: DisputeStatus.RESOLVED_VOID,
        resolution:
          "Auto-voided after 7 days with no admin action. Both players refunded.",
        resolvedAt: new Date(),
      },
    });

    log("info", "dispute_auto_voided", {
      disputeId,
      betId,
      playerARefunded: playerAAmount.toString(),
      playerBRefunded: bet.playerBId ? playerAAmount.toString() : "0",
    });
  });
}

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

async function processDisputeEscalationScan(
  _job: Job<DisputeEscalationScanPayload>
): Promise<void> {
  await escalateOpenDisputes();
  await autoVoidStaleDisputes();
}

// ---------------------------------------------------------------------------
// Worker instance
// ---------------------------------------------------------------------------

export function createDisputeEscalationWorker(): Worker<DisputeEscalationScanPayload> {
  const worker = new Worker<DisputeEscalationScanPayload>(
    QUEUE_NAMES.DISPUTE_ESCALATION,
    processDisputeEscalationScan,
    {
      connection: getRedisConnection(),
      concurrency: 1,
    }
  );

  worker.on("failed", (job, err) => {
    log("error", "dispute_escalation_job_failed", {
      jobId: job?.id,
      error: err.message,
    });
  });

  worker.on("error", (err) => {
    log("error", "dispute_escalation_worker_error", { error: err.message });
  });

  log("info", "dispute_escalation_worker_started");
  return worker;
}
