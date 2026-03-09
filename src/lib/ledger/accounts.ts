import { Decimal } from "@prisma/client/runtime/client";
import {
  LedgerAccountType,
  type LedgerAccount,
} from "../../../generated/prisma/client.js";
import type { TxClient } from "../db/client.js";

// ---------------------------------------------------------------------------
// Player accounts
// ---------------------------------------------------------------------------

/**
 * Get or create a PLAYER_BALANCE ledger account for a user.
 *
 * Uses the unique constraint (userId, accountType) to upsert atomically.
 */
export async function getOrCreatePlayerAccount(
  tx: TxClient,
  userId: string
): Promise<LedgerAccount> {
  const existing = await tx.ledgerAccount.findUnique({
    where: {
      userId_accountType: {
        userId,
        accountType: LedgerAccountType.PLAYER_BALANCE,
      },
    },
  });

  if (existing) return existing;

  return tx.ledgerAccount.create({
    data: {
      userId,
      accountType: LedgerAccountType.PLAYER_BALANCE,
      balance: new Decimal("0.00"),
      currency: "USD",
    },
  });
}

// ---------------------------------------------------------------------------
// Developer accounts
// ---------------------------------------------------------------------------

/**
 * Get or create a DEVELOPER_BALANCE ledger account for a user.
 */
export async function getOrCreateDeveloperAccount(
  tx: TxClient,
  userId: string
): Promise<LedgerAccount> {
  const existing = await tx.ledgerAccount.findUnique({
    where: {
      userId_accountType: {
        userId,
        accountType: LedgerAccountType.DEVELOPER_BALANCE,
      },
    },
  });

  if (existing) return existing;

  return tx.ledgerAccount.create({
    data: {
      userId,
      accountType: LedgerAccountType.DEVELOPER_BALANCE,
      balance: new Decimal("0.00"),
      currency: "USD",
    },
  });
}

// ---------------------------------------------------------------------------
// Escrow accounts (one per bet)
// ---------------------------------------------------------------------------

/**
 * Create a per-bet ESCROW ledger account.
 *
 * Each bet gets exactly one escrow account. The betId links it.
 */
export async function createEscrowAccount(
  tx: TxClient,
  betId: string
): Promise<LedgerAccount> {
  // Check if one already exists for this bet
  const existing = await tx.ledgerAccount.findFirst({
    where: {
      betId,
      accountType: LedgerAccountType.ESCROW,
    },
  });

  if (existing) return existing;

  return tx.ledgerAccount.create({
    data: {
      betId,
      accountType: LedgerAccountType.ESCROW,
      balance: new Decimal("0.00"),
      currency: "USD",
    },
  });
}

// ---------------------------------------------------------------------------
// System singleton accounts
// ---------------------------------------------------------------------------

export type SystemAccountType =
  | typeof LedgerAccountType.PLATFORM_REVENUE
  | typeof LedgerAccountType.STRIPE_SOURCE
  | typeof LedgerAccountType.STRIPE_SINK;

/**
 * Get a singleton system account (PLATFORM_REVENUE, STRIPE_SOURCE, or STRIPE_SINK).
 *
 * System accounts have no userId. They must be seeded before the application
 * processes transactions (see prisma/seed.ts).
 *
 * @throws Error if the system account does not exist.
 */
export async function getSystemAccount(
  tx: TxClient,
  type: SystemAccountType
): Promise<LedgerAccount> {
  const account = await tx.ledgerAccount.findFirst({
    where: {
      accountType: type,
      userId: null,
    },
  });

  if (!account) {
    throw new Error(
      `System ledger account of type ${type} does not exist. Run the database seed first.`
    );
  }

  return account;
}

// ---------------------------------------------------------------------------
// Balance queries
// ---------------------------------------------------------------------------

/**
 * Get the current materialized balance for a ledger account.
 *
 * Returns the `balance` field from the LedgerAccount row. This value is
 * maintained atomically by the transfer function and should always match
 * the sum of ledger entries for the account.
 */
export async function getAccountBalance(
  tx: TxClient,
  accountId: string
): Promise<Decimal> {
  const account = await tx.ledgerAccount.findUniqueOrThrow({
    where: { id: accountId },
    select: { balance: true },
  });

  return new Decimal(account.balance.toString());
}

/**
 * Get the escrow account for a given bet.
 *
 * @throws Error if no escrow account exists for the bet.
 */
export async function getEscrowAccountForBet(
  tx: TxClient,
  betId: string
): Promise<LedgerAccount> {
  const account = await tx.ledgerAccount.findFirst({
    where: {
      betId,
      accountType: LedgerAccountType.ESCROW,
    },
  });

  if (!account) {
    throw new Error(`No escrow account found for bet ${betId}`);
  }

  return account;
}
