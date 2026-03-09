import { Decimal } from "@prisma/client/runtime/client";
import type { TxClient } from "../db/client.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccountDiscrepancy {
  accountId: string;
  accountType: string;
  materializedBalance: string;
  computedBalance: string;
  difference: string;
}

export interface TransactionImbalance {
  transactionId: string;
  entrySum: string;
}

export interface AuditReport {
  /** Timestamp when the audit was run */
  timestamp: Date;
  /** Accounts where materialized balance != sum of entries */
  accountDiscrepancies: AccountDiscrepancy[];
  /** Transactions where entries do not sum to zero */
  transactionImbalances: TransactionImbalance[];
  /** Whether total money in the system is conserved (all entries sum to zero) */
  systemConservation: {
    totalSum: string;
    isConserved: boolean;
  };
  /** Whether all checks passed */
  isHealthy: boolean;
}

// ---------------------------------------------------------------------------
// verifyAccountBalance
// ---------------------------------------------------------------------------

/**
 * Verify that a single account's materialized balance matches the sum of
 * all its ledger entries.
 *
 * @returns `null` if the balance is correct, or an AccountDiscrepancy if not.
 */
export async function verifyAccountBalance(
  tx: TxClient,
  accountId: string
): Promise<AccountDiscrepancy | null> {
  const account = await tx.ledgerAccount.findUniqueOrThrow({
    where: { id: accountId },
  });

  // Sum all ledger entries for this account
  const result: { total: Decimal | null }[] = await tx.$queryRaw`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM ledger_entries
    WHERE ledger_account_id = ${accountId}::uuid
  `;

  const computedBalance = new Decimal(
    result[0].total?.toString() ?? "0"
  );
  const materializedBalance = new Decimal(account.balance.toString());

  if (!materializedBalance.eq(computedBalance)) {
    return {
      accountId,
      accountType: account.accountType,
      materializedBalance: materializedBalance.toString(),
      computedBalance: computedBalance.toString(),
      difference: materializedBalance.sub(computedBalance).toString(),
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// verifyTransactionBalance
// ---------------------------------------------------------------------------

/**
 * Verify that the ledger entries for a single transaction sum to zero.
 * (Double-entry invariant: every debit has an equal and opposite credit.)
 *
 * @returns `null` if balanced, or a TransactionImbalance if not.
 */
export async function verifyTransactionBalance(
  tx: TxClient,
  transactionId: string
): Promise<TransactionImbalance | null> {
  const result: { total: Decimal | null }[] = await tx.$queryRaw`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM ledger_entries
    WHERE transaction_id = ${transactionId}::uuid
  `;

  const entrySum = new Decimal(result[0].total?.toString() ?? "0");

  if (!entrySum.eq(0)) {
    return {
      transactionId,
      entrySum: entrySum.toString(),
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// verifySystemConservation
// ---------------------------------------------------------------------------

/**
 * Verify that the total of all ledger entries across the entire system sums
 * to zero.
 *
 * In a correct double-entry system, money is never created or destroyed --
 * every debit is matched by an equal credit. Therefore the global sum of all
 * ledger_entries.amount must be exactly zero.
 */
export async function verifySystemConservation(
  tx: TxClient
): Promise<{ totalSum: string; isConserved: boolean }> {
  const result: { total: Decimal | null }[] = await tx.$queryRaw`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM ledger_entries
  `;

  const totalSum = new Decimal(result[0].total?.toString() ?? "0");

  return {
    totalSum: totalSum.toString(),
    isConserved: totalSum.eq(0),
  };
}

// ---------------------------------------------------------------------------
// runFullAudit
// ---------------------------------------------------------------------------

/**
 * Run a comprehensive integrity audit of the entire ledger.
 *
 * Checks:
 *   1. Every account's materialized balance matches its entry sum.
 *   2. Every transaction's entries sum to zero.
 *   3. The global sum of all entries is zero (conservation).
 *
 * @returns A full AuditReport with any discrepancies found.
 */
export async function runFullAudit(tx: TxClient): Promise<AuditReport> {
  const timestamp = new Date();

  // 1. Check all account balances
  const accountDiscrepancies: AccountDiscrepancy[] = [];
  const accountResults: {
    id: string;
    account_type: string;
    balance: Decimal;
    computed: Decimal | null;
  }[] = await tx.$queryRaw`
    SELECT
      la.id,
      la.account_type,
      la.balance,
      COALESCE(SUM(le.amount), 0) as computed
    FROM ledger_accounts la
    LEFT JOIN ledger_entries le ON le.ledger_account_id = la.id
    GROUP BY la.id, la.account_type, la.balance
  `;

  for (const row of accountResults) {
    const materialized = new Decimal(row.balance.toString());
    const computed = new Decimal(row.computed?.toString() ?? "0");
    if (!materialized.eq(computed)) {
      accountDiscrepancies.push({
        accountId: row.id,
        accountType: row.account_type,
        materializedBalance: materialized.toString(),
        computedBalance: computed.toString(),
        difference: materialized.sub(computed).toString(),
      });
    }
  }

  // 2. Check all transactions have balanced entries
  const transactionImbalances: TransactionImbalance[] = [];
  const txResults: {
    transaction_id: string;
    total: Decimal | null;
  }[] = await tx.$queryRaw`
    SELECT
      transaction_id,
      SUM(amount) as total
    FROM ledger_entries
    GROUP BY transaction_id
    HAVING SUM(amount) != 0
  `;

  for (const row of txResults) {
    transactionImbalances.push({
      transactionId: row.transaction_id,
      entrySum: new Decimal(row.total?.toString() ?? "0").toString(),
    });
  }

  // 3. System conservation
  const systemConservation = await verifySystemConservation(tx);

  const isHealthy =
    accountDiscrepancies.length === 0 &&
    transactionImbalances.length === 0 &&
    systemConservation.isConserved;

  return {
    timestamp,
    accountDiscrepancies,
    transactionImbalances,
    systemConservation,
    isHealthy,
  };
}
