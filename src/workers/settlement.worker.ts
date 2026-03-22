// =============================================================================
// PlayStake — Settlement Worker (C1 — most critical)
// =============================================================================
// Settles bets that have a verified result and have passed the 2-minute
// dispute window. Handles fee collection, developer revenue share,
// and payout distribution — all within a single database transaction
// protected by a PostgreSQL advisory lock.
// =============================================================================

import { Worker, type Job } from "bullmq";
import { Decimal } from "@prisma/client/runtime/client";
import { BetStatus, BetOutcome } from "../../generated/prisma/client";
import { getRedisConnection } from "../lib/jobs/queue";
import { QUEUE_NAMES, type SettlementScanPayload } from "../lib/jobs/types";
import { prisma, withTransaction, type TxClient } from "../lib/db/client";
import {
  collectFee,
  releaseEscrow,
  distributeDevShare,
} from "../lib/ledger/escrow";
import {
  getEscrowAccountForBet,
  getAccountBalance,
} from "../lib/ledger/accounts";
import { dispatchWebhook } from "../lib/webhooks/dispatch";

// ---------------------------------------------------------------------------
// Logging helper
// ---------------------------------------------------------------------------

function log(level: string, msg: string, data?: Record<string, unknown>): void {
  console.log(JSON.stringify({ level, msg, worker: "settlement", ...data }));
}

// ---------------------------------------------------------------------------
// Settlement logic for a single bet
// ---------------------------------------------------------------------------

async function settleBet(betId: string): Promise<void> {
  await withTransaction(
    async (tx: TxClient) => {
      // 1. Acquire advisory lock on the bet ID (xact variant auto-releases)
      const lockResult: { locked: boolean }[] = await tx.$queryRaw`
        SELECT pg_try_advisory_xact_lock(hashtext(${betId})) as locked
      `;

      if (!lockResult[0]?.locked) {
        log("info", "skip_locked", { betId });
        return; // Another worker is processing this bet
      }

      // 2. Re-read bet with SELECT FOR UPDATE, verify still RESULT_REPORTED
      const bets: {
        id: string;
        status: string;
        outcome: string | null;
        amount: Decimal;
        platform_fee_percent: Decimal;
        result_verified: boolean;
        player_a_id: string;
        player_b_id: string | null;
        game_id: string;
      }[] = await tx.$queryRaw`
        SELECT id, status, outcome, amount, platform_fee_percent,
               result_verified, player_a_id, player_b_id, game_id
        FROM bets
        WHERE id = ${betId}::uuid
        FOR UPDATE
      `;

      const bet = bets[0];
      if (!bet) {
        log("warn", "bet_not_found", { betId });
        return;
      }

      if (bet.status !== BetStatus.RESULT_REPORTED) {
        log("info", "skip_wrong_status", { betId, status: bet.status });
        return;
      }

      if (!bet.result_verified) {
        log("info", "skip_unverified", { betId });
        return;
      }

      if (!bet.outcome) {
        log("warn", "skip_no_outcome", { betId });
        return;
      }

      if (!bet.player_b_id) {
        log("warn", "skip_no_player_b", { betId });
        return;
      }

      // 3. Read escrow account balance and verify it equals amount * 2
      const escrowAccount = await getEscrowAccountForBet(tx, betId);
      const escrowBalance = await getAccountBalance(tx, escrowAccount.id);
      const expectedPot = new Decimal(bet.amount.toString()).mul(2);

      if (!escrowBalance.eq(expectedPot)) {
        log("error", "escrow_balance_mismatch", {
          betId,
          expected: expectedPot.toString(),
          actual: escrowBalance.toString(),
        });
        throw new Error(
          `Escrow balance mismatch for bet ${betId}: expected ${expectedPot}, got ${escrowBalance}`
        );
      }

      const pot = expectedPot;
      const feePercent = new Decimal(bet.platform_fee_percent.toString());

      // 4. Calculate fee: pot * platformFeePercent, rounded to 2 decimal places
      const feeAmount = pot.mul(feePercent).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      // 5. Collect platform fee: escrow -> PLATFORM_REVENUE
      if (feeAmount.gt(0)) {
        await collectFee(tx, {
          betId,
          feeAmount,
          idempotencyKey: `settle_${betId}_fee`,
        });
      }

      // 6. Developer revenue share (if applicable)
      const game = await tx.game.findUniqueOrThrow({
        where: { id: bet.game_id },
        include: {
          developerProfile: {
            include: { escrowLimit: true },
          },
        },
      });

      const revSharePercent = new Decimal(
        game.developerProfile.revSharePercent.toString()
      );

      if (revSharePercent.gt(0) && feeAmount.gt(0)) {
        const devShareAmount = feeAmount
          .mul(revSharePercent)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        if (devShareAmount.gt(0)) {
          await distributeDevShare(tx, {
            developerUserId: game.developerProfile.userId,
            amount: devShareAmount,
            idempotencyKey: `settle_${betId}_devshare`,
          });
        }
      }

      // 7. Release escrow to winner(s)
      const remainingEscrow = pot.sub(feeAmount);
      const outcome = bet.outcome as BetOutcome;

      if (outcome === BetOutcome.DRAW) {
        // DRAW: split equally between both players
        const halfPayout = remainingEscrow.div(2).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        // Give any sub-cent remainder to player A (deterministic)
        const playerAPayout = halfPayout;
        const playerBPayout = remainingEscrow.sub(playerAPayout);

        await releaseEscrow(tx, {
          betId,
          winnerId: bet.player_a_id,
          amount: playerAPayout,
          idempotencyKey: `settle_${betId}_release_a`,
        });

        await releaseEscrow(tx, {
          betId,
          winnerId: bet.player_b_id,
          amount: playerBPayout,
          idempotencyKey: `settle_${betId}_release_b`,
        });
      } else {
        // Determine winner
        const winnerId =
          outcome === BetOutcome.PLAYER_A_WIN
            ? bet.player_a_id
            : bet.player_b_id;

        await releaseEscrow(tx, {
          betId,
          winnerId,
          amount: remainingEscrow,
          idempotencyKey: `settle_${betId}_release`,
        });
      }

      // 8. Verify escrow balance = 0 (invariant check)
      const finalEscrowBalance = await getAccountBalance(tx, escrowAccount.id);
      if (!finalEscrowBalance.eq(0)) {
        throw new Error(
          `INVARIANT VIOLATION: Escrow for bet ${betId} is ${finalEscrowBalance} after settlement, expected 0`
        );
      }

      // 9. Update bet status
      await tx.bet.update({
        where: { id: betId },
        data: {
          status: BetStatus.SETTLED,
          settledAt: new Date(),
          platformFeeAmount: feeAmount,
        },
      });

      // 10. Decrement DeveloperEscrowLimit.currentEscrow by pot amount
      if (game.developerProfile.escrowLimit) {
        await tx.$executeRaw`
          UPDATE developer_escrow_limits
          SET current_escrow = GREATEST(current_escrow - ${pot}::decimal, 0),
              updated_at = NOW()
          WHERE id = ${game.developerProfile.escrowLimit.id}::uuid
        `;
      }

      log("info", "bet_settled", {
        betId,
        outcome,
        pot: pot.toString(),
        fee: feeAmount.toString(),
        winner:
          outcome === BetOutcome.DRAW
            ? "draw"
            : outcome === BetOutcome.PLAYER_A_WIN
              ? bet.player_a_id
              : bet.player_b_id,
      });
    },
    { timeout: 30_000 }
  );

  // Dispatch webhook outside the transaction
  try {
    const settledBet = await prisma.bet.findUniqueOrThrow({
      where: { id: betId },
      select: { gameId: true, outcome: true, settledAt: true, amount: true, platformFeeAmount: true },
    });

    await dispatchWebhook("BET_SETTLED", settledBet.gameId, betId, {
      betId,
      outcome: settledBet.outcome,
      amount: settledBet.amount.toString(),
      platformFeeAmount: settledBet.platformFeeAmount?.toString() ?? null,
      settledAt: settledBet.settledAt?.toISOString() ?? null,
    });
  } catch (webhookErr) {
    log("error", "webhook_dispatch_failed_post_settle", {
      betId,
      error: webhookErr instanceof Error ? webhookErr.message : String(webhookErr),
    });
  }
}

// ---------------------------------------------------------------------------
// Worker processor: scans for settleable bets, then processes each one
// ---------------------------------------------------------------------------

async function processSettlementScan(
  _job: Job<SettlementScanPayload>
): Promise<void> {
  // Find bets eligible for settlement:
  //   - status = RESULT_REPORTED
  //   - resultVerified = true
  //   - resultReportedAt + 2 minutes < now
  //   - no open disputes
  const now = new Date();
  const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);

  const eligibleBets = await prisma.bet.findMany({
    where: {
      status: BetStatus.RESULT_REPORTED,
      resultVerified: true,
      resultReportedAt: { lt: twoMinutesAgo },
      disputes: {
        none: { status: "OPEN" },
      },
    },
    select: { id: true },
    take: 50, // Process in batches to avoid long-running scans
  });

  if (eligibleBets.length === 0) {
    return;
  }

  log("info", "settlement_scan_found", { count: eligibleBets.length });

  for (const bet of eligibleBets) {
    try {
      await settleBet(bet.id);
    } catch (error) {
      log("error", "settlement_failed", {
        betId: bet.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Continue processing other bets — one failure should not stop the batch
    }
  }
}

// ---------------------------------------------------------------------------
// Worker instance
// ---------------------------------------------------------------------------

export function createSettlementWorker(): Worker<SettlementScanPayload> {
  const worker = new Worker<SettlementScanPayload>(
    QUEUE_NAMES.SETTLEMENT,
    processSettlementScan,
    {
      connection: getRedisConnection() as unknown as import("bullmq").ConnectionOptions,
      concurrency: 1, // Single-threaded to avoid advisory lock contention
      limiter: {
        max: 1,
        duration: 1000,
      },
    }
  );

  worker.on("failed", (job, err) => {
    log("error", "settlement_job_failed", {
      jobId: job?.id,
      error: err.message,
    });
  });

  worker.on("error", (err) => {
    log("error", "settlement_worker_error", { error: err.message });
  });

  log("info", "settlement_worker_started");
  return worker;
}
