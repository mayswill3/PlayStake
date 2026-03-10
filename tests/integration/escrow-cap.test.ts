// =============================================================================
// Integration Tests: Developer Escrow Limits
// =============================================================================
// Tests that developer escrow caps are enforced correctly.
// =============================================================================

import { describe, it, expect, afterAll } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";
import { BetStatus } from "../../generated/prisma/client.js";
import {
  withRollback,
  createFullScenario,
  getPlayerBalance,
  getEscrowBalance,
  getCurrentEscrowLimit,
  disconnectTestPrisma,
} from "./helpers.js";

afterAll(async () => {
  await disconnectTestPrisma();
});

describe("Escrow Cap Enforcement", () => {
  it("consent fails atomically when escrow cap would be exceeded (single bet)", async () => {
    await withRollback(async (tx) => {
      // Create scenario with very low escrow limit
      const scenario = await createFullScenario(tx, {
        playerABalance: 1000,
        playerBBalance: 1000,
        maxTotalEscrow: 15, // Only $15 total escrow allowed
        maxSingleBet: 1000,
      });

      const { holdEscrow } = await import("../../src/lib/ledger/escrow.js");

      // First bet: $10 should succeed
      const bet1 = await tx.bet.create({
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
        betId: bet1.id,
        amount: new Decimal("10.00"),
        idempotencyKey: `cap_test_1_${bet1.id}`,
      });

      const limitAfter1 = await getCurrentEscrowLimit(
        tx,
        scenario.escrowLimit.id
      );
      expect(limitAfter1.eq(10)).toBe(true);

      // Second bet: $10 would bring total to $20, exceeding $15 cap
      const bet2 = await tx.bet.create({
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

      await expect(
        holdEscrow(tx, {
          playerId: scenario.playerA.id,
          betId: bet2.id,
          amount: new Decimal("10.00"),
          idempotencyKey: `cap_test_2_${bet2.id}`,
        })
      ).rejects.toThrow("escrow cap exceeded");

      // But a $5 bet should still work (total = $15, exactly at cap)
      const bet3 = await tx.bet.create({
        data: {
          gameId: scenario.game.id,
          playerAId: scenario.playerA.id,
          amount: new Decimal("5.00"),
          currency: "USD",
          status: BetStatus.PENDING_CONSENT,
          platformFeePercent: scenario.game.platformFeePercent,
          expiresAt: new Date(Date.now() + 300_000),
        },
      });

      await holdEscrow(tx, {
        playerId: scenario.playerA.id,
        betId: bet3.id,
        amount: new Decimal("5.00"),
        idempotencyKey: `cap_test_3_${bet3.id}`,
      });

      const limitAfter3 = await getCurrentEscrowLimit(
        tx,
        scenario.escrowLimit.id
      );
      expect(limitAfter3.eq(15)).toBe(true);
    });
  });

  it("maxSingleBet cap rejects bets exceeding the per-bet limit", async () => {
    await withRollback(async (tx) => {
      const scenario = await createFullScenario(tx, {
        playerABalance: 5000,
        maxTotalEscrow: 50000,
        maxSingleBet: 20, // Only $20 per bet
      });

      const { holdEscrow } = await import("../../src/lib/ledger/escrow.js");

      const bet = await tx.bet.create({
        data: {
          gameId: scenario.game.id,
          playerAId: scenario.playerA.id,
          amount: new Decimal("25.00"), // Exceeds maxSingleBet of $20
          currency: "USD",
          status: BetStatus.PENDING_CONSENT,
          platformFeePercent: scenario.game.platformFeePercent,
          expiresAt: new Date(Date.now() + 300_000),
        },
      });

      await expect(
        holdEscrow(tx, {
          playerId: scenario.playerA.id,
          betId: bet.id,
          amount: new Decimal("25.00"),
          idempotencyKey: `cap_single_${bet.id}`,
        })
      ).rejects.toThrow("escrow cap exceeded");
    });
  });

  it("escrow limit decrements correctly on cancel and settlement", async () => {
    await withRollback(async (tx) => {
      const scenario = await createFullScenario(tx, {
        playerABalance: 200,
        playerBBalance: 200,
        maxTotalEscrow: 50000,
        maxSingleBet: 1000,
      });

      const { holdEscrow, refundEscrow, collectFee, releaseEscrow } =
        await import("../../src/lib/ledger/escrow.js");

      // Create bet 1: $10, will be cancelled
      const bet1 = await tx.bet.create({
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
        betId: bet1.id,
        amount: new Decimal("10.00"),
        idempotencyKey: `decrement_consent1_${bet1.id}`,
      });
      await tx.bet.update({
        where: { id: bet1.id },
        data: { status: BetStatus.OPEN, playerAConsentedAt: new Date() },
      });

      let currentEscrow = await getCurrentEscrowLimit(
        tx,
        scenario.escrowLimit.id
      );
      expect(currentEscrow.eq(10)).toBe(true);

      // Cancel bet 1 -- escrow limit should decrement
      await refundEscrow(tx, {
        betId: bet1.id,
        playerId: scenario.playerA.id,
        amount: new Decimal("10.00"),
        idempotencyKey: `decrement_refund1_${bet1.id}`,
      });
      await tx.bet.update({
        where: { id: bet1.id },
        data: { status: BetStatus.CANCELLED, cancelledAt: new Date() },
      });

      currentEscrow = await getCurrentEscrowLimit(
        tx,
        scenario.escrowLimit.id
      );
      expect(currentEscrow.eq(0)).toBe(true);

      // Create bet 2: full lifecycle to settlement
      const bet2 = await tx.bet.create({
        data: {
          gameId: scenario.game.id,
          playerAId: scenario.playerA.id,
          amount: new Decimal("15.00"),
          currency: "USD",
          status: BetStatus.PENDING_CONSENT,
          platformFeePercent: scenario.game.platformFeePercent,
          expiresAt: new Date(Date.now() + 300_000),
        },
      });

      await holdEscrow(tx, {
        playerId: scenario.playerA.id,
        betId: bet2.id,
        amount: new Decimal("15.00"),
        idempotencyKey: `decrement_consent2_${bet2.id}`,
      });
      await tx.bet.update({
        where: { id: bet2.id },
        data: { status: BetStatus.OPEN, playerAConsentedAt: new Date() },
      });

      await holdEscrow(tx, {
        playerId: scenario.playerB.id,
        betId: bet2.id,
        amount: new Decimal("15.00"),
        idempotencyKey: `decrement_accept2_${bet2.id}`,
      });
      await tx.bet.update({
        where: { id: bet2.id },
        data: {
          status: BetStatus.MATCHED,
          playerBId: scenario.playerB.id,
          matchedAt: new Date(),
        },
      });

      currentEscrow = await getCurrentEscrowLimit(
        tx,
        scenario.escrowLimit.id
      );
      expect(currentEscrow.eq(30)).toBe(true); // 15+15

      // Report result and settle
      await tx.bet.update({
        where: { id: bet2.id },
        data: {
          status: BetStatus.RESULT_REPORTED,
          outcome: "PLAYER_A_WIN",
          resultReportedAt: new Date(),
          resultVerified: true,
        },
      });

      const pot = new Decimal("30.00");
      const fee = pot.mul(0.05).toDecimalPlaces(2); // $1.50

      await collectFee(tx, {
        betId: bet2.id,
        feeAmount: fee,
        idempotencyKey: `decrement_fee2_${bet2.id}`,
      });

      await releaseEscrow(tx, {
        betId: bet2.id,
        winnerId: scenario.playerA.id,
        amount: pot.sub(fee),
        idempotencyKey: `decrement_release2_${bet2.id}`,
      });

      await tx.bet.update({
        where: { id: bet2.id },
        data: { status: BetStatus.SETTLED, settledAt: new Date() },
      });

      // Decrement escrow after settlement
      await tx.$executeRaw`
        UPDATE developer_escrow_limits
        SET current_escrow = GREATEST(current_escrow - ${pot}::decimal, 0),
            updated_at = NOW()
        WHERE id = ${scenario.escrowLimit.id}::uuid
      `;

      currentEscrow = await getCurrentEscrowLimit(
        tx,
        scenario.escrowLimit.id
      );
      expect(currentEscrow.eq(0)).toBe(true);

      // Final escrow balance should be zero
      const escrow = await getEscrowBalance(tx, bet2.id);
      expect(escrow.eq(0)).toBe(true);
    });
  });
});
