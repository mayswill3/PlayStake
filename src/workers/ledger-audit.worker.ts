// =============================================================================
// PlayStake — Ledger Audit Worker (C6)
// =============================================================================
// Runs daily at 03:00 UTC. Performs a full double-entry ledger integrity
// check and verifies DeveloperEscrowLimit consistency. Any discrepancy
// is logged as CRITICAL.
// =============================================================================

import { Worker, type Job } from "bullmq";
import { Decimal } from "@prisma/client/runtime/client";
import { BetStatus } from "../../generated/prisma/client";
import { getRedisConnection } from "../lib/jobs/queue";
import { QUEUE_NAMES, type LedgerAuditPayload } from "../lib/jobs/types";
import { prisma, withTransaction, type TxClient } from "../lib/db/client";
import { runFullAudit, type AuditReport } from "../lib/ledger/audit";

// ---------------------------------------------------------------------------
// Logging helper
// ---------------------------------------------------------------------------

function log(level: string, msg: string, data?: Record<string, unknown>): void {
  console.log(
    JSON.stringify({ level, msg, worker: "ledger-audit", ...data })
  );
}

// ---------------------------------------------------------------------------
// Verify developer escrow limit consistency
// ---------------------------------------------------------------------------

interface EscrowDiscrepancy {
  developerProfileId: string;
  recordedEscrow: string;
  actualEscrow: string;
  difference: string;
}

async function verifyDeveloperEscrowLimits(
  tx: TxClient
): Promise<EscrowDiscrepancy[]> {
  // For each developer, compute the actual sum of escrow account balances
  // for their active bets (non-terminal statuses).
  const discrepancies: EscrowDiscrepancy[] = [];

  const limits = await tx.developerEscrowLimit.findMany({
    include: {
      developerProfile: {
        include: {
          games: {
            select: { id: true },
          },
        },
      },
    },
  });

  for (const limit of limits) {
    const gameIds = limit.developerProfile.games.map((g) => g.id);
    if (gameIds.length === 0) {
      // No games — currentEscrow should be 0
      if (!new Decimal(limit.currentEscrow.toString()).eq(0)) {
        discrepancies.push({
          developerProfileId: limit.developerProfileId,
          recordedEscrow: limit.currentEscrow.toString(),
          actualEscrow: "0",
          difference: limit.currentEscrow.toString(),
        });
      }
      continue;
    }

    // Sum escrow balances for active bets belonging to this developer's games.
    // Active bets are those in non-terminal states that have escrowed funds.
    const result: { total: Decimal | null }[] = await tx.$queryRaw`
      SELECT COALESCE(SUM(la.balance), 0) as total
      FROM ledger_accounts la
      JOIN bets b ON la.bet_id = b.id
      WHERE la.account_type = 'ESCROW'
        AND b.game_id = ANY(${gameIds}::uuid[])
        AND b.status IN ('OPEN', 'MATCHED', 'RESULT_REPORTED', 'DISPUTED')
    `;

    const actualEscrow = new Decimal(result[0]?.total?.toString() ?? "0");
    const recordedEscrow = new Decimal(limit.currentEscrow.toString());

    if (!recordedEscrow.eq(actualEscrow)) {
      discrepancies.push({
        developerProfileId: limit.developerProfileId,
        recordedEscrow: recordedEscrow.toString(),
        actualEscrow: actualEscrow.toString(),
        difference: recordedEscrow.sub(actualEscrow).toString(),
      });
    }
  }

  return discrepancies;
}

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

async function processLedgerAudit(
  _job: Job<LedgerAuditPayload>
): Promise<void> {
  log("info", "ledger_audit_started");

  const startTime = Date.now();

  let auditReport: AuditReport | undefined;
  let escrowDiscrepancies: EscrowDiscrepancy[] = [];

  await withTransaction(
    async (tx: TxClient) => {
      // 1. Run the full ledger audit
      auditReport = await runFullAudit(tx);

      // 2. Verify developer escrow limits
      escrowDiscrepancies = await verifyDeveloperEscrowLimits(tx);
    },
    { timeout: 120_000 } // Allow up to 2 minutes for the audit
  );

  const durationMs = Date.now() - startTime;

  if (!auditReport) {
    log("error", "ledger_audit_no_report", { durationMs });
    return;
  }

  // Log results
  if (auditReport.isHealthy && escrowDiscrepancies.length === 0) {
    log("info", "ledger_audit_healthy", {
      durationMs,
      accountsChecked: "all",
      systemConservation: auditReport.systemConservation,
    });
  } else {
    // Log discrepancies as CRITICAL
    if (auditReport.accountDiscrepancies.length > 0) {
      log("error", "CRITICAL_account_balance_discrepancies", {
        durationMs,
        count: auditReport.accountDiscrepancies.length,
        discrepancies: auditReport.accountDiscrepancies,
      });
    }

    if (auditReport.transactionImbalances.length > 0) {
      log("error", "CRITICAL_transaction_imbalances", {
        durationMs,
        count: auditReport.transactionImbalances.length,
        imbalances: auditReport.transactionImbalances,
      });
    }

    if (!auditReport.systemConservation.isConserved) {
      log("error", "CRITICAL_system_conservation_violated", {
        durationMs,
        totalSum: auditReport.systemConservation.totalSum,
      });
    }

    if (escrowDiscrepancies.length > 0) {
      log("error", "CRITICAL_escrow_limit_discrepancies", {
        durationMs,
        count: escrowDiscrepancies.length,
        discrepancies: escrowDiscrepancies,
      });
    }

    // In production, this is where we would fire PagerDuty / alert
    log("error", "CRITICAL_ledger_audit_failed", {
      durationMs,
      accountDiscrepancies: auditReport.accountDiscrepancies.length,
      transactionImbalances: auditReport.transactionImbalances.length,
      conservationViolated: !auditReport.systemConservation.isConserved,
      escrowLimitDiscrepancies: escrowDiscrepancies.length,
    });
  }
}

// ---------------------------------------------------------------------------
// Worker instance
// ---------------------------------------------------------------------------

export function createLedgerAuditWorker(): Worker<LedgerAuditPayload> {
  const worker = new Worker<LedgerAuditPayload>(
    QUEUE_NAMES.LEDGER_AUDIT,
    processLedgerAudit,
    {
      connection: getRedisConnection() as unknown as import("bullmq").ConnectionOptions,
      concurrency: 1,
    }
  );

  worker.on("failed", (job, err) => {
    log("error", "ledger_audit_job_failed", {
      jobId: job?.id,
      error: err.message,
    });
  });

  worker.on("error", (err) => {
    log("error", "ledger_audit_worker_error", { error: err.message });
  });

  log("info", "ledger_audit_worker_started");
  return worker;
}
