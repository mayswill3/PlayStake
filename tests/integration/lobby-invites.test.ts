// =============================================================================
// Integration Tests: Challenge inbox (GET /api/lobby/invites) + Accept handoff
// =============================================================================
// Proves the notification surface: a challenge-created INVITED entry surfaces to
// the challenged Player B via the scoped read, and Accept goes through the
// existing POST /api/lobby/respond (the sole escrow handoff — this feature adds
// no money-path code). Committed writes + explicit teardown, same as the
// challenge suite.
// =============================================================================

import { describe, it, expect, afterEach, afterAll, beforeAll } from "vitest";
import * as crypto from "crypto";
import { Decimal } from "@prisma/client/runtime/client";
import { getTestPrisma, disconnectTestPrisma, createTestSession, callApi } from "./helpers.js";
import { createChallenge } from "../../src/lib/lobby/service.js";
import { LedgerAccountType } from "../../generated/prisma/client.js";
import { dollarsToCents } from "../../src/lib/utils/money.js";

const prisma = getTestPrisma();
const DECLARED_SLUG = "darts-301";
let gameId: string;
const createdUserIds: string[] = [];

beforeAll(async () => {
  const devUser = await prisma.user.upsert({
    where: { email: "invites-test-dev@playstake-test.com" },
    update: {},
    create: {
      email: "invites-test-dev@playstake-test.com",
      role: "DEVELOPER",
      displayName: "Invites Test Dev",
      emailVerified: true,
    },
  });
  const profile = await prisma.developerProfile.upsert({
    where: { userId: devUser.id },
    update: {},
    create: {
      userId: devUser.id,
      companyName: "Invites Test Studio",
      contactEmail: "invites-test-dev@playstake-test.com",
      isApproved: true,
    },
  });
  const game = await prisma.game.upsert({
    where: { slug: DECLARED_SLUG },
    update: {},
    create: {
      developerProfileId: profile.id,
      name: "Darts 301",
      slug: DECLARED_SLUG,
      isActive: true,
      platformFeePercent: 0,
    },
  });
  gameId = game.id;
});

afterEach(async () => {
  if (createdUserIds.length === 0) return;
  const bets = await prisma.bet.findMany({
    where: {
      OR: [{ playerAId: { in: createdUserIds } }, { playerBId: { in: createdUserIds } }],
    },
    select: { id: true },
  });
  const betIds = bets.map((b) => b.id);
  await prisma.ledgerEntry.deleteMany({
    where: {
      OR: [
        { ledgerAccount: { userId: { in: createdUserIds } } },
        { ledgerAccount: { betId: { in: betIds } } },
      ],
    },
  });
  await prisma.transaction.deleteMany({ where: { betId: { in: betIds } } });
  await prisma.ledgerAccount.deleteMany({
    where: { OR: [{ userId: { in: createdUserIds } }, { betId: { in: betIds } }] },
  });
  await prisma.lobbyEntry.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.kickAccount.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.bet.deleteMany({ where: { id: { in: betIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  createdUserIds.length = 0;
});

afterAll(async () => {
  await disconnectTestPrisma();
});

async function makeUser(displayName: string): Promise<{ id: string }> {
  const uid = crypto.randomUUID().substring(0, 8);
  const user = await prisma.user.create({
    data: {
      email: `invites-${uid}@playstake-test.com`,
      displayName,
      role: "PLAYER",
      emailVerified: true,
    },
  });
  createdUserIds.push(user.id);
  return { id: user.id };
}

async function fundUser(userId: string, dollars: number): Promise<void> {
  await prisma.ledgerAccount.create({
    data: {
      userId,
      accountType: LedgerAccountType.PLAYER_BALANCE,
      balance: new Decimal(dollars),
      currency: "USD",
    },
  });
}

async function balanceCents(userId: string): Promise<number> {
  const account = await prisma.ledgerAccount.findUnique({
    where: { userId_accountType: { userId, accountType: LedgerAccountType.PLAYER_BALANCE } },
    select: { balance: true },
  });
  return account ? dollarsToCents(account.balance) : 0;
}

async function makeLiveStreamer(slug: string): Promise<{ id: string }> {
  const streamer = await makeUser("Streamer");
  await prisma.kickAccount.create({
    data: {
      userId: streamer.id,
      kickUserId: `kick-${crypto.randomUUID()}`,
      channelSlug: slug,
      displayName: "Streamer",
      accessTokenEnc: "enc",
      refreshTokenEnc: "enc",
      tokenExpiresAt: new Date(Date.now() + 3_600_000),
      scope: "user:read",
      isLive: true,
      declaredGameId: gameId,
    },
  });
  return { id: streamer.id };
}

async function sessionFor(userId: string): Promise<string> {
  const { sessionToken } = await createTestSession(prisma as never, userId);
  return sessionToken;
}

describe("Challenge inbox", () => {
  it("surfaces an incoming challenge to the challenged Player B via GET /api/lobby/invites", async () => {
    const slug = `inbox-${crypto.randomUUID().substring(0, 8)}`;
    const streamer = await makeLiveStreamer(slug);
    const viewer = await makeUser("Viewer");
    await fundUser(viewer.id, 50);

    const challenge = await createChallenge({
      challengerUserId: viewer.id,
      streamerChannelSlug: slug,
      stakeAmount: 500,
    });

    const streamerToken = await sessionFor(streamer.id);
    const res = await callApi("GET", "/api/lobby/invites", { sessionToken: streamerToken });

    expect(res.status).toBe(200);
    expect(typeof res.body.sseEnabled).toBe("boolean");
    expect(res.body.invites).toHaveLength(1);
    const invite = res.body.invites[0];
    expect(invite.lobbyEntryId).toBe(challenge.streamerLobbyEntryId);
    expect(invite.gameType).toBe("darts");
    expect(invite.gameName).toBe("Darts 301");
    expect(invite.stakeAmount).toBe(500);
    expect(invite.from.userId).toBe(viewer.id);
    expect(invite.from.displayName).toBe("Viewer");

    // The challenger does NOT see it as an incoming invite (they're Player A).
    const viewerToken = await sessionFor(viewer.id);
    const viewerRes = await callApi("GET", "/api/lobby/invites", { sessionToken: viewerToken });
    expect(viewerRes.body.invites).toHaveLength(0);
  });

  it("Accept routes through POST /api/lobby/respond and escrows both players", async () => {
    const STAKE = 500;
    const slug = `accept-${crypto.randomUUID().substring(0, 8)}`;
    const streamer = await makeLiveStreamer(slug);
    const viewer = await makeUser("Viewer");
    await fundUser(viewer.id, 50);
    await fundUser(streamer.id, 50);

    const challenge = await createChallenge({
      challengerUserId: viewer.id,
      streamerChannelSlug: slug,
      stakeAmount: STAKE,
    });

    const streamerToken = await sessionFor(streamer.id);
    const res = await callApi("POST", "/api/lobby/respond", {
      sessionToken: streamerToken,
      body: { lobbyEntryId: challenge.streamerLobbyEntryId, response: "ACCEPT" },
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("MATCHED");

    // Escrow handoff really ran (via the existing route): both balances dropped.
    expect(await balanceCents(viewer.id)).toBe(5000 - STAKE);
    expect(await balanceCents(streamer.id)).toBe(5000 - STAKE);

    // Invite is consumed — inbox is now empty for the streamer.
    const inbox = await callApi("GET", "/api/lobby/invites", { sessionToken: streamerToken });
    expect(inbox.body.invites).toHaveLength(0);
  });

  it("a declined challenge no longer surfaces in the inbox", async () => {
    const slug = `decline-${crypto.randomUUID().substring(0, 8)}`;
    const streamer = await makeLiveStreamer(slug);
    const viewer = await makeUser("Viewer");
    await fundUser(viewer.id, 50);

    const challenge = await createChallenge({
      challengerUserId: viewer.id,
      streamerChannelSlug: slug,
      stakeAmount: 500,
    });

    const streamerToken = await sessionFor(streamer.id);
    const declined = await callApi("POST", "/api/lobby/respond", {
      sessionToken: streamerToken,
      body: { lobbyEntryId: challenge.streamerLobbyEntryId, response: "DECLINE" },
    });
    expect(declined.status).toBe(200);

    const inbox = await callApi("GET", "/api/lobby/invites", { sessionToken: streamerToken });
    expect(inbox.body.invites).toHaveLength(0);
  });
});
