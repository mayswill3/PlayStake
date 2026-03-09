import { describe, it, expect, afterAll } from "vitest";
import {
  getTestPrisma,
  disconnectTestPrisma,
} from "../ledger/helpers.js";
import {
  generateWidgetToken,
  validateWidgetToken,
  revokeWidgetToken,
} from "../../../src/lib/auth/widget-token.js";
import { sha256Hash } from "../../../src/lib/utils/crypto.js";
import { WidgetSessionStatus } from "../../../generated/prisma/client.js";

afterAll(async () => {
  await disconnectTestPrisma();
});

// Helper to set up a developer + game + player for widget token tests
async function createTestFixtures() {
  const prisma = getTestPrisma();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const player = await prisma.user.create({
    data: {
      email: `widget-player-${suffix}@test.com`,
      passwordHash: "fakehash",
      role: "PLAYER",
      displayName: "WidgetPlayer",
      emailVerified: true,
    },
  });

  const devUser = await prisma.user.create({
    data: {
      email: `widget-dev-${suffix}@test.com`,
      passwordHash: "fakehash",
      role: "DEVELOPER",
      displayName: "WidgetDev",
      emailVerified: true,
    },
  });

  const devProfile = await prisma.developerProfile.create({
    data: {
      userId: devUser.id,
      companyName: "Widget Studio",
      contactEmail: devUser.email,
      isApproved: true,
    },
  });

  const game = await prisma.game.create({
    data: {
      developerProfileId: devProfile.id,
      name: "Widget Game",
      slug: `widget-game-${suffix}`,
      isActive: true,
      minBetAmount: 1,
      maxBetAmount: 500,
      platformFeePercent: 0.05,
    },
  });

  return { player, devUser, devProfile, game, prisma };
}

async function cleanupFixtures(
  prisma: ReturnType<typeof getTestPrisma>,
  fixtures: Awaited<ReturnType<typeof createTestFixtures>>
) {
  await prisma.widgetSession.deleteMany({
    where: { userId: fixtures.player.id },
  });
  await prisma.game.delete({ where: { id: fixtures.game.id } });
  await prisma.developerProfile.delete({
    where: { id: fixtures.devProfile.id },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [fixtures.player.id, fixtures.devUser.id] } },
  });
}

describe("widget token management", () => {
  it("generates a widget token with correct format", async () => {
    const fixtures = await createTestFixtures();

    try {
      const result = await generateWidgetToken(
        fixtures.game.id,
        fixtures.player.id,
        fixtures.devProfile.id
      );

      expect(result.widgetToken).toMatch(/^wt_/);
      expect(result.widgetToken.length).toBeGreaterThan(5);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Expiry should be approximately 1 hour from now
      const oneHourMs = 60 * 60 * 1000;
      const diff = result.expiresAt.getTime() - Date.now();
      expect(diff).toBeGreaterThan(oneHourMs - 5000);
      expect(diff).toBeLessThanOrEqual(oneHourMs + 1000);
    } finally {
      await cleanupFixtures(fixtures.prisma, fixtures);
    }
  });

  it("validates a correct widget token", async () => {
    const fixtures = await createTestFixtures();

    try {
      const { widgetToken } = await generateWidgetToken(
        fixtures.game.id,
        fixtures.player.id,
        fixtures.devProfile.id
      );

      const result = await validateWidgetToken(widgetToken);

      expect(result).not.toBeNull();
      expect(result!.userId).toBe(fixtures.player.id);
      expect(result!.gameId).toBe(fixtures.game.id);
    } finally {
      await cleanupFixtures(fixtures.prisma, fixtures);
    }
  });

  it("returns null for an invalid token", async () => {
    const result = await validateWidgetToken("wt_totally_invalid_token");
    expect(result).toBeNull();
  });

  it("stores only the hash, not the raw token", async () => {
    const fixtures = await createTestFixtures();

    try {
      const { widgetToken } = await generateWidgetToken(
        fixtures.game.id,
        fixtures.player.id,
        fixtures.devProfile.id
      );

      const stored = await fixtures.prisma.widgetSession.findFirst({
        where: { userId: fixtures.player.id, gameId: fixtures.game.id },
        orderBy: { createdAt: "desc" },
      });

      expect(stored).not.toBeNull();
      expect(stored!.tokenHash).toBe(sha256Hash(widgetToken));
      expect(stored!.tokenHash).not.toBe(widgetToken);
    } finally {
      await cleanupFixtures(fixtures.prisma, fixtures);
    }
  });

  it("revokes previous token when generating a new one for same game+player", async () => {
    const fixtures = await createTestFixtures();

    try {
      const first = await generateWidgetToken(
        fixtures.game.id,
        fixtures.player.id,
        fixtures.devProfile.id
      );

      const second = await generateWidgetToken(
        fixtures.game.id,
        fixtures.player.id,
        fixtures.devProfile.id
      );

      // First token should be revoked
      const firstResult = await validateWidgetToken(first.widgetToken);
      expect(firstResult).toBeNull();

      // Second token should be valid
      const secondResult = await validateWidgetToken(second.widgetToken);
      expect(secondResult).not.toBeNull();
      expect(secondResult!.userId).toBe(fixtures.player.id);
    } finally {
      await cleanupFixtures(fixtures.prisma, fixtures);
    }
  });

  it("rejects token generation when game does not belong to developer", async () => {
    const fixtures = await createTestFixtures();

    // Create a second developer
    const suffix = `${Date.now()}-other`;
    const otherDevUser = await fixtures.prisma.user.create({
      data: {
        email: `widget-otherdev-${suffix}@test.com`,
        passwordHash: "fakehash",
        role: "DEVELOPER",
        displayName: "OtherDev",
        emailVerified: true,
      },
    });
    const otherProfile = await fixtures.prisma.developerProfile.create({
      data: {
        userId: otherDevUser.id,
        companyName: "Other Studio",
        contactEmail: otherDevUser.email,
        isApproved: true,
      },
    });

    try {
      await expect(
        generateWidgetToken(
          fixtures.game.id,
          fixtures.player.id,
          otherProfile.id // Wrong developer
        )
      ).rejects.toThrow("Game does not belong to this developer");
    } finally {
      await fixtures.prisma.developerProfile.delete({
        where: { id: otherProfile.id },
      });
      await fixtures.prisma.user.delete({ where: { id: otherDevUser.id } });
      await cleanupFixtures(fixtures.prisma, fixtures);
    }
  });

  it("rejects token generation for non-existent player", async () => {
    const fixtures = await createTestFixtures();

    try {
      await expect(
        generateWidgetToken(
          fixtures.game.id,
          "00000000-0000-0000-0000-000000000000",
          fixtures.devProfile.id
        )
      ).rejects.toThrow("Player not found");
    } finally {
      await cleanupFixtures(fixtures.prisma, fixtures);
    }
  });

  it("revokes a widget token by hash", async () => {
    const fixtures = await createTestFixtures();

    try {
      const { widgetToken } = await generateWidgetToken(
        fixtures.game.id,
        fixtures.player.id,
        fixtures.devProfile.id
      );

      const tokenHash = sha256Hash(widgetToken);
      await revokeWidgetToken(tokenHash);

      const result = await validateWidgetToken(widgetToken);
      expect(result).toBeNull();
    } finally {
      await cleanupFixtures(fixtures.prisma, fixtures);
    }
  });

  it("returns null for expired widget token", async () => {
    const fixtures = await createTestFixtures();

    try {
      const { widgetToken } = await generateWidgetToken(
        fixtures.game.id,
        fixtures.player.id,
        fixtures.devProfile.id
      );

      // Manually expire it
      const tokenHash = sha256Hash(widgetToken);
      await fixtures.prisma.widgetSession.update({
        where: { tokenHash },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const result = await validateWidgetToken(widgetToken);
      expect(result).toBeNull();
    } finally {
      await cleanupFixtures(fixtures.prisma, fixtures);
    }
  });
});
