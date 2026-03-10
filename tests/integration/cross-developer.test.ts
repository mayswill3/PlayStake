// =============================================================================
// Integration Tests: Cross-Developer Authorization
// =============================================================================
// Verifies that Developer A cannot interact with Developer B's resources.
// =============================================================================

import { describe, it, expect, afterAll } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";
import { BetStatus } from "../../generated/prisma/client.js";
import {
  withRollback,
  createTestUser,
  createTestDeveloperProfile,
  createTestGame,
  createTestApiKey,
  createSystemAccounts,
  fundPlayer,
  disconnectTestPrisma,
} from "./helpers.js";

afterAll(async () => {
  await disconnectTestPrisma();
});

describe("Cross-Developer Authorization", () => {
  it("Developer A cannot list Developer B's bets via verifyDeveloperOwnsGame", async () => {
    await withRollback(async (tx) => {
      const systemAccounts = await createSystemAccounts(tx);

      // Developer A
      const devUserA = await createTestUser(tx, { role: "DEVELOPER" });
      const { developerProfile: profileA } =
        await createTestDeveloperProfile(tx, devUserA.id);
      const gameA = await createTestGame(tx, profileA.id);
      const apiKeyA = await createTestApiKey(tx, profileA.id);

      // Developer B
      const devUserB = await createTestUser(tx, { role: "DEVELOPER" });
      const { developerProfile: profileB } =
        await createTestDeveloperProfile(tx, devUserB.id);
      const gameB = await createTestGame(tx, profileB.id);
      const apiKeyB = await createTestApiKey(tx, profileB.id);

      // Create a player and bet in game B
      const player = await createTestUser(tx);
      await fundPlayer(
        tx,
        player.id,
        systemAccounts.stripeSource.id,
        100
      );

      const bet = await tx.bet.create({
        data: {
          gameId: gameB.id,
          playerAId: player.id,
          amount: new Decimal("10.00"),
          currency: "USD",
          status: BetStatus.OPEN,
          platformFeePercent: 0.05,
          expiresAt: new Date(Date.now() + 300_000),
          playerAConsentedAt: new Date(),
        },
      });

      // Developer A tries to access game B -- verifyDeveloperOwnsGame should throw
      const { verifyDeveloperOwnsGame, verifyDeveloperOwnsBet } =
        await import("../../src/lib/auth/dev-api.js");

      await expect(
        verifyDeveloperOwnsGame(profileA.id, gameB.id)
      ).rejects.toThrow("Game does not belong to this developer");
    });
  });

  it("Developer A cannot report results on Developer B's bets", async () => {
    await withRollback(async (tx) => {
      const systemAccounts = await createSystemAccounts(tx);

      // Developer A
      const devUserA = await createTestUser(tx, { role: "DEVELOPER" });
      const { developerProfile: profileA } =
        await createTestDeveloperProfile(tx, devUserA.id);
      const apiKeyA = await createTestApiKey(tx, profileA.id);

      // Developer B
      const devUserB = await createTestUser(tx, { role: "DEVELOPER" });
      const { developerProfile: profileB } =
        await createTestDeveloperProfile(tx, devUserB.id);
      const gameB = await createTestGame(tx, profileB.id);

      // Create a bet in Developer B's game
      const player = await createTestUser(tx);
      const bet = await tx.bet.create({
        data: {
          gameId: gameB.id,
          playerAId: player.id,
          amount: new Decimal("10.00"),
          currency: "USD",
          status: BetStatus.MATCHED,
          platformFeePercent: 0.05,
          expiresAt: new Date(Date.now() + 300_000),
          playerBId: (await createTestUser(tx)).id,
          matchedAt: new Date(),
        },
      });

      // Developer A tries to verify ownership of this bet
      const { verifyDeveloperOwnsBet } = await import(
        "../../src/lib/auth/dev-api.js"
      );

      await expect(
        verifyDeveloperOwnsBet(profileA.id, bet.id)
      ).rejects.toThrow(
        "Bet does not belong to a game owned by this developer"
      );
    });
  });

  it("Developer A cannot cancel Developer B's bets", async () => {
    await withRollback(async (tx) => {
      const systemAccounts = await createSystemAccounts(tx);

      // Developer A
      const devUserA = await createTestUser(tx, { role: "DEVELOPER" });
      const { developerProfile: profileA } =
        await createTestDeveloperProfile(tx, devUserA.id);

      // Developer B
      const devUserB = await createTestUser(tx, { role: "DEVELOPER" });
      const { developerProfile: profileB } =
        await createTestDeveloperProfile(tx, devUserB.id);
      const gameB = await createTestGame(tx, profileB.id);

      const player = await createTestUser(tx);
      const bet = await tx.bet.create({
        data: {
          gameId: gameB.id,
          playerAId: player.id,
          amount: new Decimal("10.00"),
          currency: "USD",
          status: BetStatus.OPEN,
          platformFeePercent: 0.05,
          expiresAt: new Date(Date.now() + 300_000),
          playerAConsentedAt: new Date(),
        },
      });

      // Developer A tries to verify ownership for cancellation
      const { verifyDeveloperOwnsBet } = await import(
        "../../src/lib/auth/dev-api.js"
      );

      await expect(
        verifyDeveloperOwnsBet(profileA.id, bet.id)
      ).rejects.toThrow(
        "Bet does not belong to a game owned by this developer"
      );

      // Bet is still OPEN (not cancelled)
      const betAfter = await tx.bet.findUniqueOrThrow({
        where: { id: bet.id },
      });
      expect(betAfter.status).toBe(BetStatus.OPEN);
    });
  });

  it("API key validation matches developer profile", async () => {
    await withRollback(async (tx) => {
      // Developer A
      const devUserA = await createTestUser(tx, { role: "DEVELOPER" });
      const { developerProfile: profileA } =
        await createTestDeveloperProfile(tx, devUserA.id);
      const apiKeyA = await createTestApiKey(tx, profileA.id);

      // Developer B
      const devUserB = await createTestUser(tx, { role: "DEVELOPER" });
      const { developerProfile: profileB } =
        await createTestDeveloperProfile(tx, devUserB.id);
      const apiKeyB = await createTestApiKey(tx, profileB.id);

      // Validate that API key A returns profile A
      const { validateApiKey } = await import(
        "../../src/lib/auth/api-key.js"
      );

      const resultA = await validateApiKey(apiKeyA.rawKey);
      expect(resultA).toBeDefined();
      expect(resultA!.developerProfileId).toBe(profileA.id);

      const resultB = await validateApiKey(apiKeyB.rawKey);
      expect(resultB).toBeDefined();
      expect(resultB!.developerProfileId).toBe(profileB.id);

      // These are different profiles
      expect(resultA!.developerProfileId).not.toBe(
        resultB!.developerProfileId
      );
    });
  });
});
