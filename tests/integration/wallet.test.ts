// =============================================================================
// Integration Tests: Wallet (Balance, Deposit, Withdraw, Transactions)
// =============================================================================

import { describe, it, expect, afterAll } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";
import {
  withRollback,
  createTestUser,
  createTestSession,
  createSystemAccounts,
  fundPlayer,
  getPlayerBalance,
  disconnectTestPrisma,
  getTestPrisma,
} from "./helpers.js";

afterAll(async () => {
  await disconnectTestPrisma();
});

describe("Wallet: Balance", () => {
  it("should return zero balance for a new user", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const session = await createTestSession(tx, user.id);
      const systemAccounts = await createSystemAccounts(tx);

      // Check balance via DB (since balance route uses the global prisma
      // singleton, not the tx client, we verify via tx directly)
      const balance = await getPlayerBalance(tx, user.id);
      expect(balance.eq(0)).toBe(true);
    });
  });

  it("should return correct balance after funding", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const systemAccounts = await createSystemAccounts(tx);

      await fundPlayer(tx, user.id, systemAccounts.stripeSource.id, 50);

      const balance = await getPlayerBalance(tx, user.id);
      expect(balance.eq(new Decimal("50"))).toBe(true);
    });
  });

  it("should correctly sum multiple deposits", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const systemAccounts = await createSystemAccounts(tx);

      await fundPlayer(tx, user.id, systemAccounts.stripeSource.id, 25);
      await fundPlayer(tx, user.id, systemAccounts.stripeSource.id, 75);

      const balance = await getPlayerBalance(tx, user.id);
      expect(balance.eq(new Decimal("100"))).toBe(true);
    });
  });
});

describe("Wallet: Withdraw", () => {
  it("should fail withdrawal with insufficient funds", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx, { emailVerified: true });
      const systemAccounts = await createSystemAccounts(tx);

      // Fund with $10
      await fundPlayer(tx, user.id, systemAccounts.stripeSource.id, 10);

      // Attempt to withdraw $50 (5000 cents) via ledger directly
      const { getOrCreatePlayerAccount, getSystemAccount } = await import(
        "../../src/lib/ledger/accounts.js"
      );
      const { transfer, InsufficientFundsError } = await import(
        "../../src/lib/ledger/transfer.js"
      );
      const { TransactionType, LedgerAccountType } = await import(
        "../../generated/prisma/client.js"
      );

      const playerAccount = await getOrCreatePlayerAccount(tx, user.id);
      const stripeSink = await getSystemAccount(
        tx,
        LedgerAccountType.STRIPE_SINK
      );

      // Should throw InsufficientFundsError
      await expect(
        transfer(tx, {
          fromAccountId: playerAccount.id,
          toAccountId: stripeSink.id,
          amount: new Decimal("50"),
          transactionType: TransactionType.WITHDRAWAL,
          description: "Test withdrawal",
          idempotencyKey: `test_withdraw_insufficient_${Date.now()}`,
        })
      ).rejects.toThrow("Insufficient funds");
    });
  });

  it("should succeed withdrawal with sufficient funds and decrement balance", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx, { emailVerified: true });
      const systemAccounts = await createSystemAccounts(tx);

      await fundPlayer(tx, user.id, systemAccounts.stripeSource.id, 100);

      const { getOrCreatePlayerAccount, getSystemAccount } = await import(
        "../../src/lib/ledger/accounts.js"
      );
      const { transfer } = await import("../../src/lib/ledger/transfer.js");
      const { TransactionType, LedgerAccountType } = await import(
        "../../generated/prisma/client.js"
      );

      const playerAccount = await getOrCreatePlayerAccount(tx, user.id);
      const stripeSink = await getSystemAccount(
        tx,
        LedgerAccountType.STRIPE_SINK
      );

      await transfer(tx, {
        fromAccountId: playerAccount.id,
        toAccountId: stripeSink.id,
        amount: new Decimal("30"),
        transactionType: TransactionType.WITHDRAWAL,
        description: "Test withdrawal",
        idempotencyKey: `test_withdraw_success_${Date.now()}`,
      });

      const balance = await getPlayerBalance(tx, user.id);
      expect(balance.eq(new Decimal("70"))).toBe(true);
    });
  });
});

describe("Wallet: Deposit Idempotency", () => {
  it("should return same result for duplicate idempotency key via transfer", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const systemAccounts = await createSystemAccounts(tx);
      const { getOrCreatePlayerAccount } = await import(
        "../../src/lib/ledger/accounts.js"
      );
      const { transfer } = await import("../../src/lib/ledger/transfer.js");
      const { TransactionType } = await import(
        "../../generated/prisma/client.js"
      );

      const idemKey = `test_idem_deposit_${Date.now()}`;
      const amount = new Decimal("25");

      // Prime stripe source
      await tx.$executeRaw`
        UPDATE ledger_accounts
        SET balance = balance + ${amount}::decimal,
            updated_at = NOW()
        WHERE id = ${systemAccounts.stripeSource.id}::uuid
      `;

      const playerAccount = await getOrCreatePlayerAccount(tx, user.id);

      // First transfer
      const result1 = await transfer(tx, {
        fromAccountId: systemAccounts.stripeSource.id,
        toAccountId: playerAccount.id,
        amount,
        transactionType: TransactionType.DEPOSIT,
        description: "Test deposit",
        idempotencyKey: idemKey,
      });

      // Second transfer with same key -- should return same result
      const result2 = await transfer(tx, {
        fromAccountId: systemAccounts.stripeSource.id,
        toAccountId: playerAccount.id,
        amount,
        transactionType: TransactionType.DEPOSIT,
        description: "Test deposit",
        idempotencyKey: idemKey,
      });

      expect(result1.transaction.id).toBe(result2.transaction.id);

      // Balance should only reflect one deposit
      const balance = await getPlayerBalance(tx, user.id);
      expect(balance.eq(new Decimal("25"))).toBe(true);
    });
  });
});

describe("Wallet: Transaction History", () => {
  it("should record ledger entries for deposits and withdrawals", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx, { emailVerified: true });
      const systemAccounts = await createSystemAccounts(tx);

      // Fund with $100
      await fundPlayer(tx, user.id, systemAccounts.stripeSource.id, 100);

      // Withdraw $20
      const { getOrCreatePlayerAccount, getSystemAccount } = await import(
        "../../src/lib/ledger/accounts.js"
      );
      const { transfer } = await import("../../src/lib/ledger/transfer.js");
      const { TransactionType, LedgerAccountType } = await import(
        "../../generated/prisma/client.js"
      );

      const playerAccount = await getOrCreatePlayerAccount(tx, user.id);
      const stripeSink = await getSystemAccount(
        tx,
        LedgerAccountType.STRIPE_SINK
      );

      await transfer(tx, {
        fromAccountId: playerAccount.id,
        toAccountId: stripeSink.id,
        amount: new Decimal("20"),
        transactionType: TransactionType.WITHDRAWAL,
        description: "Test withdrawal",
        idempotencyKey: `test_tx_history_withdraw_${Date.now()}`,
      });

      // Query ledger entries for the player account
      const entries = await tx.ledgerEntry.findMany({
        where: { ledgerAccountId: playerAccount.id },
        orderBy: { createdAt: "asc" },
      });

      // Should have 2 entries: +100 (deposit) and -20 (withdrawal)
      expect(entries.length).toBe(2);
      expect(new Decimal(entries[0].amount.toString()).eq(100)).toBe(true);
      expect(new Decimal(entries[1].amount.toString()).eq(-20)).toBe(true);

      // Final balance should be 80
      const balance = await getPlayerBalance(tx, user.id);
      expect(balance.eq(new Decimal("80"))).toBe(true);
    });
  });
});
