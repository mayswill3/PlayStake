// =============================================================================
// Integration Tests: Developer Portal
// =============================================================================
// Tests developer registration, game creation, API key lifecycle, and analytics.
// =============================================================================

import { describe, it, expect, afterAll } from "vitest";
import {
  withRollback,
  callApi,
  createTestUser,
  createTestSession,
  createTestDeveloperProfile,
  createTestGame,
  createTestApiKey,
  createSystemAccounts,
  disconnectTestPrisma,
} from "./helpers.js";

afterAll(async () => {
  await disconnectTestPrisma();
});

describe("Developer Portal: Registration", () => {
  it("should register as developer, creating DeveloperProfile and EscrowLimit", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx, { role: "PLAYER" });
      const session = await createTestSession(tx, user.id);

      // Use the route handler directly
      const res = await callApi("POST", "/api/developer/register", {
        sessionToken: session.sessionToken,
        body: {
          companyName: "Test Studio",
          contactEmail: "test@studio.com",
        },
      });

      expect(res.status).toBe(201);
      expect(res.body.developerProfileId).toBeDefined();
      expect(res.body.isApproved).toBe(false);

      // Verify in DB
      const profile = await tx.developerProfile.findUnique({
        where: { userId: user.id },
        include: { escrowLimit: true },
      });

      expect(profile).toBeDefined();
      expect(profile!.companyName).toBe("Test Studio");
      expect(profile!.escrowLimit).toBeDefined();
      expect(Number(profile!.escrowLimit!.maxTotalEscrow)).toBe(50000);

      // User role should be upgraded to DEVELOPER
      const updatedUser = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(updatedUser.role).toBe("DEVELOPER");
    });
  });

  it("should reject duplicate developer registration", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx, { role: "PLAYER" });
      const session = await createTestSession(tx, user.id);

      // First registration
      const res1 = await callApi("POST", "/api/developer/register", {
        sessionToken: session.sessionToken,
        body: {
          companyName: "Studio A",
          contactEmail: "a@studio.com",
        },
      });
      expect(res1.status).toBe(201);

      // Second registration should fail
      const res2 = await callApi("POST", "/api/developer/register", {
        sessionToken: session.sessionToken,
        body: {
          companyName: "Studio B",
          contactEmail: "b@studio.com",
        },
      });
      expect(res2.status).toBe(409);
    });
  });
});

describe("Developer Portal: Game Registration", () => {
  it("should create a game with generated webhookSecret", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx, { role: "DEVELOPER" });
      const { developerProfile } = await createTestDeveloperProfile(
        tx,
        user.id
      );
      const session = await createTestSession(tx, user.id);

      const slug = `test-game-${Date.now()}`;
      const res = await callApi("POST", "/api/developer/games", {
        sessionToken: session.sessionToken,
        body: {
          name: "Test Arena",
          slug,
          description: "A test game",
          minBetAmount: 100,
          maxBetAmount: 50000,
        },
      });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.slug).toBe(slug);
      expect(res.body.webhookSecret).toBeDefined();
      expect(res.body.webhookSecret).toMatch(/^whsec_/);

      // Verify in DB
      const game = await tx.game.findUnique({
        where: { slug },
      });
      expect(game).toBeDefined();
      expect(game!.developerProfileId).toBe(developerProfile.id);
      expect(game!.webhookSecret).toBeDefined();
    });
  });

  it("should list developer's games", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx, { role: "DEVELOPER" });
      const { developerProfile } = await createTestDeveloperProfile(
        tx,
        user.id
      );
      const session = await createTestSession(tx, user.id);

      // Create two games
      await createTestGame(tx, developerProfile.id, { name: "Game 1" });
      await createTestGame(tx, developerProfile.id, { name: "Game 2" });

      const res = await callApi("GET", "/api/developer/games", {
        sessionToken: session.sessionToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe("Developer Portal: API Keys", () => {
  it("should generate an API key with raw key returned once", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx, { role: "DEVELOPER" });
      const { developerProfile } = await createTestDeveloperProfile(
        tx,
        user.id
      );
      const session = await createTestSession(tx, user.id);

      const res = await callApi("POST", "/api/developer/api-keys", {
        sessionToken: session.sessionToken,
        body: {
          label: "Production Server",
          permissions: ["bet:create", "bet:read", "result:report"],
        },
      });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.key).toBeDefined();
      expect(res.body.key).toMatch(/^ps_live_/);
      expect(res.body.label).toBe("Production Server");
      expect(res.body.permissions).toEqual(
        expect.arrayContaining(["bet:create", "bet:read", "result:report"])
      );

      // Verify the key validates correctly
      const { validateApiKey } = await import(
        "../../src/lib/auth/api-key.js"
      );
      const validation = await validateApiKey(res.body.key);
      expect(validation).toBeDefined();
      expect(validation!.developerProfileId).toBe(developerProfile.id);
    });
  });

  it("should revoke an API key so it no longer validates", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx, { role: "DEVELOPER" });
      const { developerProfile } = await createTestDeveloperProfile(
        tx,
        user.id
      );
      const session = await createTestSession(tx, user.id);
      const apiKey = await createTestApiKey(tx, developerProfile.id);

      // Verify key works before revocation
      const { validateApiKey } = await import(
        "../../src/lib/auth/api-key.js"
      );
      const validBefore = await validateApiKey(apiKey.rawKey);
      expect(validBefore).toBeDefined();

      // Revoke via API route
      const res = await callApi(
        "DELETE",
        `/api/developer/api-keys/${apiKey.id}`,
        {
          sessionToken: session.sessionToken,
        }
      );

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      // Verify key no longer validates
      const validAfter = await validateApiKey(apiKey.rawKey);
      expect(validAfter).toBeNull();
    });
  });

  it("should list API keys without exposing the full key", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx, { role: "DEVELOPER" });
      const { developerProfile } = await createTestDeveloperProfile(
        tx,
        user.id
      );
      const session = await createTestSession(tx, user.id);

      await createTestApiKey(tx, developerProfile.id, {
        label: "Key One",
      });
      await createTestApiKey(tx, developerProfile.id, {
        label: "Key Two",
      });

      const res = await callApi("GET", "/api/developer/api-keys", {
        sessionToken: session.sessionToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);

      // Verify no full keys are exposed
      for (const key of res.body.data) {
        expect(key.id).toBeDefined();
        expect(key.keyPrefix).toBeDefined();
        expect(key.label).toBeDefined();
        // Full key should NOT be in the response
        expect(key.key).toBeUndefined();
        expect(key.keyHash).toBeUndefined();
      }
    });
  });
});

describe("Developer Portal: Analytics", () => {
  it("should return correct aggregations", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx, { role: "DEVELOPER" });
      const { developerProfile } = await createTestDeveloperProfile(
        tx,
        user.id
      );
      const session = await createTestSession(tx, user.id);
      const game = await createTestGame(tx, developerProfile.id);
      const systemAccounts = await createSystemAccounts(tx);

      // Create some bets to aggregate
      const playerA = await createTestUser(tx);
      const playerB = await createTestUser(tx);

      // A settled bet
      await tx.bet.create({
        data: {
          gameId: game.id,
          playerAId: playerA.id,
          playerBId: playerB.id,
          amount: 25.0,
          currency: "USD",
          status: "SETTLED",
          outcome: "PLAYER_A_WIN",
          platformFeePercent: 0.05,
          expiresAt: new Date(Date.now() + 300_000),
          matchedAt: new Date(),
          settledAt: new Date(),
        },
      });

      // An active bet
      await tx.bet.create({
        data: {
          gameId: game.id,
          playerAId: playerA.id,
          amount: 10.0,
          currency: "USD",
          status: "MATCHED",
          platformFeePercent: 0.05,
          expiresAt: new Date(Date.now() + 300_000),
          matchedAt: new Date(),
          playerBId: playerB.id,
        },
      });

      const res = await callApi("GET", "/api/developer/analytics", {
        sessionToken: session.sessionToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.totalBets).toBeGreaterThanOrEqual(2);
      expect(res.body.activeBets).toBeGreaterThanOrEqual(1);
      expect(res.body.totalVolume).toBeGreaterThanOrEqual(2500); // At least 1 settled bet at $25 = 2500 cents
      expect(res.body.periodStart).toBeDefined();
      expect(res.body.periodEnd).toBeDefined();
    });
  });
});
