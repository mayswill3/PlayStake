import { describe, it, expect, afterAll } from "vitest";
import {
  getTestPrisma,
  disconnectTestPrisma,
} from "../ledger/helpers.js";
import {
  generateApiKey,
  validateApiKey,
  revokeApiKey,
  listApiKeys,
} from "../../../src/lib/auth/api-key.js";
import { sha256Hash } from "../../../src/lib/utils/crypto.js";

afterAll(async () => {
  await disconnectTestPrisma();
});

// Helper to create a developer user + profile for API key tests
async function createTestDeveloper() {
  const prisma = getTestPrisma();
  const user = await prisma.user.create({
    data: {
      email: `apikey-dev-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      passwordHash: "fakehash",
      role: "DEVELOPER",
      displayName: "ApiKeyTestDev",
      emailVerified: true,
    },
  });

  const profile = await prisma.developerProfile.create({
    data: {
      userId: user.id,
      companyName: "Test Studio",
      contactEmail: user.email,
      isApproved: true,
    },
  });

  return { user, profile, prisma };
}

async function cleanupDeveloper(
  prisma: ReturnType<typeof getTestPrisma>,
  profileId: string,
  userId: string
) {
  await prisma.apiKey.deleteMany({
    where: { developerProfileId: profileId },
  });
  await prisma.developerProfile.delete({ where: { id: profileId } });
  await prisma.user.delete({ where: { id: userId } });
}

describe("API key management", () => {
  it("generates an API key with the correct format", async () => {
    const { user, profile, prisma } = await createTestDeveloper();

    try {
      const result = await generateApiKey(profile.id, "Test Key", [
        "bet:create",
        "bet:read",
      ]);

      expect(result.key).toMatch(/^ps_live_/);
      expect(result.key.length).toBeGreaterThan(10);
      expect(result.keyPrefix).toMatch(/^ps_live_/);
      expect(result.keyPrefix.length).toBe(8); // VarChar(8) DB constraint
      expect(result.id).toBeDefined();

      // Verify only the hash is stored, not the raw key
      const stored = await prisma.apiKey.findUnique({
        where: { id: result.id },
      });
      expect(stored).not.toBeNull();
      expect(stored!.keyHash).toBe(sha256Hash(result.key));
      expect(stored!.keyHash).not.toBe(result.key);
    } finally {
      await cleanupDeveloper(prisma, profile.id, user.id);
    }
  });

  it("validates a correct API key and returns developer info", async () => {
    const { user, profile, prisma } = await createTestDeveloper();

    try {
      const { key } = await generateApiKey(profile.id, "Validate Key", [
        "bet:create",
        "result:report",
      ]);

      const result = await validateApiKey(key);

      expect(result).not.toBeNull();
      expect(result!.developerProfileId).toBe(profile.id);
      expect(result!.permissions).toContain("bet:create");
      expect(result!.permissions).toContain("result:report");
      expect(result!.keyId).toBeDefined();
    } finally {
      await cleanupDeveloper(prisma, profile.id, user.id);
    }
  });

  it("returns null for an invalid API key", async () => {
    const result = await validateApiKey("ps_live_totallyinvalidkeyhere");
    expect(result).toBeNull();
  });

  it("returns null for a revoked API key", async () => {
    const { user, profile, prisma } = await createTestDeveloper();

    try {
      const { id, key } = await generateApiKey(
        profile.id,
        "Revoke Key",
        ["bet:create"]
      );

      // Revoke the key
      await revokeApiKey(id, profile.id);

      // Validate should now return null
      const result = await validateApiKey(key);
      expect(result).toBeNull();
    } finally {
      await cleanupDeveloper(prisma, profile.id, user.id);
    }
  });

  it("prevents revoking another developer's key", async () => {
    const dev1 = await createTestDeveloper();
    const dev2 = await createTestDeveloper();

    try {
      const { id: keyId } = await generateApiKey(
        dev1.profile.id,
        "Dev1 Key",
        ["bet:create"]
      );

      // Dev2 tries to revoke Dev1's key
      await expect(
        revokeApiKey(keyId, dev2.profile.id)
      ).rejects.toThrow("API key does not belong to this developer");
    } finally {
      await cleanupDeveloper(dev1.prisma, dev1.profile.id, dev1.user.id);
      await cleanupDeveloper(dev2.prisma, dev2.profile.id, dev2.user.id);
    }
  });

  it("lists API keys without exposing the full key", async () => {
    const { user, profile, prisma } = await createTestDeveloper();

    try {
      await generateApiKey(profile.id, "Key A", ["bet:create"]);
      await generateApiKey(profile.id, "Key B", ["bet:read", "result:report"]);

      const keys = await listApiKeys(profile.id);

      expect(keys).toHaveLength(2);

      for (const key of keys) {
        expect(key.id).toBeDefined();
        expect(key.keyPrefix).toMatch(/^ps_live_/);
        expect(key.label).toBeDefined();
        expect(key.permissions).toBeDefined();
        expect(key.createdAt).toBeInstanceOf(Date);
        expect(key.isActive).toBe(true);

        // Ensure the full key or hash is NOT in the response
        expect((key as any).keyHash).toBeUndefined();
        expect((key as any).key).toBeUndefined();
      }
    } finally {
      await cleanupDeveloper(prisma, profile.id, user.id);
    }
  });

  it("returns null for expired API key", async () => {
    const { user, profile, prisma } = await createTestDeveloper();

    try {
      const { id, key } = await generateApiKey(
        profile.id,
        "Expired Key",
        ["bet:create"]
      );

      // Manually set expiry to the past
      await prisma.apiKey.update({
        where: { id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const result = await validateApiKey(key);
      expect(result).toBeNull();
    } finally {
      await cleanupDeveloper(prisma, profile.id, user.id);
    }
  });
});
