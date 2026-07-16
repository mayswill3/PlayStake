// =============================================================================
// Integration Tests: Viewer -> Streamer Challenge
// =============================================================================
// Hits the real Docker Postgres. createChallenge / respondToInvite / the route
// all use the application's global Prisma client, so setup here is committed
// (not rollback-wrapped) and torn down explicitly in afterEach.
//
// Two guarantees under test:
//   1. Creating a challenge produces a PENDING lobby invite and touches the
//      ledger in NO way — no bet, no escrow, balances unchanged.
//   2. The accept handoff actually runs: challenge -> respondToInvite(ACCEPT)
//      escrows BOTH players and reaches MATCHED (the money-path proof that a
//      challenge-created invite is equivalent to a normal invite).
// =============================================================================

import { describe, it, expect, afterEach, afterAll, beforeAll } from "vitest";
import * as crypto from "crypto";
import { Decimal } from "@prisma/client/runtime/client";
import {
  getTestPrisma,
  disconnectTestPrisma,
  createTestSession,
  callApi,
} from "./helpers.js";
import { createChallenge, respondToInvite } from "../../src/lib/lobby/service.js";
import {
  LobbyRole,
  LobbyStatus,
  BetStatus,
  LedgerAccountType,
} from "../../generated/prisma/client.js";
import { dollarsToCents } from "../../src/lib/utils/money.js";

const prisma = getTestPrisma();

// A shared demo developer + game whose slug maps to a challengeable lobby game.
let gameId: string;
const DECLARED_SLUG = "darts-301";

// Track everything created per-test for teardown.
const createdUserIds: string[] = [];

beforeAll(async () => {
  const devUser = await prisma.user.upsert({
    where: { email: "challenge-test-dev@playstake-test.com" },
    update: {},
    create: {
      email: "challenge-test-dev@playstake-test.com",
      role: "DEVELOPER",
      displayName: "Challenge Test Dev",
      emailVerified: true,
    },
  });
  const profile = await prisma.developerProfile.upsert({
    where: { userId: devUser.id },
    update: {},
    create: {
      userId: devUser.id,
      companyName: "Challenge Test Studio",
      contactEmail: "challenge-test-dev@playstake-test.com",
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

  // Bets created by the accept handoff pull in transactions, ledger entries, and
  // a per-bet escrow account (userId null) — delete those in FK-safe order
  // before the users/accounts they hang off.
  const bets = await prisma.bet.findMany({
    where: {
      OR: [
        { playerAId: { in: createdUserIds } },
        { playerBId: { in: createdUserIds } },
      ],
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
    where: {
      OR: [{ userId: { in: createdUserIds } }, { betId: { in: betIds } }],
    },
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

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function makeUser(displayName: string): Promise<{ id: string }> {
  const uid = crypto.randomUUID().substring(0, 8);
  const user = await prisma.user.create({
    data: {
      email: `challenge-${uid}@playstake-test.com`,
      displayName,
      role: "PLAYER",
      emailVerified: true,
    },
  });
  createdUserIds.push(user.id);
  return { id: user.id };
}

/** Seed a PLAYER_BALANCE account with a starting balance (dollars). */
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
    where: {
      userId_accountType: { userId, accountType: LedgerAccountType.PLAYER_BALANCE },
    },
    select: { balance: true },
  });
  return account ? dollarsToCents(account.balance) : 0;
}

async function makeStreamer(opts: {
  channelSlug: string;
  isLive: boolean;
  declared: boolean;
}): Promise<{ id: string; channelSlug: string }> {
  const streamer = await makeUser("Streamer");
  const uid = crypto.randomUUID();
  await prisma.kickAccount.create({
    data: {
      userId: streamer.id,
      kickUserId: `kick-${uid}`,
      channelSlug: opts.channelSlug,
      displayName: "Streamer",
      accessTokenEnc: "enc",
      refreshTokenEnc: "enc",
      tokenExpiresAt: new Date(Date.now() + 3_600_000),
      scope: "user:read",
      isLive: opts.isLive,
      declaredGameId: opts.declared ? gameId : null,
    },
  });
  return { id: streamer.id, channelSlug: opts.channelSlug };
}

async function sessionFor(userId: string): Promise<string> {
  const { sessionToken } = await createTestSession(prisma as never, userId);
  return sessionToken;
}

// ---------------------------------------------------------------------------
// tests: challenge creation (route)
// ---------------------------------------------------------------------------

describe("POST /api/streamers/[slug]/challenge", () => {
  it("creates a PENDING invite with zero ledger movement when streamer is live + declared", async () => {
    const slug = `live-${crypto.randomUUID().substring(0, 8)}`;
    const streamer = await makeStreamer({ channelSlug: slug, isLive: true, declared: true });
    const viewer = await makeUser("Viewer");
    await fundUser(viewer.id, 50); // enough to pass the soft balance check
    const token = await sessionFor(viewer.id);

    const res = await callApi("POST", `/api/streamers/${slug}/challenge`, {
      sessionToken: token,
      body: { amount: 500 },
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("SENT");
    expect(res.body.gameType).toBe("darts");
    expect(res.body.stakeAmount).toBe(500);

    // Streamer got an INVITED Player B entry; viewer holds a WAITING Player A entry.
    const streamerEntry = await prisma.lobbyEntry.findFirst({
      where: { userId: streamer.id, role: LobbyRole.PLAYER_B },
    });
    expect(streamerEntry?.status).toBe(LobbyStatus.INVITED);
    expect(streamerEntry?.invitedById).toBe(viewer.id);
    expect(streamerEntry?.stakeAmount).toBe(500);

    const viewerEntry = await prisma.lobbyEntry.findFirst({
      where: { userId: viewer.id, role: LobbyRole.PLAYER_A },
    });
    expect(viewerEntry?.status).toBe(LobbyStatus.WAITING);
    expect(viewerEntry?.stakeAmount).toBe(500);

    // The ledger was NOT touched: no bet involving either party, and the viewer's
    // balance is exactly what we funded (nothing was debited/escrowed).
    const betCount = await prisma.bet.count({
      where: { OR: [{ playerAId: viewer.id }, { playerBId: streamer.id }] },
    });
    expect(betCount).toBe(0);
    expect(await balanceCents(viewer.id)).toBe(5000);
  });

  it("rejects a broke challenger BEFORE publishing (soft balance check)", async () => {
    const slug = `broke-${crypto.randomUUID().substring(0, 8)}`;
    const streamer = await makeStreamer({ channelSlug: slug, isLive: true, declared: true });
    const viewer = await makeUser("Viewer"); // no funds at all
    const token = await sessionFor(viewer.id);

    const res = await callApi("POST", `/api/streamers/${slug}/challenge`, {
      sessionToken: token,
      body: { amount: 500 },
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INSUFFICIENT_FUNDS");
    // Nothing was created — no invite reached the streamer.
    const entries = await prisma.lobbyEntry.count({
      where: { userId: { in: [viewer.id, streamer.id] } },
    });
    expect(entries).toBe(0);
  });

  it("rejects challenging yourself", async () => {
    const slug = `self-${crypto.randomUUID().substring(0, 8)}`;
    const streamer = await makeStreamer({ channelSlug: slug, isLive: true, declared: true });
    const token = await sessionFor(streamer.id);

    const res = await callApi("POST", `/api/streamers/${slug}/challenge`, {
      sessionToken: token,
      body: { amount: 500 },
    });

    expect(res.status).toBe(422);
    const entries = await prisma.lobbyEntry.count({ where: { userId: streamer.id } });
    expect(entries).toBe(0);
  });

  it("rejects when the streamer is offline", async () => {
    const slug = `offline-${crypto.randomUUID().substring(0, 8)}`;
    await makeStreamer({ channelSlug: slug, isLive: false, declared: true });
    const viewer = await makeUser("Viewer");
    await fundUser(viewer.id, 50);
    const token = await sessionFor(viewer.id);

    const res = await callApi("POST", `/api/streamers/${slug}/challenge`, {
      sessionToken: token,
      body: { amount: 500 },
    });

    expect(res.status).toBe(409);
  });

  it("rejects when the streamer has no declared game", async () => {
    const slug = `nogame-${crypto.randomUUID().substring(0, 8)}`;
    await makeStreamer({ channelSlug: slug, isLive: true, declared: false });
    const viewer = await makeUser("Viewer");
    await fundUser(viewer.id, 50);
    const token = await sessionFor(viewer.id);

    const res = await callApi("POST", `/api/streamers/${slug}/challenge`, {
      sessionToken: token,
      body: { amount: 500 },
    });

    expect(res.status).toBe(422);
  });

  it("rejects an out-of-range stake", async () => {
    const slug = `range-${crypto.randomUUID().substring(0, 8)}`;
    await makeStreamer({ channelSlug: slug, isLive: true, declared: true });
    const viewer = await makeUser("Viewer");
    await fundUser(viewer.id, 50);
    const token = await sessionFor(viewer.id);

    const res = await callApi("POST", `/api/streamers/${slug}/challenge`, {
      sessionToken: token,
      body: { amount: 1 }, // below 100-cent minimum
    });

    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// tests: accept handoff (money-path proof)
// ---------------------------------------------------------------------------

describe("challenge -> respondToInvite(ACCEPT)", () => {
  it("escrows BOTH players and reaches MATCHED", async () => {
    const STAKE_CENTS = 500; // $5.00 each
    const slug = `handoff-${crypto.randomUUID().substring(0, 8)}`;
    const streamer = await makeStreamer({ channelSlug: slug, isLive: true, declared: true });
    const viewer = await makeUser("Viewer");
    await fundUser(viewer.id, 50);
    await fundUser(streamer.id, 50);

    // 1. Viewer challenges the streamer (no ledger movement yet).
    const challenge = await createChallenge({
      challengerUserId: viewer.id,
      streamerChannelSlug: slug,
      stakeAmount: STAKE_CENTS,
    });
    expect(await balanceCents(viewer.id)).toBe(5000);
    expect(await balanceCents(streamer.id)).toBe(5000);

    // 2. Streamer accepts through the SAME path a normal invite uses.
    const result = await respondToInvite({
      callerUserId: streamer.id,
      lobbyEntryId: challenge.streamerLobbyEntryId,
      response: "ACCEPT",
    });

    // 3. Bet reached MATCHED.
    expect(result.status).toBe("MATCHED");
    const bet = await prisma.bet.findUniqueOrThrow({ where: { id: (result as { betId: string }).betId } });
    expect(bet.status).toBe(BetStatus.MATCHED);
    expect(new Set([bet.playerAId, bet.playerBId])).toEqual(new Set([viewer.id, streamer.id]));

    // 4. holdEscrow ran for EACH player: both balances dropped by the stake...
    expect(await balanceCents(viewer.id)).toBe(5000 - STAKE_CENTS);
    expect(await balanceCents(streamer.id)).toBe(5000 - STAKE_CENTS);

    // ...and the per-bet escrow holds exactly 2x the stake.
    const escrow = await prisma.ledgerAccount.findFirstOrThrow({
      where: { betId: bet.id, accountType: LedgerAccountType.ESCROW },
      select: { balance: true },
    });
    expect(dollarsToCents(escrow.balance)).toBe(2 * STAKE_CENTS);
  });
});
