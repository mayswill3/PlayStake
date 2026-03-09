import { describe, it, expect, afterAll } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";
import { BetStatus, TransactionType } from "../../../generated/prisma/client.js";
import {
  withRollback,
  seedTestData,
  fundPlayer,
  createTestBet,
  disconnectTestPrisma,
} from "./helpers.js";
import {
  holdEscrow,
  releaseEscrow,
  refundEscrow,
  collectFee,
  distributeDevShare,
  EscrowError,
} from "../../../src/lib/ledger/escrow.js";
import {
  getOrCreatePlayerAccount,
  getAccountBalance,
  getEscrowAccountForBet,
  getSystemAccount,
  getOrCreateDeveloperAccount,
} from "../../../src/lib/ledger/accounts.js";
import { LedgerAccountType } from "../../../generated/prisma/client.js";

afterAll(async () => {
  await disconnectTestPrisma();
});

describe("escrow lifecycle", () => {
  it("should hold escrow: move funds from player to escrow account", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);

      // Fund player A with 500.00
      await fundPlayer(
        tx,
        seeds.playerA.id,
        seeds.systemAccounts.stripeSource.id,
        "500.00"
      );

      // Create a bet in PENDING_CONSENT status
      const bet = await createTestBet(tx, {
        gameId: seeds.game.id,
        playerAId: seeds.playerA.id,
        amount: 100,
        status: BetStatus.PENDING_CONSENT,
      });

      const result = await holdEscrow(tx, {
        playerId: seeds.playerA.id,
        betId: bet.id,
        amount: "100.00",
        idempotencyKey: `escrow_hold_${bet.id}_playerA`,
      });

      expect(result.transaction.type).toBe(TransactionType.BET_ESCROW);

      // Player balance should decrease by 100
      const playerAccount = await getOrCreatePlayerAccount(tx, seeds.playerA.id);
      const playerBalance = await getAccountBalance(tx, playerAccount.id);
      expect(playerBalance.eq("400.00")).toBe(true);

      // Escrow balance should be 100
      const escrowAccount = await getEscrowAccountForBet(tx, bet.id);
      const escrowBalance = await getAccountBalance(tx, escrowAccount.id);
      expect(escrowBalance.eq("100.00")).toBe(true);
    });
  });

  it("should run a full escrow lifecycle: hold -> fee -> release -> escrow ends at zero", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);

      // Fund both players with 500.00 each
      await fundPlayer(
        tx,
        seeds.playerA.id,
        seeds.systemAccounts.stripeSource.id,
        "500.00"
      );
      await fundPlayer(
        tx,
        seeds.playerB.id,
        seeds.systemAccounts.stripeSource.id,
        "500.00"
      );

      // Create a bet in PENDING_CONSENT, then hold escrow for player A
      const bet = await createTestBet(tx, {
        gameId: seeds.game.id,
        playerAId: seeds.playerA.id,
        amount: 100,
        status: BetStatus.PENDING_CONSENT,
        platformFeePercent: 0.05,
      });

      // Hold escrow for Player A (PENDING_CONSENT -> after consent)
      await holdEscrow(tx, {
        playerId: seeds.playerA.id,
        betId: bet.id,
        amount: "100.00",
        idempotencyKey: `hold_${bet.id}_A`,
      });

      // Update bet to OPEN status for Player B's escrow
      await tx.bet.update({
        where: { id: bet.id },
        data: {
          status: BetStatus.OPEN,
          playerAConsentedAt: new Date(),
        },
      });

      // Hold escrow for Player B
      await holdEscrow(tx, {
        playerId: seeds.playerB.id,
        betId: bet.id,
        amount: "100.00",
        idempotencyKey: `hold_${bet.id}_B`,
      });

      // Update bet to MATCHED
      await tx.bet.update({
        where: { id: bet.id },
        data: {
          status: BetStatus.MATCHED,
          playerBId: seeds.playerB.id,
          matchedAt: new Date(),
          playerBConsentedAt: new Date(),
        },
      });

      // Verify escrow has 200.00
      const escrowAccount = await getEscrowAccountForBet(tx, bet.id);
      let escrowBalance = await getAccountBalance(tx, escrowAccount.id);
      expect(escrowBalance.eq("200.00")).toBe(true);

      // Simulate result reported
      await tx.bet.update({
        where: { id: bet.id },
        data: {
          status: BetStatus.RESULT_REPORTED,
          outcome: "PLAYER_A_WIN",
          resultReportedAt: new Date(),
          resultVerified: true,
        },
      });

      // Settlement step 1: Collect platform fee (5% of 200 = 10.00)
      const feeAmount = new Decimal("200.00").mul("0.05").toDecimalPlaces(2);
      expect(feeAmount.eq("10.00")).toBe(true);

      await collectFee(tx, {
        betId: bet.id,
        feeAmount: feeAmount.toString(),
        idempotencyKey: `settle_${bet.id}_fee`,
      });

      // Verify escrow decreased by fee
      escrowBalance = await getAccountBalance(tx, escrowAccount.id);
      expect(escrowBalance.eq("190.00")).toBe(true);

      // Verify platform revenue received the fee
      const platformRevenue = await getSystemAccount(
        tx,
        LedgerAccountType.PLATFORM_REVENUE
      );
      const platformBalance = await getAccountBalance(tx, platformRevenue.id);
      expect(platformBalance.eq("10.00")).toBe(true);

      // Settlement step 2: Release remaining escrow to winner (Player A)
      await releaseEscrow(tx, {
        betId: bet.id,
        winnerId: seeds.playerA.id,
        amount: "190.00",
        idempotencyKey: `settle_${bet.id}_release`,
      });

      // Verify escrow is now zero
      escrowBalance = await getAccountBalance(tx, escrowAccount.id);
      expect(escrowBalance.eq("0")).toBe(true);

      // Verify Player A received winnings
      const playerAAccount = await getOrCreatePlayerAccount(tx, seeds.playerA.id);
      const playerABalance = await getAccountBalance(tx, playerAAccount.id);
      // Started with 500, escrowed 100, received 190 back = 590
      expect(playerABalance.eq("590.00")).toBe(true);

      // Verify Player B lost their escrow
      const playerBAccount = await getOrCreatePlayerAccount(tx, seeds.playerB.id);
      const playerBBalance = await getAccountBalance(tx, playerBAccount.id);
      // Started with 500, escrowed 100 = 400
      expect(playerBBalance.eq("400.00")).toBe(true);

      // Optional: distribute dev share (2% of 10.00 fee = 0.20)
      const devShare = new Decimal("10.00").mul("0.02").toDecimalPlaces(2);
      await distributeDevShare(tx, {
        developerUserId: seeds.developer.id,
        amount: devShare.toString(),
        idempotencyKey: `settle_${bet.id}_devshare`,
      });

      // Verify dev account received the share
      const devAccount = await getOrCreateDeveloperAccount(tx, seeds.developer.id);
      const devBalance = await getAccountBalance(tx, devAccount.id);
      expect(devBalance.eq("0.20")).toBe(true);

      // Platform revenue should be reduced by dev share
      const finalPlatformBalance = await getAccountBalance(tx, platformRevenue.id);
      expect(finalPlatformBalance.eq("9.80")).toBe(true);
    });
  });

  it("should refund escrow on cancellation and return escrow to zero", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);

      // Fund player A
      await fundPlayer(
        tx,
        seeds.playerA.id,
        seeds.systemAccounts.stripeSource.id,
        "500.00"
      );

      // Create and hold escrow
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
        idempotencyKey: `hold_${bet.id}_A`,
      });

      // Move to OPEN
      await tx.bet.update({
        where: { id: bet.id },
        data: { status: BetStatus.OPEN },
      });

      // Refund (cancellation)
      await refundEscrow(tx, {
        betId: bet.id,
        playerId: seeds.playerA.id,
        amount: "100.00",
        idempotencyKey: `refund_${bet.id}_A`,
      });

      // Escrow should be zero
      const escrowAccount = await getEscrowAccountForBet(tx, bet.id);
      const escrowBalance = await getAccountBalance(tx, escrowAccount.id);
      expect(escrowBalance.eq("0")).toBe(true);

      // Player should have their money back
      const playerAccount = await getOrCreatePlayerAccount(tx, seeds.playerA.id);
      const playerBalance = await getAccountBalance(tx, playerAccount.id);
      expect(playerBalance.eq("500.00")).toBe(true);
    });
  });

  it("should reject holdEscrow when player has insufficient funds", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);

      // Player A has 0 balance (no funding)
      await getOrCreatePlayerAccount(tx, seeds.playerA.id);

      const bet = await createTestBet(tx, {
        gameId: seeds.game.id,
        playerAId: seeds.playerA.id,
        amount: 100,
        status: BetStatus.PENDING_CONSENT,
      });

      await expect(
        holdEscrow(tx, {
          playerId: seeds.playerA.id,
          betId: bet.id,
          amount: "100.00",
          idempotencyKey: `hold_${bet.id}_insufficient`,
        })
      ).rejects.toThrow("Insufficient funds");
    });
  });

  it("should reject holdEscrow on a bet in wrong status", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);

      await fundPlayer(
        tx,
        seeds.playerA.id,
        seeds.systemAccounts.stripeSource.id,
        "500.00"
      );

      const bet = await createTestBet(tx, {
        gameId: seeds.game.id,
        playerAId: seeds.playerA.id,
        playerBId: seeds.playerB.id,
        amount: 100,
        status: BetStatus.SETTLED,
      });

      await expect(
        holdEscrow(tx, {
          playerId: seeds.playerA.id,
          betId: bet.id,
          amount: "100.00",
          idempotencyKey: `hold_settled_bet`,
        })
      ).rejects.toThrow(EscrowError);
    });
  });

  it("should reject releaseEscrow when escrow has insufficient balance", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);

      await fundPlayer(
        tx,
        seeds.playerA.id,
        seeds.systemAccounts.stripeSource.id,
        "500.00"
      );

      const bet = await createTestBet(tx, {
        gameId: seeds.game.id,
        playerAId: seeds.playerA.id,
        playerBId: seeds.playerB.id,
        amount: 100,
        status: BetStatus.PENDING_CONSENT,
      });

      // Hold only 100 in escrow
      await holdEscrow(tx, {
        playerId: seeds.playerA.id,
        betId: bet.id,
        amount: "100.00",
        idempotencyKey: `hold_${bet.id}_A`,
      });

      // Update to RESULT_REPORTED
      await tx.bet.update({
        where: { id: bet.id },
        data: { status: BetStatus.RESULT_REPORTED },
      });

      // Try to release more than escrow holds
      await expect(
        releaseEscrow(tx, {
          betId: bet.id,
          winnerId: seeds.playerA.id,
          amount: "200.00",
          idempotencyKey: `release_too_much`,
        })
      ).rejects.toThrow(EscrowError);
    });
  });

  it("should handle holdEscrow idempotency", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);

      await fundPlayer(
        tx,
        seeds.playerA.id,
        seeds.systemAccounts.stripeSource.id,
        "500.00"
      );

      const bet = await createTestBet(tx, {
        gameId: seeds.game.id,
        playerAId: seeds.playerA.id,
        amount: 100,
        status: BetStatus.PENDING_CONSENT,
      });

      const key = `hold_idempotent_${bet.id}`;

      // First hold
      const result1 = await holdEscrow(tx, {
        playerId: seeds.playerA.id,
        betId: bet.id,
        amount: "100.00",
        idempotencyKey: key,
      });

      // Second hold with same key
      const result2 = await holdEscrow(tx, {
        playerId: seeds.playerA.id,
        betId: bet.id,
        amount: "100.00",
        idempotencyKey: key,
      });

      // Same transaction returned
      expect(result2.transaction.id).toBe(result1.transaction.id);

      // Balance only debited once
      const playerAccount = await getOrCreatePlayerAccount(tx, seeds.playerA.id);
      const balance = await getAccountBalance(tx, playerAccount.id);
      expect(balance.eq("400.00")).toBe(true);
    });
  });
});
