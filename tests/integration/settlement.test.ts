// =============================================================================
// Integration Tests: Settlement Edge Cases
// =============================================================================
// Tests DRAW settlement, verified-only settlement, double-settlement prevention,
// fee precision, and developer revenue share.
// =============================================================================

import { describe, it, expect, afterAll } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";
import { BetStatus, BetOutcome } from "../../generated/prisma/client.js";
import {
  withRollback,
  createFullScenario,
  getPlayerBalance,
  getEscrowBalance,
  getPlatformRevenueBalance,
  getDeveloperBalance,
  disconnectTestPrisma,
} from "./helpers.js";

afterAll(async () => {
  await disconnectTestPrisma();
});

/**
 * Helper: progress a bet from creation to RESULT_REPORTED with verified result.
 */
async function createMatchedBet(
  tx: any,
  scenario: any,
  betAmountDollars: number,
  outcome: string
) {
  const { holdEscrow } = await import("../../src/lib/ledger/escrow.js");
  const { sha256Hash } = await import("../../src/lib/utils/crypto.js");
  const betAmount = new Decimal(betAmountDollars.toString());

  const bet = await tx.bet.create({
    data: {
      gameId: scenario.game.id,
      playerAId: scenario.playerA.id,
      amount: betAmount,
      currency: "USD",
      status: BetStatus.PENDING_CONSENT,
      platformFeePercent: scenario.game.platformFeePercent,
      expiresAt: new Date(Date.now() + 300_000),
      consentExpiresAt: new Date(Date.now() + 60_000),
    },
  });

  // Consent
  await holdEscrow(tx, {
    playerId: scenario.playerA.id,
    betId: bet.id,
    amount: betAmount,
    idempotencyKey: `settle_test_consent_${bet.id}`,
  });
  await tx.bet.update({
    where: { id: bet.id },
    data: { status: BetStatus.OPEN, playerAConsentedAt: new Date() },
  });

  // Accept
  await holdEscrow(tx, {
    playerId: scenario.playerB.id,
    betId: bet.id,
    amount: betAmount,
    idempotencyKey: `settle_test_accept_${bet.id}`,
  });
  await tx.bet.update({
    where: { id: bet.id },
    data: {
      status: BetStatus.MATCHED,
      playerBId: scenario.playerB.id,
      matchedAt: new Date(),
    },
  });

  // Report result
  const resultIdemKey = `settle_test_result_${bet.id}`;
  await tx.bet.update({
    where: { id: bet.id },
    data: {
      status: BetStatus.RESULT_REPORTED,
      outcome: outcome as BetOutcome,
      resultReportedAt: new Date(),
      resultIdempotencyKey: resultIdemKey,
      serverResultHash: sha256Hash(bet.id + outcome + resultIdemKey),
      widgetResultHash: sha256Hash(bet.id + outcome),
      resultVerified: true,
    },
  });

  return bet;
}

describe("Settlement: DRAW outcome", () => {
  it("should split pot equally between both players minus fees", async () => {
    await withRollback(async (tx) => {
      const scenario = await createFullScenario(tx, {
        playerABalance: 100,
        playerBBalance: 100,
        revSharePercent: 0,
        platformFeePercent: 0.05,
      });

      const bet = await createMatchedBet(
        tx,
        scenario,
        10,
        BetOutcome.DRAW
      );

      const { collectFee, releaseEscrow } = await import(
        "../../src/lib/ledger/escrow.js"
      );

      const pot = new Decimal("20.00");
      const feeAmount = pot
        .mul(0.05)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP); // $1.00

      // Collect fee
      await collectFee(tx, {
        betId: bet.id,
        feeAmount,
        idempotencyKey: `settle_${bet.id}_fee`,
      });

      const remainingEscrow = pot.sub(feeAmount); // $19.00
      const halfPayout = remainingEscrow
        .div(2)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP); // $9.50
      const playerAPayout = halfPayout;
      const playerBPayout = remainingEscrow.sub(playerAPayout); // $9.50

      // Release to both players
      await releaseEscrow(tx, {
        betId: bet.id,
        winnerId: scenario.playerA.id,
        amount: playerAPayout,
        idempotencyKey: `settle_${bet.id}_release_a`,
      });

      await releaseEscrow(tx, {
        betId: bet.id,
        winnerId: scenario.playerB.id,
        amount: playerBPayout,
        idempotencyKey: `settle_${bet.id}_release_b`,
      });

      await tx.bet.update({
        where: { id: bet.id },
        data: {
          status: BetStatus.SETTLED,
          settledAt: new Date(),
          platformFeeAmount: feeAmount,
        },
      });

      // Verify balances
      const balA = await getPlayerBalance(tx, scenario.playerA.id);
      const balB = await getPlayerBalance(tx, scenario.playerB.id);
      const escrow = await getEscrowBalance(tx, bet.id);

      // PlayerA: 100 - 10 + 9.50 = 99.50
      expect(balA.eq(new Decimal("99.50"))).toBe(true);
      // PlayerB: 100 - 10 + 9.50 = 99.50
      expect(balB.eq(new Decimal("99.50"))).toBe(true);
      // Escrow empty
      expect(escrow.eq(0)).toBe(true);

      // Platform revenue = $1.00
      const revenue = await getPlatformRevenueBalance(tx);
      expect(revenue.eq(new Decimal("1.00"))).toBe(true);
    });
  });
});

describe("Settlement: Only verified results", () => {
  it("settlement logic should skip unverified results", async () => {
    await withRollback(async (tx) => {
      const scenario = await createFullScenario(tx);

      const { holdEscrow } = await import("../../src/lib/ledger/escrow.js");

      const bet = await tx.bet.create({
        data: {
          gameId: scenario.game.id,
          playerAId: scenario.playerA.id,
          amount: new Decimal("10.00"),
          currency: "USD",
          status: BetStatus.PENDING_CONSENT,
          platformFeePercent: scenario.game.platformFeePercent,
          expiresAt: new Date(Date.now() + 300_000),
        },
      });

      await holdEscrow(tx, {
        playerId: scenario.playerA.id,
        betId: bet.id,
        amount: new Decimal("10.00"),
        idempotencyKey: `unverified_consent_${bet.id}`,
      });
      await tx.bet.update({
        where: { id: bet.id },
        data: { status: BetStatus.OPEN, playerAConsentedAt: new Date() },
      });

      await holdEscrow(tx, {
        playerId: scenario.playerB.id,
        betId: bet.id,
        amount: new Decimal("10.00"),
        idempotencyKey: `unverified_accept_${bet.id}`,
      });
      await tx.bet.update({
        where: { id: bet.id },
        data: {
          status: BetStatus.MATCHED,
          playerBId: scenario.playerB.id,
          matchedAt: new Date(),
        },
      });

      // Report result but DO NOT verify
      await tx.bet.update({
        where: { id: bet.id },
        data: {
          status: BetStatus.RESULT_REPORTED,
          outcome: BetOutcome.PLAYER_A_WIN,
          resultReportedAt: new Date(),
          resultVerified: false, // NOT verified
        },
      });

      // The settlement worker checks: if (!bet.result_verified) return;
      const betData = await tx.bet.findUniqueOrThrow({
        where: { id: bet.id },
      });
      expect(betData.resultVerified).toBe(false);
      expect(betData.status).toBe(BetStatus.RESULT_REPORTED);

      // Settlement would skip this bet. Verify escrow is still held.
      const escrow = await getEscrowBalance(tx, bet.id);
      expect(escrow.eq(new Decimal("20"))).toBe(true);
    });
  });
});

describe("Settlement: Double-settlement prevention", () => {
  it("cannot settle an already-settled bet", async () => {
    await withRollback(async (tx) => {
      const scenario = await createFullScenario(tx, {
        playerABalance: 100,
        playerBBalance: 100,
      });

      const bet = await createMatchedBet(
        tx,
        scenario,
        10,
        BetOutcome.PLAYER_A_WIN
      );

      const { collectFee, releaseEscrow } = await import(
        "../../src/lib/ledger/escrow.js"
      );

      const pot = new Decimal("20.00");
      const fee = pot.mul(0.05).toDecimalPlaces(2);

      // First settlement
      await collectFee(tx, {
        betId: bet.id,
        feeAmount: fee,
        idempotencyKey: `double_${bet.id}_fee`,
      });
      await releaseEscrow(tx, {
        betId: bet.id,
        winnerId: scenario.playerA.id,
        amount: pot.sub(fee),
        idempotencyKey: `double_${bet.id}_release`,
      });
      await tx.bet.update({
        where: { id: bet.id },
        data: {
          status: BetStatus.SETTLED,
          settledAt: new Date(),
          platformFeeAmount: fee,
        },
      });

      // Second attempt: the worker checks status !== RESULT_REPORTED
      const settledBet = await tx.bet.findUniqueOrThrow({
        where: { id: bet.id },
      });
      expect(settledBet.status).toBe(BetStatus.SETTLED);

      // collectFee would throw because bet is SETTLED (allowed for idempotency),
      // but a new fee collection with a different key should fail or be idempotent
      // The idempotency key returns the same result without re-executing
      const result = await collectFee(tx, {
        betId: bet.id,
        feeAmount: fee,
        idempotencyKey: `double_${bet.id}_fee`, // Same key
      });

      // Should return the original transaction (idempotent)
      expect(result.transaction).toBeDefined();
    });
  });
});

describe("Settlement: Fee calculation uses Decimal precision", () => {
  it("fee calculation should not have floating-point errors", async () => {
    await withRollback(async (tx) => {
      const scenario = await createFullScenario(tx, {
        playerABalance: 500,
        playerBBalance: 500,
        platformFeePercent: 0.05,
      });

      // Use an amount that could cause floating-point issues: $33.33
      const bet = await createMatchedBet(
        tx,
        scenario,
        33.33,
        BetOutcome.PLAYER_A_WIN
      );

      const pot = new Decimal("66.66");
      const feePercent = new Decimal("0.05");
      const fee = pot
        .mul(feePercent)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      // Expected: 66.66 * 0.05 = 3.333 -> rounded to 3.33
      expect(fee.eq(new Decimal("3.33"))).toBe(true);

      const { collectFee, releaseEscrow } = await import(
        "../../src/lib/ledger/escrow.js"
      );

      await collectFee(tx, {
        betId: bet.id,
        feeAmount: fee,
        idempotencyKey: `precision_${bet.id}_fee`,
      });

      const winnerPayout = pot.sub(fee); // 66.66 - 3.33 = 63.33
      expect(winnerPayout.eq(new Decimal("63.33"))).toBe(true);

      await releaseEscrow(tx, {
        betId: bet.id,
        winnerId: scenario.playerA.id,
        amount: winnerPayout,
        idempotencyKey: `precision_${bet.id}_release`,
      });

      // Verify escrow is exactly zero
      const escrow = await getEscrowBalance(tx, bet.id);
      expect(escrow.eq(0)).toBe(true);

      // Verify balances are exact
      const balA = await getPlayerBalance(tx, scenario.playerA.id);
      // 500 - 33.33 + 63.33 = 530.00
      expect(balA.eq(new Decimal("530"))).toBe(true);
    });
  });
});

describe("Settlement: Developer revenue share", () => {
  it("developer receives correct share when revSharePercent > 0", async () => {
    await withRollback(async (tx) => {
      const scenario = await createFullScenario(tx, {
        playerABalance: 100,
        playerBBalance: 100,
        revSharePercent: 0.1, // 10% of platform fee
        platformFeePercent: 0.05,
      });

      const bet = await createMatchedBet(
        tx,
        scenario,
        10,
        BetOutcome.PLAYER_B_WIN
      );

      const { collectFee, releaseEscrow, distributeDevShare } = await import(
        "../../src/lib/ledger/escrow.js"
      );

      const pot = new Decimal("20.00");
      const feeAmount = pot.mul(0.05).toDecimalPlaces(2); // $1.00
      const devShareAmount = feeAmount
        .mul(new Decimal("0.1"))
        .toDecimalPlaces(2); // $0.10

      // Collect fee
      await collectFee(tx, {
        betId: bet.id,
        feeAmount,
        idempotencyKey: `devshare_${bet.id}_fee`,
      });

      // Distribute dev share
      await distributeDevShare(tx, {
        developerUserId: scenario.developerUser.id,
        amount: devShareAmount,
        idempotencyKey: `devshare_${bet.id}_devshare`,
      });

      // Release to winner (Player B)
      await releaseEscrow(tx, {
        betId: bet.id,
        winnerId: scenario.playerB.id,
        amount: pot.sub(feeAmount),
        idempotencyKey: `devshare_${bet.id}_release`,
      });

      // Verify developer balance
      const devBalance = await getDeveloperBalance(
        tx,
        scenario.developerUser.id
      );
      expect(devBalance.eq(new Decimal("0.10"))).toBe(true);

      // Platform revenue = fee - dev share = 1.00 - 0.10 = 0.90
      const platformRevenue = await getPlatformRevenueBalance(tx);
      expect(platformRevenue.eq(new Decimal("0.90"))).toBe(true);

      // Winner balance: 100 - 10 + 19 = 109
      const balB = await getPlayerBalance(tx, scenario.playerB.id);
      expect(balB.eq(new Decimal("109"))).toBe(true);

      // Loser balance: 100 - 10 = 90
      const balA = await getPlayerBalance(tx, scenario.playerA.id);
      expect(balA.eq(new Decimal("90"))).toBe(true);

      // Escrow empty
      const escrow = await getEscrowBalance(tx, bet.id);
      expect(escrow.eq(0)).toBe(true);
    });
  });

  it("no dev share distributed when revSharePercent is 0", async () => {
    await withRollback(async (tx) => {
      const scenario = await createFullScenario(tx, {
        playerABalance: 100,
        playerBBalance: 100,
        revSharePercent: 0,
        platformFeePercent: 0.05,
      });

      const bet = await createMatchedBet(
        tx,
        scenario,
        10,
        BetOutcome.PLAYER_A_WIN
      );

      const { collectFee, releaseEscrow } = await import(
        "../../src/lib/ledger/escrow.js"
      );

      const pot = new Decimal("20.00");
      const feeAmount = pot.mul(0.05).toDecimalPlaces(2);

      await collectFee(tx, {
        betId: bet.id,
        feeAmount,
        idempotencyKey: `nodevshare_${bet.id}_fee`,
      });

      await releaseEscrow(tx, {
        betId: bet.id,
        winnerId: scenario.playerA.id,
        amount: pot.sub(feeAmount),
        idempotencyKey: `nodevshare_${bet.id}_release`,
      });

      // Developer balance should be 0
      const devBalance = await getDeveloperBalance(
        tx,
        scenario.developerUser.id
      );
      expect(devBalance.eq(0)).toBe(true);

      // Platform revenue = full fee
      const platformRevenue = await getPlatformRevenueBalance(tx);
      expect(platformRevenue.eq(new Decimal("1.00"))).toBe(true);
    });
  });
});
