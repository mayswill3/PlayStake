// =============================================================================
// Integration Tests: Full Bet Lifecycle (CRITICAL)
// =============================================================================
// Tests the COMPLETE flow: propose -> consent -> accept -> result -> verify -> settle
// Verifies balances, escrow, fees, developer share, and ledger integrity.
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
  getCurrentEscrowLimit,
  disconnectTestPrisma,
} from "./helpers.js";

afterAll(async () => {
  await disconnectTestPrisma();
});

describe("Bet Lifecycle: Full flow from creation to settlement", () => {
  it("should complete the entire bet lifecycle with correct balances", async () => {
    await withRollback(async (tx) => {
      // ---------------------------------------------------------------
      // 1. Setup: Developer, game, two funded players, widget tokens
      // ---------------------------------------------------------------
      const scenario = await createFullScenario(tx, {
        playerABalance: 100,
        playerBBalance: 100,
        revSharePercent: 0.02,
        platformFeePercent: 0.05,
      });

      const betAmount = new Decimal("10.00");
      const initialBalanceA = await getPlayerBalance(tx, scenario.playerA.id);
      const initialBalanceB = await getPlayerBalance(tx, scenario.playerB.id);
      expect(initialBalanceA.eq(100)).toBe(true);
      expect(initialBalanceB.eq(100)).toBe(true);

      // ---------------------------------------------------------------
      // 2. Game server proposes a bet -> PENDING_CONSENT
      // ---------------------------------------------------------------
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

      expect(bet.status).toBe(BetStatus.PENDING_CONSENT);

      // No escrow yet
      const escrowAfterPropose = await getEscrowBalance(tx, bet.id);
      expect(escrowAfterPropose.eq(0)).toBe(true);

      // ---------------------------------------------------------------
      // 3. Player A consents -> OPEN, escrow funded
      // ---------------------------------------------------------------
      const { holdEscrow } = await import(
        "../../src/lib/ledger/escrow.js"
      );

      await holdEscrow(tx, {
        playerId: scenario.playerA.id,
        betId: bet.id,
        amount: betAmount,
        idempotencyKey: `test_consent_${bet.id}`,
      });

      await tx.bet.update({
        where: { id: bet.id },
        data: {
          status: BetStatus.OPEN,
          playerAConsentedAt: new Date(),
        },
      });

      const balanceAAfterConsent = await getPlayerBalance(tx, scenario.playerA.id);
      expect(balanceAAfterConsent.eq(new Decimal("90"))).toBe(true);

      const escrowAfterConsent = await getEscrowBalance(tx, bet.id);
      expect(escrowAfterConsent.eq(new Decimal("10"))).toBe(true);

      // Developer escrow limit incremented
      const escrowLimitAfterConsent = await getCurrentEscrowLimit(
        tx,
        scenario.escrowLimit.id
      );
      expect(escrowLimitAfterConsent.eq(new Decimal("10"))).toBe(true);

      // ---------------------------------------------------------------
      // 4. Player B accepts -> MATCHED, escrow doubled
      // ---------------------------------------------------------------
      await holdEscrow(tx, {
        playerId: scenario.playerB.id,
        betId: bet.id,
        amount: betAmount,
        idempotencyKey: `test_accept_${bet.id}`,
      });

      await tx.bet.update({
        where: { id: bet.id },
        data: {
          status: BetStatus.MATCHED,
          playerBId: scenario.playerB.id,
          playerBConsentedAt: new Date(),
          matchedAt: new Date(),
        },
      });

      const balanceBAfterAccept = await getPlayerBalance(tx, scenario.playerB.id);
      expect(balanceBAfterAccept.eq(new Decimal("90"))).toBe(true);

      const escrowAfterAccept = await getEscrowBalance(tx, bet.id);
      expect(escrowAfterAccept.eq(new Decimal("20"))).toBe(true);

      const escrowLimitAfterAccept = await getCurrentEscrowLimit(
        tx,
        scenario.escrowLimit.id
      );
      expect(escrowLimitAfterAccept.eq(new Decimal("20"))).toBe(true);

      // ---------------------------------------------------------------
      // 5. Game server reports result -> RESULT_REPORTED
      // ---------------------------------------------------------------
      const { sha256Hash } = await import(
        "../../src/lib/utils/crypto.js"
      );

      const resultIdemKey = `test_result_${bet.id}`;
      const serverResultHash = sha256Hash(
        bet.id + BetOutcome.PLAYER_A_WIN + resultIdemKey
      );

      await tx.bet.update({
        where: { id: bet.id },
        data: {
          status: BetStatus.RESULT_REPORTED,
          outcome: BetOutcome.PLAYER_A_WIN,
          resultReportedAt: new Date(),
          resultIdempotencyKey: resultIdemKey,
          serverResultHash,
        },
      });

      const betAfterResult = await tx.bet.findUniqueOrThrow({
        where: { id: bet.id },
      });
      expect(betAfterResult.status).toBe(BetStatus.RESULT_REPORTED);
      expect(betAfterResult.outcome).toBe(BetOutcome.PLAYER_A_WIN);
      expect(betAfterResult.resultVerified).toBe(false);

      // ---------------------------------------------------------------
      // 6. Player confirms result via widget -> resultVerified = true
      // ---------------------------------------------------------------
      const widgetResultHash = sha256Hash(
        bet.id + BetOutcome.PLAYER_A_WIN
      );

      // Outcomes match, mark verified
      await tx.bet.update({
        where: { id: bet.id },
        data: {
          widgetResultHash,
          resultVerified: true,
        },
      });

      const betAfterVerify = await tx.bet.findUniqueOrThrow({
        where: { id: bet.id },
      });
      expect(betAfterVerify.resultVerified).toBe(true);

      // ---------------------------------------------------------------
      // 7. Run settlement logic directly
      // ---------------------------------------------------------------
      const { collectFee, releaseEscrow, distributeDevShare } =
        await import("../../src/lib/ledger/escrow.js");
      const { getEscrowAccountForBet, getAccountBalance } = await import(
        "../../src/lib/ledger/accounts.js"
      );

      const pot = betAmount.mul(2); // $20
      const feePercent = new Decimal(
        scenario.game.platformFeePercent.toString()
      ); // 0.05
      const feeAmount = pot
        .mul(feePercent)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP); // $1.00
      const winnerPayout = pot.sub(feeAmount); // $19.00

      // Collect fee: escrow -> PLATFORM_REVENUE
      await collectFee(tx, {
        betId: bet.id,
        feeAmount,
        idempotencyKey: `settle_${bet.id}_fee`,
      });

      // Developer revenue share: 2% of fee = $0.02
      const devShareAmount = feeAmount
        .mul(new Decimal(scenario.developerProfile.revSharePercent.toString()))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      if (devShareAmount.gt(0)) {
        await distributeDevShare(tx, {
          developerUserId: scenario.developerUser.id,
          amount: devShareAmount,
          idempotencyKey: `settle_${bet.id}_devshare`,
        });
      }

      // Release winnings to Player A
      await releaseEscrow(tx, {
        betId: bet.id,
        winnerId: scenario.playerA.id,
        amount: winnerPayout,
        idempotencyKey: `settle_${bet.id}_release`,
      });

      // Update bet status
      await tx.bet.update({
        where: { id: bet.id },
        data: {
          status: BetStatus.SETTLED,
          settledAt: new Date(),
          platformFeeAmount: feeAmount,
        },
      });

      // Decrement developer escrow limit
      await tx.$executeRaw`
        UPDATE developer_escrow_limits
        SET current_escrow = GREATEST(current_escrow - ${pot}::decimal, 0),
            updated_at = NOW()
        WHERE id = ${scenario.escrowLimit.id}::uuid
      `;

      // ---------------------------------------------------------------
      // 8. Verify final balances
      // ---------------------------------------------------------------
      const finalBalanceA = await getPlayerBalance(tx, scenario.playerA.id);
      const finalBalanceB = await getPlayerBalance(tx, scenario.playerB.id);
      const finalEscrow = await getEscrowBalance(tx, bet.id);
      const platformRevenue = await getPlatformRevenueBalance(tx);
      const devBalance = await getDeveloperBalance(
        tx,
        scenario.developerUser.id
      );
      const finalEscrowLimit = await getCurrentEscrowLimit(
        tx,
        scenario.escrowLimit.id
      );

      // Player A: started with 100, bet 10, won 19 = 109
      expect(finalBalanceA.eq(new Decimal("109"))).toBe(true);

      // Player B: started with 100, bet 10, lost = 90
      expect(finalBalanceB.eq(new Decimal("90"))).toBe(true);

      // Escrow should be zero
      expect(finalEscrow.eq(0)).toBe(true);

      // Platform revenue = fee - dev share = 1.00 - 0.02 = 0.98
      expect(platformRevenue.eq(new Decimal("0.98"))).toBe(true);

      // Developer balance = devShare = 0.02
      expect(devBalance.eq(new Decimal("0.02"))).toBe(true);

      // Developer escrow limit should be back to 0
      expect(finalEscrowLimit.eq(0)).toBe(true);

      // ---------------------------------------------------------------
      // 9. Run ledger audit
      // ---------------------------------------------------------------
      const { runFullAudit } = await import(
        "../../src/lib/ledger/audit.js"
      );

      const audit = await runFullAudit(tx);

      // All transaction entries should sum to zero (conservation)
      expect(audit.systemConservation.isConserved).toBe(true);
      expect(audit.transactionImbalances.length).toBe(0);

      // Account discrepancies: we expect the STRIPE_SOURCE to have a
      // discrepancy because we primed it with raw SQL. Filter it out.
      const nonStripeDiscrepancies = audit.accountDiscrepancies.filter(
        (d) => d.accountType !== "STRIPE_SOURCE"
      );
      expect(nonStripeDiscrepancies.length).toBe(0);

      // ---------------------------------------------------------------
      // 10. Verify bet final state
      // ---------------------------------------------------------------
      const settledBet = await tx.bet.findUniqueOrThrow({
        where: { id: bet.id },
      });
      expect(settledBet.status).toBe(BetStatus.SETTLED);
      expect(settledBet.outcome).toBe(BetOutcome.PLAYER_A_WIN);
      expect(settledBet.resultVerified).toBe(true);
      expect(settledBet.settledAt).toBeDefined();
      expect(
        new Decimal(settledBet.platformFeeAmount!.toString()).eq(
          new Decimal("1.00")
        )
      ).toBe(true);
    });
  });
});
