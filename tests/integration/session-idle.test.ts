// =============================================================================
// Integration Tests: login sessions time out when left idle
// =============================================================================

import { describe, it, expect, afterAll } from "vitest";
import { createTestSession, createTestUser, disconnectTestPrisma, getTestPrisma } from "./helpers.js";
import {
  cleanExpiredSessions,
  SESSION_IDLE_TIMEOUT_MS,
  validateSession,
} from "../../src/lib/auth/session.js";
import { sha256Hash } from "../../src/lib/utils/crypto.js";

const prisma = getTestPrisma();

afterAll(async () => {
  await disconnectTestPrisma();
});

async function idleFor(sessionToken: string, ms: number) {
  await prisma.session.update({
    where: { tokenHash: sha256Hash(sessionToken) },
    data: { lastSeenAt: new Date(Date.now() - ms) },
  });
}

describe("session idle timeout", () => {
  it("keeps a recently used session and refreshes its last-seen time", async () => {
    const user = await createTestUser(prisma as never);
    const { sessionToken } = await createTestSession(prisma as never, user.id);
    await idleFor(sessionToken, 5 * 60 * 1000);

    expect(await validateSession(sessionToken)).not.toBeNull();
    const row = await prisma.session.findUniqueOrThrow({ where: { tokenHash: sha256Hash(sessionToken) } });
    expect(Date.now() - row.lastSeenAt.getTime()).toBeLessThan(10_000);
  });

  it("signs out a session left idle past the timeout", async () => {
    const user = await createTestUser(prisma as never);
    const { sessionToken } = await createTestSession(prisma as never, user.id);
    await idleFor(sessionToken, SESSION_IDLE_TIMEOUT_MS + 60_000);

    expect(await validateSession(sessionToken)).toBeNull();
  });

  it("cleanup removes idle sessions and leaves active ones", async () => {
    const user = await createTestUser(prisma as never);
    const idle = await createTestSession(prisma as never, user.id);
    const active = await createTestSession(prisma as never, user.id);
    await idleFor(idle.sessionToken, SESSION_IDLE_TIMEOUT_MS + 60_000);

    await cleanExpiredSessions();

    const left = await prisma.session.findMany({ where: { userId: user.id } });
    expect(left.map((session) => session.tokenHash)).toEqual([sha256Hash(active.sessionToken)]);
  });
});
