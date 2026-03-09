import { describe, it, expect, afterAll } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";
import {
  TransactionType,
  TransactionStatus,
  LedgerAccountType,
} from "../../../generated/prisma/client.js";
import {
  withRollback,
  seedTestData,
  disconnectTestPrisma,
} from "./helpers.js";
import { transfer, InsufficientFundsError } from "../../../src/lib/ledger/transfer.js";
import { getOrCreatePlayerAccount, getAccountBalance } from "../../../src/lib/ledger/accounts.js";

afterAll(async () => {
  await disconnectTestPrisma();
});

describe("transfer", () => {
  it("should create a successful transfer with two ledger entries summing to zero", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);

      // Fund player A via stripe source (creates the player account too)
      const playerAAccount = await getOrCreatePlayerAccount(tx, seeds.playerA.id);

      // Manually set balance for source account to allow the transfer
      // (STRIPE_SOURCE goes negative as money comes in from Stripe)
      // We use raw SQL to set the balance directly for test setup
      await tx.$executeRaw`
        UPDATE ledger_accounts
        SET balance = 10000
        WHERE id = ${seeds.systemAccounts.stripeSource.id}::uuid
      `;

      const result = await transfer(tx, {
        fromAccountId: seeds.systemAccounts.stripeSource.id,
        toAccountId: playerAAccount.id,
        amount: new Decimal("100.00"),
        transactionType: TransactionType.DEPOSIT,
        description: "Test deposit",
        idempotencyKey: "test_transfer_1",
      });

      // Transaction should be COMPLETED
      expect(result.transaction.status).toBe(TransactionStatus.COMPLETED);
      expect(result.transaction.type).toBe(TransactionType.DEPOSIT);
      expect(new Decimal(result.transaction.amount.toString()).eq("100.00")).toBe(true);

      // Exactly two entries
      expect(result.entries).toHaveLength(2);

      // Entries sum to zero (double-entry invariant)
      const entrySum = result.entries.reduce(
        (sum, entry) => sum.add(new Decimal(entry.amount.toString())),
        new Decimal("0")
      );
      expect(entrySum.eq(0)).toBe(true);

      // Debit entry is negative, credit entry is positive
      const debitEntry = result.entries.find((e) =>
        new Decimal(e.amount.toString()).lt(0)
      );
      const creditEntry = result.entries.find((e) =>
        new Decimal(e.amount.toString()).gt(0)
      );

      expect(debitEntry).toBeDefined();
      expect(creditEntry).toBeDefined();
      expect(new Decimal(debitEntry!.amount.toString()).eq("-100.00")).toBe(true);
      expect(new Decimal(creditEntry!.amount.toString()).eq("100.00")).toBe(true);

      // balanceAfter snapshots should be correct
      expect(new Decimal(debitEntry!.balanceAfter.toString()).eq("9900.00")).toBe(true);
      expect(new Decimal(creditEntry!.balanceAfter.toString()).eq("100.00")).toBe(true);

      // Verify account balances are updated
      const sourceBalance = await getAccountBalance(
        tx,
        seeds.systemAccounts.stripeSource.id
      );
      expect(sourceBalance.eq("9900.00")).toBe(true);

      const playerBalance = await getAccountBalance(tx, playerAAccount.id);
      expect(playerBalance.eq("100.00")).toBe(true);
    });
  });

  it("should reject transfer when debit account has insufficient funds", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);
      const playerAAccount = await getOrCreatePlayerAccount(tx, seeds.playerA.id);
      const playerBAccount = await getOrCreatePlayerAccount(tx, seeds.playerB.id);

      // Player A has 0 balance, try to transfer 100
      await expect(
        transfer(tx, {
          fromAccountId: playerAAccount.id,
          toAccountId: playerBAccount.id,
          amount: new Decimal("100.00"),
          transactionType: TransactionType.ADJUSTMENT,
          idempotencyKey: "test_insufficient_1",
        })
      ).rejects.toThrow(InsufficientFundsError);

      // Verify neither balance changed
      const balanceA = await getAccountBalance(tx, playerAAccount.id);
      const balanceB = await getAccountBalance(tx, playerBAccount.id);
      expect(balanceA.eq(0)).toBe(true);
      expect(balanceB.eq(0)).toBe(true);
    });
  });

  it("should handle idempotency: same key returns same result without re-executing", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);
      const playerAAccount = await getOrCreatePlayerAccount(tx, seeds.playerA.id);

      // Give stripe source some balance
      await tx.$executeRaw`
        UPDATE ledger_accounts
        SET balance = 10000
        WHERE id = ${seeds.systemAccounts.stripeSource.id}::uuid
      `;

      const idempotencyKey = "test_idempotent_transfer";

      // First call
      const result1 = await transfer(tx, {
        fromAccountId: seeds.systemAccounts.stripeSource.id,
        toAccountId: playerAAccount.id,
        amount: new Decimal("50.00"),
        transactionType: TransactionType.DEPOSIT,
        description: "Idempotent deposit",
        idempotencyKey,
      });

      // Second call with same key
      const result2 = await transfer(tx, {
        fromAccountId: seeds.systemAccounts.stripeSource.id,
        toAccountId: playerAAccount.id,
        amount: new Decimal("50.00"),
        transactionType: TransactionType.DEPOSIT,
        description: "Idempotent deposit",
        idempotencyKey,
      });

      // Same transaction ID returned
      expect(result2.transaction.id).toBe(result1.transaction.id);

      // Balance should only reflect ONE transfer, not two
      const playerBalance = await getAccountBalance(tx, playerAAccount.id);
      expect(playerBalance.eq("50.00")).toBe(true);

      const sourceBalance = await getAccountBalance(
        tx,
        seeds.systemAccounts.stripeSource.id
      );
      expect(sourceBalance.eq("9950.00")).toBe(true);
    });
  });

  it("should reject transfer with zero or negative amount", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);
      const playerAAccount = await getOrCreatePlayerAccount(tx, seeds.playerA.id);

      await expect(
        transfer(tx, {
          fromAccountId: seeds.systemAccounts.stripeSource.id,
          toAccountId: playerAAccount.id,
          amount: new Decimal("0"),
          transactionType: TransactionType.DEPOSIT,
          idempotencyKey: "test_zero_amount",
        })
      ).rejects.toThrow("Transfer amount must be positive");

      await expect(
        transfer(tx, {
          fromAccountId: seeds.systemAccounts.stripeSource.id,
          toAccountId: playerAAccount.id,
          amount: new Decimal("-50.00"),
          transactionType: TransactionType.DEPOSIT,
          idempotencyKey: "test_negative_amount",
        })
      ).rejects.toThrow("Transfer amount must be positive");
    });
  });

  it("should reject transfer to the same account", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);
      const playerAAccount = await getOrCreatePlayerAccount(tx, seeds.playerA.id);

      await expect(
        transfer(tx, {
          fromAccountId: playerAAccount.id,
          toAccountId: playerAAccount.id,
          amount: new Decimal("10.00"),
          transactionType: TransactionType.ADJUSTMENT,
          idempotencyKey: "test_same_account",
        })
      ).rejects.toThrow("Cannot transfer to the same account");
    });
  });

  it("should record completedAt timestamp on the transaction", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);
      const playerAAccount = await getOrCreatePlayerAccount(tx, seeds.playerA.id);

      await tx.$executeRaw`
        UPDATE ledger_accounts
        SET balance = 1000
        WHERE id = ${seeds.systemAccounts.stripeSource.id}::uuid
      `;

      const before = new Date();
      const result = await transfer(tx, {
        fromAccountId: seeds.systemAccounts.stripeSource.id,
        toAccountId: playerAAccount.id,
        amount: "25.00",
        transactionType: TransactionType.DEPOSIT,
        idempotencyKey: "test_completed_at",
      });
      const after = new Date();

      expect(result.transaction.completedAt).toBeDefined();
      expect(result.transaction.completedAt!.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
      expect(result.transaction.completedAt!.getTime()).toBeLessThanOrEqual(
        after.getTime()
      );
    });
  });
});
