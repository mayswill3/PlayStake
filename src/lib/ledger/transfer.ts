import { Decimal } from "@prisma/client/runtime/client";
import {
  TransactionType,
  TransactionStatus,
  type Transaction,
  type LedgerEntry,
} from "../../../generated/prisma/client.js";
import type { TxClient } from "../db/client.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  /** Positive amount to move from -> to. Must be > 0. */
  amount: Decimal | string | number;
  transactionType: TransactionType;
  description?: string;
  betId?: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface TransferResult {
  transaction: Transaction;
  entries: LedgerEntry[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class InsufficientFundsError extends Error {
  constructor(accountId: string, requested: string, available?: string) {
    const msg = available
      ? `Insufficient funds in account ${accountId}: requested ${requested}, available ${available}`
      : `Insufficient funds in account ${accountId}: requested ${requested}`;
    super(msg);
    this.name = "InsufficientFundsError";
  }
}

export class FrozenAccountError extends Error {
  constructor(accountId: string) {
    super(`Account ${accountId} is frozen`);
    this.name = "FrozenAccountError";
  }
}

// ---------------------------------------------------------------------------
// Core transfer function
// ---------------------------------------------------------------------------

/**
 * Atomic double-entry transfer.
 *
 * This is the ONLY function that should ever modify ledger_accounts.balance.
 * It guarantees:
 *   1. Exactly two LedgerEntry records are created (debit + credit) summing to zero.
 *   2. Both account balances are updated atomically.
 *   3. The debit account is checked for sufficient funds via
 *      `UPDATE ... WHERE balance >= amount` (raw SQL to get the atomic check).
 *   4. Idempotency: if a completed Transaction with the same key exists, it is
 *      returned without re-executing.
 *   5. A `balanceAfter` snapshot is recorded on each LedgerEntry.
 *
 * @param tx  Prisma interactive transaction client.
 * @param input  Transfer parameters.
 * @returns The created Transaction and its two LedgerEntry records.
 * @throws InsufficientFundsError if the debit account has insufficient balance.
 * @throws FrozenAccountError if either account is frozen.
 */
export async function transfer(
  tx: TxClient,
  input: TransferInput
): Promise<TransferResult> {
  const amount = new Decimal(input.amount.toString());

  // --- Validation -----------------------------------------------------------
  if (amount.lte(0)) {
    throw new Error("Transfer amount must be positive");
  }
  if (input.fromAccountId === input.toAccountId) {
    throw new Error("Cannot transfer to the same account");
  }

  // --- Idempotency check ----------------------------------------------------
  const existing = await tx.transaction.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { entries: true },
  });

  if (existing) {
    if (existing.status === TransactionStatus.COMPLETED) {
      return { transaction: existing, entries: existing.entries };
    }
    // If PENDING, something is still in flight (should not happen inside our
    // transaction, but guard anyway).
    if (existing.status === TransactionStatus.PENDING) {
      throw new Error(
        `Transaction with idempotency key ${input.idempotencyKey} is already in progress`
      );
    }
    // If FAILED or REVERSED, allow retry by creating a new idempotency check
    // that would have a different key. For now, reject.
    throw new Error(
      `Transaction with idempotency key ${input.idempotencyKey} has status ${existing.status}`
    );
  }

  // --- Verify neither account is frozen -------------------------------------
  const [fromAccount, toAccount] = await Promise.all([
    tx.ledgerAccount.findUniqueOrThrow({ where: { id: input.fromAccountId } }),
    tx.ledgerAccount.findUniqueOrThrow({ where: { id: input.toAccountId } }),
  ]);

  if (fromAccount.frozen) {
    throw new FrozenAccountError(input.fromAccountId);
  }
  if (toAccount.frozen) {
    throw new FrozenAccountError(input.toAccountId);
  }

  // --- Atomic debit (UPDATE ... WHERE balance >= amount) --------------------
  // This raw SQL acquires a row-level lock and atomically checks the balance.
  // If zero rows are updated, the account has insufficient funds.
  const debitResult: { balance: Decimal }[] = await tx.$queryRaw`
    UPDATE ledger_accounts
    SET balance = balance - ${amount}::decimal,
        updated_at = NOW()
    WHERE id = ${input.fromAccountId}::uuid
      AND balance >= ${amount}::decimal
    RETURNING balance
  `;

  if (debitResult.length === 0) {
    throw new InsufficientFundsError(
      input.fromAccountId,
      amount.toString(),
      fromAccount.balance.toString()
    );
  }

  const debitBalanceAfter = new Decimal(debitResult[0].balance.toString());

  // --- Credit the receiving account -----------------------------------------
  const creditResult: { balance: Decimal }[] = await tx.$queryRaw`
    UPDATE ledger_accounts
    SET balance = balance + ${amount}::decimal,
        updated_at = NOW()
    WHERE id = ${input.toAccountId}::uuid
    RETURNING balance
  `;

  const creditBalanceAfter = new Decimal(creditResult[0].balance.toString());

  // --- Create the Transaction record ----------------------------------------
  const transaction = await tx.transaction.create({
    data: {
      idempotencyKey: input.idempotencyKey,
      type: input.transactionType,
      status: TransactionStatus.COMPLETED,
      amount,
      currency: "USD",
      description: input.description ?? null,
      metadata: (input.metadata as any) ?? undefined,
      betId: input.betId ?? null,
      completedAt: new Date(),
    },
  });

  // --- Create the two LedgerEntry records -----------------------------------
  const debitEntry = await tx.ledgerEntry.create({
    data: {
      ledgerAccountId: input.fromAccountId,
      transactionId: transaction.id,
      amount: amount.neg(), // negative = debit
      balanceAfter: debitBalanceAfter,
    },
  });

  const creditEntry = await tx.ledgerEntry.create({
    data: {
      ledgerAccountId: input.toAccountId,
      transactionId: transaction.id,
      amount, // positive = credit
      balanceAfter: creditBalanceAfter,
    },
  });

  return {
    transaction,
    entries: [debitEntry, creditEntry],
  };
}
