import { describe, it, expect, afterAll } from "vitest";
import {
  getTestPrisma,
  disconnectTestPrisma,
  withRollback,
  seedTestData,
} from "../ledger/helpers.js";
import {
  createSession,
  validateSession,
  destroySession,
  destroyAllUserSessions,
  cleanExpiredSessions,
} from "../../../src/lib/auth/session.js";
import { sha256Hash } from "../../../src/lib/utils/crypto.js";

// The session module uses the singleton prisma client. For these tests we
// need to ensure it connects to the same database. The test helpers manage
// their own client, but the session module uses the singleton. This is
// acceptable for integration tests against a real database.

afterAll(async () => {
  await disconnectTestPrisma();
});

describe("session management", () => {
  it("creates a session and validates it", async () => {
    await withRollback(async (tx) => {
      const seeds = await seedTestData(tx);

      // Create session (uses singleton prisma, not tx, but we still seed via tx)
      // For a proper integration test we need to work outside the rollback
      // for the session operations since they use the singleton.
    });

    // Integration test: create a real user, session, then clean up
    const prisma = getTestPrisma();
    const user = await prisma.user.create({
      data: {
        email: `session-test-${Date.now()}@test.com`,
        passwordHash: "fakehash",
        role: "PLAYER",
        displayName: "SessionTestUser",
      },
    });

    try {
      const { sessionToken, expiresAt } = await createSession(
        user.id,
        "127.0.0.1",
        "TestAgent/1.0"
      );

      expect(sessionToken).toBeDefined();
      expect(sessionToken.length).toBe(32);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Validate the session
      const result = await validateSession(sessionToken);
      expect(result).not.toBeNull();
      expect(result!.userId).toBe(user.id);
      expect(result!.user.email).toBe(user.email);

      // Verify the token hash is stored, not the raw token
      const storedSession = await prisma.session.findFirst({
        where: { userId: user.id },
      });
      expect(storedSession).not.toBeNull();
      expect(storedSession!.tokenHash).toBe(sha256Hash(sessionToken));
      expect(storedSession!.tokenHash).not.toBe(sessionToken);
    } finally {
      // Clean up
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it("returns null for an invalid token", async () => {
    const result = await validateSession("completely_invalid_token_here");
    expect(result).toBeNull();
  });

  it("destroys a session", async () => {
    const prisma = getTestPrisma();
    const user = await prisma.user.create({
      data: {
        email: `session-destroy-${Date.now()}@test.com`,
        passwordHash: "fakehash",
        role: "PLAYER",
        displayName: "DestroyTestUser",
      },
    });

    try {
      const { sessionToken } = await createSession(user.id);

      // Validate it exists
      const valid = await validateSession(sessionToken);
      expect(valid).not.toBeNull();

      // Destroy it
      await destroySession(sessionToken);

      // Now it should be gone
      const invalid = await validateSession(sessionToken);
      expect(invalid).toBeNull();
    } finally {
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it("destroys all sessions for a user", async () => {
    const prisma = getTestPrisma();
    const user = await prisma.user.create({
      data: {
        email: `session-destroyall-${Date.now()}@test.com`,
        passwordHash: "fakehash",
        role: "PLAYER",
        displayName: "DestroyAllTestUser",
      },
    });

    try {
      // Create multiple sessions
      const s1 = await createSession(user.id);
      const s2 = await createSession(user.id);
      const s3 = await createSession(user.id);

      // All should be valid
      expect(await validateSession(s1.sessionToken)).not.toBeNull();
      expect(await validateSession(s2.sessionToken)).not.toBeNull();
      expect(await validateSession(s3.sessionToken)).not.toBeNull();

      // Destroy all
      await destroyAllUserSessions(user.id);

      // None should be valid
      expect(await validateSession(s1.sessionToken)).toBeNull();
      expect(await validateSession(s2.sessionToken)).toBeNull();
      expect(await validateSession(s3.sessionToken)).toBeNull();
    } finally {
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it("rejects expired sessions", async () => {
    const prisma = getTestPrisma();
    const user = await prisma.user.create({
      data: {
        email: `session-expired-${Date.now()}@test.com`,
        passwordHash: "fakehash",
        role: "PLAYER",
        displayName: "ExpiredTestUser",
      },
    });

    try {
      // Create a session that is already expired
      const tokenHash = sha256Hash("expired_test_token_value");
      await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() - 1000), // 1 second ago
        },
      });

      const result = await validateSession("expired_test_token_value");
      expect(result).toBeNull();
    } finally {
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it("cleans up expired sessions", async () => {
    const prisma = getTestPrisma();
    const user = await prisma.user.create({
      data: {
        email: `session-cleanup-${Date.now()}@test.com`,
        passwordHash: "fakehash",
        role: "PLAYER",
        displayName: "CleanupTestUser",
      },
    });

    try {
      // Create two expired sessions
      await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: sha256Hash("cleanup_token_1"),
          expiresAt: new Date(Date.now() - 60_000),
        },
      });
      await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: sha256Hash("cleanup_token_2"),
          expiresAt: new Date(Date.now() - 60_000),
        },
      });

      // Create one valid session
      await createSession(user.id);

      const count = await cleanExpiredSessions();
      expect(count).toBeGreaterThanOrEqual(2);

      // Valid session should still exist
      const remaining = await prisma.session.count({
        where: { userId: user.id },
      });
      expect(remaining).toBeGreaterThanOrEqual(1);
    } finally {
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
