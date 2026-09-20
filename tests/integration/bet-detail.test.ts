// =============================================================================
// Integration Tests: Bet detail — opponent resolution
// =============================================================================
// The rematch card on a finished bet is built entirely from `opponent`, so it
// has to be the OTHER player, from whichever side is asking. Getting this
// backwards would offer someone a rematch against themselves.
// =============================================================================

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";
import { callApi, createTestSession, disconnectTestPrisma, getTestPrisma } from "./helpers.js";
import { BetMatchType, BetOutcome, BetStatus } from "../../generated/prisma/client.js";

const prisma = getTestPrisma();

let gameId: string;
let playerAId: string;
let playerBId: string;
let outsiderId: string;
let betId: string;

beforeAll(async () => {
  const devUser = await prisma.user.create({
    data: {
      email: "betdetail-dev@playstake-test.com",
      role: "DEVELOPER",
      displayName: "Bet Detail Dev",
      emailVerified: true,
    },
  });
  const profile = await prisma.developerProfile.create({
    data: {
      userId: devUser.id,
      companyName: "Bet Detail Co",
      contactEmail: "betdetail-dev@playstake-test.com",
    },
  });
  const game = await prisma.game.create({
    data: {
      developerProfileId: profile.id,
      name: "Bet Detail Game",
      slug: "bet-detail-game",
      platformFeePercent: new Decimal("0.05"),
    },
  });
  gameId = game.id;

  const playerA = await prisma.user.create({
    data: { email: "betdetail-a@playstake-test.com", displayName: "Ayo", emailVerified: true },
  });
  const playerB = await prisma.user.create({
    data: { email: "betdetail-b@playstake-test.com", displayName: "Kwasi", emailVerified: true },
  });
  const outsider = await prisma.user.create({
    data: { email: "betdetail-c@playstake-test.com", displayName: "Nosy", emailVerified: true },
  });
  playerAId = playerA.id;
  playerBId = playerB.id;
  outsiderId = outsider.id;

  // Player B streams; player A does not. The rematch card keys off this.
  await prisma.kickAccount.create({
    data: {
      userId: playerB.id,
      kickUserId: "betdetail-kick-b",
      channelSlug: "kwasi-plays",
      accessTokenEnc: "enc",
      refreshTokenEnc: "enc",
      tokenExpiresAt: new Date(Date.now() + 3_600_000),
      scope: "user:read",
      isLive: true,
    },
  });

  const bet = await prisma.bet.create({
    data: {
      gameId,
      playerAId: playerA.id,
      playerBId: playerB.id,
      amount: new Decimal("5.00"),
      status: BetStatus.SETTLED,
      matchType: BetMatchType.GAME_LOBBY,
      platformFeePercent: new Decimal("0.05"),
      platformFeeAmount: new Decimal("0.50"),
      outcome: BetOutcome.PLAYER_A_WIN,
      expiresAt: new Date(Date.now() + 3_600_000),
      matchedAt: new Date(),
      settledAt: new Date(),
    },
  });
  betId = bet.id;
});

afterAll(async () => {
  const userIds = [playerAId, playerBId, outsiderId];
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.bet.deleteMany({ where: { gameId } });
  await prisma.kickAccount.deleteMany({ where: { userId: { in: userIds } } });
  const devUsers = await prisma.user.findMany({
    where: { email: { contains: "betdetail-" } },
    select: { id: true },
  });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.developerProfile.deleteMany({
    where: { userId: { in: devUsers.map((u) => u.id) } },
  });
  await prisma.user.deleteMany({ where: { id: { in: devUsers.map((u) => u.id) } } });
  await disconnectTestPrisma();
});

describe("GET /api/bets/[id] — opponent", () => {
  it("gives player A the other player, with their live channel", async () => {
    const { sessionToken } = await createTestSession(prisma as never, playerAId);

    const response = await callApi("GET", `/api/bets/${betId}`, { sessionToken });

    expect(response.status).toBe(200);
    expect(response.body.opponent.id).toBe(playerBId);
    expect(response.body.opponent.displayName).toBe("Kwasi");
    expect(response.body.opponent.kick).toEqual({
      channelSlug: "kwasi-plays",
      isLive: true,
    });
  });

  it("gives player B the opposite answer from the same bet", async () => {
    const { sessionToken } = await createTestSession(prisma as never, playerBId);

    const response = await callApi("GET", `/api/bets/${betId}`, { sessionToken });

    expect(response.status).toBe(200);
    expect(response.body.opponent.id).toBe(playerAId);
    // Player A has no linked channel, so there is nothing to challenge them on.
    expect(response.body.opponent.kick).toBeNull();
  });

  it("never returns the caller as their own opponent", async () => {
    for (const userId of [playerAId, playerBId]) {
      const { sessionToken } = await createTestSession(prisma as never, userId);
      const response = await callApi("GET", `/api/bets/${betId}`, { sessionToken });
      expect(response.body.opponent.id).not.toBe(userId);
    }
  });

  it("still refuses anyone who wasn't in the match", async () => {
    const { sessionToken } = await createTestSession(prisma as never, outsiderId);

    const response = await callApi("GET", `/api/bets/${betId}`, { sessionToken });

    expect(response.status).toBe(403);
  });
});
