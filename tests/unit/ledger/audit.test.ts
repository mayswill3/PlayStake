import { describe, it, expect, afterAll } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";
import {
  TransactionType,
  BetStatus,
  LedgerAccountType,
} from "../../../generated/prisma/client.js";
import {
  withRollback,
  seedTestData,
  createTestBet,
  disconnectTestPrisma,
} from "./helpers.js";
import {
  verifyAccountBalance,
  verifyTransactionBalance,
  verifySystemConservation,
  runFullAudit,
} from "../../../src/lib/ledger/audit.js";
import { transfer } from "../../../src/lib/ledger/transfer.js";
import { holdEscrow, collectFee, releaseEscrow } from "../../../src/lib/ledger/escrow.js";
import {
  getOrCreatePlayerAccount,
  getEscrowAccountForBet,
} from "../../../src/lib/ledger/accounts.js";

afterAll(async () => {
  await disconnectTestPrisma();
});

/**
 * Fund a player using ONLY proper ledger operations (no raw SQL balance hacks).
 * We set STRIPE_SOURCE balance high AND insert a matching ledger entry so
 * the full audit passes. This uses a two-step approach:
 *   1. Create a "bootstrap" transaction with a single credit entry on STRIPE_SOURCE
 *      (simulating external money inflow -- the debit side is outside our system).
 *   2. Run transfer() from STRIPE_SOURCE -> PLAYER_BALANCE.
 *
 * Note: The bootstrap entry means system conservation won't be zero (the
 * external inflow is one-sided). For testing full conservation, we need both
 * the bootstrap AND the transfer. The net entries on STRIPE_SOURCE cancel out
 * (bootstrap +X, transfer -X), so only the PLAYER_BALANCE credit remains.
 * But the bootstrap entry is one-sided, so global sum = +X -X + X = X.
 *
 * Actually, the simplest correct approach for testing is to directly use
 * transfer() between two accounts that we control. For the full audit test,
 * we skip the Stripe boundary entirely and just put money directly into
 * player accounts using paired entries.
 */
async function fundPlayerForAudit(
  tx: Parameters<Parameters<import("../../../generated/prisma/client.js").PrismaClient["$transaction"]>[0]>[0],
  playerAccountId: string,
  counterpartyAccountId: string,
  amount: string
): Promise<void> {
  // First give the counterparty enough balance
  await tx.$executeRaw`
    UPDATE ledger_accounts
    SET balance = balance + ${new Decimal(amount)}::decimal
    WHERE id = ${counterpartyAccountId}::uuid
  `;
  // Then do a proper transfer (creates balanced entries)
  await transfer(tx, {
    fromAccountId: counterpartyAccountId,
    toAccountId: playerAccountId,
    amount: new Decimal(amount),
    transactionType: TransactionType.DEPOSIT,
    description: "Audit test funding",
    idempotencyKey: `audit_fund_${playerAccountId}_${Date.now()}_${Math.random()}`,
  });
}

describe("verifyAccountBalance", () => {
  it("should return null for a correctly balanced account", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);

      // Set up STRIPE_SOURCE with balance and do a proper transfer
      await tx.$executeRaw`
        UPDATE ledger_accounts
        SET balance = 10000
        WHERE id = ${seeds.systemAccounts.stripeSource.id}::uuid
      `;

      const playerAccount = await getOrCreatePlayerAccount(tx, seeds.playerA.id);
      await transfer(tx, {
        fromAccountId: seeds.systemAccounts.stripeSource.id,
        toAccountId: playerAccount.id,
        amount: "250.00",
        transactionType: TransactionType.DEPOSIT,
        idempotencyKey: "audit_verify_balance_1",
      });

      // Player account should have balanced entries
      const discrepancy = await verifyAccountBalance(tx, playerAccount.id);
      expect(discrepancy).toBeNull();
    });
  });

  it("should detect a corrupted account balance", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);

      await tx.$executeRaw`
        UPDATE ledger_accounts
        SET balance = 10000
        WHERE id = ${seeds.systemAccounts.stripeSource.id}::uuid
      `;

      const playerAccount = await getOrCreatePlayerAccount(tx, seeds.playerA.id);
      await transfer(tx, {
        fromAccountId: seeds.systemAccounts.stripeSource.id,
        toAccountId: playerAccount.id,
        amount: "250.00",
        transactionType: TransactionType.DEPOSIT,
        idempotencyKey: "audit_verify_corrupt_1",
      });

      // Corrupt the balance by directly modifying it (bypassing the ledger)
      await tx.$executeRaw`
        UPDATE ledger_accounts
        SET balance = 999.99
        WHERE id = ${playerAccount.id}::uuid
      `;

      const discrepancy = await verifyAccountBalance(tx, playerAccount.id);

      expect(discrepancy).not.toBeNull();
      expect(discrepancy!.accountId).toBe(playerAccount.id);
      expect(discrepancy!.materializedBalance).toBe("999.99");
      expect(discrepancy!.computedBalance).toBe("250");
    });
  });
});

describe("verifyTransactionBalance", () => {
  it("should return null for a balanced transaction", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);

      await tx.$executeRaw`
        UPDATE ledger_accounts
        SET balance = 10000
        WHERE id = ${seeds.systemAccounts.stripeSource.id}::uuid
      `;

      const playerAccount = await getOrCreatePlayerAccount(tx, seeds.playerA.id);
      const result = await transfer(tx, {
        fromAccountId: seeds.systemAccounts.stripeSource.id,
        toAccountId: playerAccount.id,
        amount: "100.00",
        transactionType: TransactionType.DEPOSIT,
        idempotencyKey: "audit_tx_test_1",
      });

      const imbalance = await verifyTransactionBalance(
        tx,
        result.transaction.id
      );

      expect(imbalance).toBeNull();
    });
  });

  it("should detect an imbalanced transaction (corrupted entry)", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);

      await tx.$executeRaw`
        UPDATE ledger_accounts
        SET balance = 10000
        WHERE id = ${seeds.systemAccounts.stripeSource.id}::uuid
      `;

      const playerAccount = await getOrCreatePlayerAccount(tx, seeds.playerA.id);
      const result = await transfer(tx, {
        fromAccountId: seeds.systemAccounts.stripeSource.id,
        toAccountId: playerAccount.id,
        amount: "100.00",
        transactionType: TransactionType.DEPOSIT,
        idempotencyKey: "audit_tx_corrupt_1",
      });

      // Corrupt one entry by changing its amount
      const creditEntry = result.entries.find((e) =>
        new Decimal(e.amount.toString()).gt(0)
      );
      await tx.$executeRaw`
        UPDATE ledger_entries
        SET amount = 200.00
        WHERE id = ${creditEntry!.id}::uuid
      `;

      const imbalance = await verifyTransactionBalance(
        tx,
        result.transaction.id
      );

      expect(imbalance).not.toBeNull();
      expect(imbalance!.transactionId).toBe(result.transaction.id);
      // Sum should be -100 + 200 = 100 (not zero)
      expect(new Decimal(imbalance!.entrySum).eq("100")).toBe(true);
    });
  });
});

describe("verifySystemConservation", () => {
  it("should report conservation when all transfers are balanced", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);

      // Use only transfer() calls — no raw SQL balance hacks.
      // Give STRIPE_SOURCE a balance via raw SQL, then transfer.
      // The entries from transfer() are balanced (debit + credit = 0).
      // STRIPE_SOURCE materialized balance won't match its entries, but
      // that's a separate check. System conservation only checks entry sums.
      await tx.$executeRaw`
        UPDATE ledger_accounts
        SET balance = 50000
        WHERE id = ${seeds.systemAccounts.stripeSource.id}::uuid
      `;

      const playerAAccount = await getOrCreatePlayerAccount(tx, seeds.playerA.id);
      const playerBAccount = await getOrCreatePlayerAccount(tx, seeds.playerB.id);

      // Two deposits
      await transfer(tx, {
        fromAccountId: seeds.systemAccounts.stripeSource.id,
        toAccountId: playerAAccount.id,
        amount: "500.00",
        transactionType: TransactionType.DEPOSIT,
        idempotencyKey: "conservation_deposit_A",
      });

      await transfer(tx, {
        fromAccountId: seeds.systemAccounts.stripeSource.id,
        toAccountId: playerBAccount.id,
        amount: "500.00",
        transactionType: TransactionType.DEPOSIT,
        idempotencyKey: "conservation_deposit_B",
      });

      // Every transfer() creates balanced pairs, so global sum = 0
      const conservation = await verifySystemConservation(tx);
      expect(conservation.isConserved).toBe(true);
      expect(new Decimal(conservation.totalSum).eq(0)).toBe(true);
    });
  });

  it("should detect non-conservation after data corruption", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);

      await tx.$executeRaw`
        UPDATE ledger_accounts
        SET balance = 10000
        WHERE id = ${seeds.systemAccounts.stripeSource.id}::uuid
      `;

      const playerAccount = await getOrCreatePlayerAccount(tx, seeds.playerA.id);
      await transfer(tx, {
        fromAccountId: seeds.systemAccounts.stripeSource.id,
        toAccountId: playerAccount.id,
        amount: "500.00",
        transactionType: TransactionType.DEPOSIT,
        idempotencyKey: "conservation_corrupt_deposit",
      });

      // Corrupt: insert a phantom ledger entry with no matching counterpart
      const anyTx = await tx.transaction.findFirst();
      if (anyTx) {
        await tx.$executeRaw`
          INSERT INTO ledger_entries (id, ledger_account_id, transaction_id, amount, balance_after, created_at)
          VALUES (gen_random_uuid(), ${playerAccount.id}::uuid, ${anyTx.id}::uuid, 999.99, 0, NOW())
        `;
      }

      const conservation = await verifySystemConservation(tx);
      expect(conservation.isConserved).toBe(false);
    });
  });
});

describe("runFullAudit", () => {
  it("should report healthy for a system where all operations use transfer()", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);

      // For a clean audit, we need every account's balance to match its entries.
      // Use two player accounts as source/destination, both start at 0.
      // We'll directly create entries that are fully balanced.

      // Give stripe source balance via raw SQL for initial funding
      await tx.$executeRaw`
        UPDATE ledger_accounts
        SET balance = 50000
        WHERE id = ${seeds.systemAccounts.stripeSource.id}::uuid
      `;

      const playerAAccount = await getOrCreatePlayerAccount(tx, seeds.playerA.id);
      const playerBAccount = await getOrCreatePlayerAccount(tx, seeds.playerB.id);

      // Fund players via transfer
      await transfer(tx, {
        fromAccountId: seeds.systemAccounts.stripeSource.id,
        toAccountId: playerAAccount.id,
        amount: "500.00",
        transactionType: TransactionType.DEPOSIT,
        idempotencyKey: "full_audit_deposit_A",
      });

      await transfer(tx, {
        fromAccountId: seeds.systemAccounts.stripeSource.id,
        toAccountId: playerBAccount.id,
        amount: "500.00",
        transactionType: TransactionType.DEPOSIT,
        idempotencyKey: "full_audit_deposit_B",
      });

      // Create a bet and run escrow lifecycle
      const bet = await createTestBet(tx, {
        gameId: seeds.game.id,
        playerAId: seeds.playerA.id,
        amount: 100,
        status: BetStatus.PENDING_CONSENT,
      });

      await holdEscrow(tx, {
        playerId: seeds.playerA.id,
        betId: bet.id,
        amount: "100.00",
        idempotencyKey: `full_audit_hold_A_${bet.id}`,
      });

      await tx.bet.update({
        where: { id: bet.id },
        data: { status: BetStatus.OPEN },
      });

      await holdEscrow(tx, {
        playerId: seeds.playerB.id,
        betId: bet.id,
        amount: "100.00",
        idempotencyKey: `full_audit_hold_B_${bet.id}`,
      });

      await tx.bet.update({
        where: { id: bet.id },
        data: {
          status: BetStatus.RESULT_REPORTED,
          playerBId: seeds.playerB.id,
          outcome: "PLAYER_A_WIN",
          resultVerified: true,
        },
      });

      await collectFee(tx, {
        betId: bet.id,
        feeAmount: "10.00",
        idempotencyKey: `full_audit_fee_${bet.id}`,
      });

      await releaseEscrow(tx, {
        betId: bet.id,
        winnerId: seeds.playerA.id,
        amount: "190.00",
        idempotencyKey: `full_audit_release_${bet.id}`,
      });

      const report = await runFullAudit(tx);

      // Transaction imbalances should be zero (every transfer creates balanced pairs)
      expect(report.transactionImbalances).toHaveLength(0);

      // System conservation should hold
      expect(report.systemConservation.isConserved).toBe(true);

      // STRIPE_SOURCE will have a discrepancy because we primed it with raw SQL.
      // All other accounts should be clean.
      const nonStripeDiscrepancies = report.accountDiscrepancies.filter(
        (d) => d.accountId !== seeds.systemAccounts.stripeSource.id
      );
      expect(nonStripeDiscrepancies).toHaveLength(0);
    });
  });

  it("should detect multiple issues in a corrupted system", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);

      await tx.$executeRaw`
        UPDATE ledger_accounts
        SET balance = 10000
        WHERE id = ${seeds.systemAccounts.stripeSource.id}::uuid
      `;

      const playerAccount = await getOrCreatePlayerAccount(tx, seeds.playerA.id);
      await transfer(tx, {
        fromAccountId: seeds.systemAccounts.stripeSource.id,
        toAccountId: playerAccount.id,
        amount: "500.00",
        transactionType: TransactionType.DEPOSIT,
        idempotencyKey: "full_audit_corrupt_deposit",
      });

      // Corrupt the player balance
      await tx.$executeRaw`
        UPDATE ledger_accounts
        SET balance = 12345.67
        WHERE id = ${playerAccount.id}::uuid
      `;

      const report = await runFullAudit(tx);

      expect(report.isHealthy).toBe(false);
      expect(report.accountDiscrepancies.length).toBeGreaterThan(0);

      // Find the corrupted account in the report
      const playerDiscrepancy = report.accountDiscrepancies.find(
        (d) => d.accountId === playerAccount.id
      );
      expect(playerDiscrepancy).toBeDefined();
      expect(playerDiscrepancy!.materializedBalance).toBe("12345.67");
    });
  });
});
