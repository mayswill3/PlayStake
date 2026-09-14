// =============================================================================
// Integration Tests: Match chat
// =============================================================================
// Chat exists only for refereed stream matches: spectators (and the referee)
// post, the two players can only read, and other bet types have no room at
// all. Rooms close with the match, posting is throttled per user, and
// moderator removals reach polling clients.
// =============================================================================

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import * as crypto from "crypto";
import { Decimal } from "@prisma/client/runtime/client";
import { disconnectTestPrisma, getTestPrisma } from "./helpers.js";
import {
  BetMatchType,
  BetStatus,
  RefereeProfileStatus,
  UserRole,
} from "../../generated/prisma/client.js";
import { getChatRoom, postChatMessage, removeChatMessage } from "../../src/lib/matches/chat.js";
import {
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "../../src/lib/errors/index.js";

const prisma = getTestPrisma();
let gameId: string;

beforeAll(async () => {
  const devUser = await prisma.user.create({
    data: { email: "chat-dev@playstake-test.com", role: "DEVELOPER", displayName: "Chat Dev", emailVerified: true },
  });
  const profile = await prisma.developerProfile.create({
    data: { userId: devUser.id, companyName: "Chat Co", contactEmail: "chat-dev@playstake-test.com" },
  });
  const game = await prisma.game.create({
    data: { developerProfileId: profile.id, name: "Chat Game", slug: "chat-game", platformFeePercent: new Decimal("0.05") },
  });
  gameId = game.id;
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { contains: "chat-" } }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  const bets = await prisma.bet.findMany({ where: { gameId }, select: { id: true } });
  const betIds = bets.map((bet) => bet.id);
  await prisma.matchChatMessage.deleteMany({ where: { betId: { in: betIds } } });
  await prisma.refereeAssignment.deleteMany({ where: { betId: { in: betIds } } });
  await prisma.bet.deleteMany({ where: { id: { in: betIds } } });
  await prisma.refereeProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.developerProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await disconnectTestPrisma();
});

async function makeUser(displayName: string, role: UserRole = UserRole.PLAYER) {
  const uid = crypto.randomUUID().substring(0, 8);
  return prisma.user.create({
    data: { email: `chat-${uid}@playstake-test.com`, displayName, role, emailVerified: true },
  });
}

async function makeMatch(matchType: BetMatchType, status: BetStatus = BetStatus.MATCHED) {
  const playerA = await makeUser("Chat A");
  const playerB = await makeUser("Chat B");
  const bet = await prisma.bet.create({
    data: {
      gameId,
      playerAId: playerA.id,
      playerBId: playerB.id,
      amount: new Decimal("5.00"),
      status,
      matchType,
      platformFeePercent: new Decimal("0.05"),
      expiresAt: new Date(Date.now() + 3_600_000),
      matchedAt: new Date(),
    },
  });
  return { bet, playerA, playerB };
}

describe("Match chat: who can post", () => {
  it("lets spectators and the referee post, with role badges", async () => {
    const { bet } = await makeMatch(BetMatchType.STREAM_VS_STREAM);
    const refereeUser = await makeUser("Chat Ref");
    const refereeProfile = await prisma.refereeProfile.create({
      data: { userId: refereeUser.id, status: RefereeProfileStatus.APPROVED, isAvailable: true },
    });
    await prisma.refereeAssignment.create({
      data: { betId: bet.id, refereeProfileId: refereeProfile.id, status: "ASSIGNED" },
    });
    const spectator = await makeUser("Chat Fan");

    await postChatMessage(bet.id, refereeUser, "  both   streams   look good  ");
    await postChatMessage(bet.id, spectator, "let's go");

    const room = await getChatRoom(bet.id, spectator);
    expect(room.canPost).toBe(true);
    expect(room.messages.map((m) => [m.author.role, m.body])).toEqual([
      ["REFEREE", "both streams look good"],
      ["SPECTATOR", "let's go"],
    ]);
  });

  it("lets the players read their match chat but never post in it", async () => {
    const { bet, playerA, playerB } = await makeMatch(BetMatchType.STREAM_VS_STREAM);
    const spectator = await makeUser("Chat Viewer");
    await postChatMessage(bet.id, spectator, "who wins?");

    const room = await getChatRoom(bet.id, playerA);
    expect(room.messages.map((m) => m.body)).toEqual(["who wins?"]);
    expect(room.canPost).toBe(false);
    expect(room.readOnlyReason).toBe("PLAYER");
    await expect(postChatMessage(bet.id, playerA, "gl")).rejects.toBeInstanceOf(AuthorizationError);
    await expect(postChatMessage(bet.id, playerB, "gl")).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("has no chat at all for lobby bets — not even for their players", async () => {
    const { bet, playerA } = await makeMatch(BetMatchType.GAME_LOBBY);
    const outsider = await makeUser("Chat Outsider");

    await expect(getChatRoom(bet.id, playerA)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getChatRoom(bet.id, outsider)).rejects.toBeInstanceOf(NotFoundError);
    await expect(postChatMessage(bet.id, outsider, "hi")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("Match chat: limits", () => {
  it("throttles a user who posts faster than the cooldown", async () => {
    const { bet } = await makeMatch(BetMatchType.STREAM_VS_STREAM);
    const spectator = await makeUser("Chat Spammer");
    await postChatMessage(bet.id, spectator, "one");
    await expect(postChatMessage(bet.id, spectator, "two")).rejects.toBeInstanceOf(RateLimitError);
  });

  it("rejects empty and over-long messages", async () => {
    const { bet } = await makeMatch(BetMatchType.STREAM_VS_STREAM);
    const spectator = await makeUser("Chat Typist");
    await expect(postChatMessage(bet.id, spectator, "   ")).rejects.toBeInstanceOf(ValidationError);
    await expect(postChatMessage(bet.id, spectator, "x".repeat(281))).rejects.toBeInstanceOf(ValidationError);
  });

  it("goes read-only once the match is settled", async () => {
    const { bet } = await makeMatch(BetMatchType.STREAM_VS_STREAM, BetStatus.SETTLED);
    const spectator = await makeUser("Chat Late");
    const room = await getChatRoom(bet.id, spectator);
    expect(room.closed).toBe(true);
    expect(room.readOnlyReason).toBe("CLOSED");
    await expect(postChatMessage(bet.id, spectator, "gg")).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("Match chat: moderation", () => {
  it("lets only admins remove messages, and reports removals to pollers", async () => {
    const { bet, playerB } = await makeMatch(BetMatchType.STREAM_VS_STREAM);
    const admin = await makeUser("Chat Admin", UserRole.ADMIN);
    const troll = await makeUser("Chat Troll");
    const message = await postChatMessage(bet.id, troll, "something rude");
    const before = await getChatRoom(bet.id, playerB);

    await expect(removeChatMessage(bet.id, message.id, playerB)).rejects.toBeInstanceOf(AuthorizationError);
    await removeChatMessage(bet.id, message.id, admin);

    // A poller that already had the message learns it was removed...
    const polled = await getChatRoom(bet.id, playerB, new Date(before.cursor));
    expect(polled.removedIds).toContain(message.id);
    // ...and a fresh load no longer includes it, though the row is kept for audit.
    expect((await getChatRoom(bet.id, playerB)).messages.map((m) => m.id)).not.toContain(message.id);
    const row = await prisma.matchChatMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(row.deletedById).toBe(admin.id);
  });
});
