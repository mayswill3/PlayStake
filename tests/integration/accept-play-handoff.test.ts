// =============================================================================
// Integration Tests: Accept -> play handoff + no-show void
// =============================================================================
// After a challenge is accepted (bet MATCHED, both escrowed), BOTH players must
// be routable into the same game session, and a no-show must resolve safely
// (bet voided, both refunded, no locked funds). Committed writes + teardown.
// =============================================================================

import { describe, it, expect, afterEach, afterAll, beforeAll } from "vitest";
import * as crypto from "crypto";
import { Decimal } from "@prisma/client/runtime/client";
import { getTestPrisma, disconnectTestPrisma, createTestSession, callApi } from "./helpers.js";
import { createChallenge } from "../../src/lib/lobby/service.js";
import { voidNoShowMatch } from "../../src/lib/lobby/match-lifecycle.js";
import { LedgerAccountType, BetStatus } from "../../generated/prisma/client.js";
import { dollarsToCents } from "../../src/lib/utils/money.js";

const prisma = getTestPrisma();
const DECLARED_SLUG = "darts-301";
let gameId: string;
const createdUserIds: string[] = [];

beforeAll(async () => {
  const devUser = await prisma.user.upsert({
    where: { email: "handoff-test-dev@playstake-test.com" },
    update: {},
    create: {
      email: "handoff-test-dev@playstake-test.com",
      role: "DEVELOPER",
      displayName: "Handoff Test Dev",
      emailVerified: true,
    },
  });
  const profile = await prisma.developerProfile.upsert({
    where: { userId: devUser.id },
    update: {},
    create: {
      userId: devUser.id,
      companyName: "Handoff Test Studio",
      contactEmail: "handoff-test-dev@playstake-test.com",
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
    where: { OR: [{ playerAId: { in: createdUserIds } }, { playerBId: { in: createdUserIds } }] },
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
      email: `handoff-${uid}@playstake-test.com`,
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

/** Set up an accepted (MATCHED) challenge bet between a funded viewer + streamer. */
async function acceptedMatch(stake = 500): Promise<{
  viewerId: string;
  streamerId: string;
  betId: string;
}> {
  const slug = `handoff-${crypto.randomUUID().substring(0, 8)}`;
  const streamer = await makeLiveStreamer(slug);
  const viewer = await makeUser("Viewer");
  await fundUser(viewer.id, 50);
  await fundUser(streamer.id, 50);

  const challenge = await createChallenge({
    challengerUserId: viewer.id,
    streamerChannelSlug: slug,
    stakeAmount: stake,
  });

  const streamerToken = await sessionFor(streamer.id);
  const res = await callApi("POST", "/api/lobby/respond", {
    sessionToken: streamerToken,
    body: { lobbyEntryId: challenge.streamerLobbyEntryId, response: "ACCEPT" },
  });
  expect(res.status).toBe(200);
  expect(res.body.status).toBe("MATCHED");
  return { viewerId: viewer.id, streamerId: streamer.id, betId: res.body.betId };
}

describe("Accept -> play handoff", () => {
  it("surfaces the same joinable match to BOTH players with correct roles", async () => {
    const { viewerId, streamerId, betId } = await acceptedMatch(500);

    // Streamer (accepter) is Player B.
    const streamerToken = await sessionFor(streamerId);
    const sRes = await callApi("GET", "/api/lobby/invites", { sessionToken: streamerToken });
    expect(sRes.status).toBe(200);
    expect(sRes.body.matches).toHaveLength(1);
    const sMatch = sRes.body.matches[0];
    expect(sMatch.betId).toBe(betId);
    expect(sMatch.myRole).toBe("B");
    expect(sMatch.gameType).toBe("darts");
    expect(sMatch.playerAId).toBe(viewerId);
    expect(sMatch.playerBId).toBe(streamerId);
    expect(sMatch.stakeAmount).toBe(500);

    // Challenger (idle) is Player A — same betId, so both route to one session.
    const viewerToken = await sessionFor(viewerId);
    const vRes = await callApi("GET", "/api/lobby/invites", { sessionToken: viewerToken });
    expect(vRes.body.matches).toHaveLength(1);
    const vMatch = vRes.body.matches[0];
    expect(vMatch.betId).toBe(betId);
    expect(vMatch.myRole).toBe("A");
    expect(vMatch.playerAId).toBe(viewerId);
  });
});

describe("No-show void", () => {
  it("voids an unplayed MATCHED bet and refunds BOTH players (no locked funds)", async () => {
    const STAKE = 500;
    const { viewerId, streamerId, betId } = await acceptedMatch(STAKE);

    // Both are escrowed after accept: $50 - $5 = $45 each.
    expect(await balanceCents(viewerId)).toBe(5000 - STAKE);
    expect(await balanceCents(streamerId)).toBe(5000 - STAKE);

    // No-show: run the void (what the bet-expiry worker does past the window).
    const result = await prisma.$transaction((tx) => voidNoShowMatch(tx as never, betId));
    expect(result.voided).toBe(true);

    const bet = await prisma.bet.findUniqueOrThrow({ where: { id: betId } });
    expect(bet.status).toBe(BetStatus.VOIDED);

    // Both fully refunded — no locked funds.
    expect(await balanceCents(viewerId)).toBe(5000);
    expect(await balanceCents(streamerId)).toBe(5000);
    const escrow = await prisma.ledgerAccount.findFirstOrThrow({
      where: { betId, accountType: LedgerAccountType.ESCROW },
      select: { balance: true },
    });
    expect(dollarsToCents(escrow.balance)).toBe(0);
  });

  it("no-ops when the bet is no longer MATCHED (idempotent / race-safe)", async () => {
    const { betId } = await acceptedMatch(500);
    // First void wins.
    await prisma.$transaction((tx) => voidNoShowMatch(tx as never, betId));
    // Second call finds it VOIDED and does nothing.
    const again = await prisma.$transaction((tx) => voidNoShowMatch(tx as never, betId));
    expect(again.voided).toBe(false);
  });
});
