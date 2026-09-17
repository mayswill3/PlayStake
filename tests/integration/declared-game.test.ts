// =============================================================================
// Integration Tests: Declared game (going live / offline on PlayStake)
// =============================================================================
// A streamer's declared game is what viewers challenge them to, and what a
// referee checks before starting a match. Clearing it ("Go offline") or
// switching it mid-match would strand the match, so it's refused then.
// =============================================================================

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import * as crypto from "crypto";
import { Decimal } from "@prisma/client/runtime/client";
import { disconnectTestPrisma, getTestPrisma } from "./helpers.js";
import {
  BetMatchType,
  BetStatus,
  RefereeAssignmentStatus,
} from "../../generated/prisma/client.js";
import { setDeclaredGame } from "../../src/lib/kick/declared-game.js";
import { ConflictError, ValidationError } from "../../src/lib/errors/index.js";

const prisma = getTestPrisma();
const GAMES = [
  { slug: "ea-sports-fc-26", name: "EA SPORTS FC 26" },
  { slug: "call-of-duty", name: "Call of Duty" },
];
const createdGameIds: string[] = [];
let fcGameId: string;

beforeAll(async () => {
  const devUser = await prisma.user.create({
    data: { email: "declared-dev@playstake-test.com", role: "DEVELOPER", displayName: "Declared Dev", emailVerified: true },
  });
  const profile = await prisma.developerProfile.create({
    data: { userId: devUser.id, companyName: "Declared Co", contactEmail: "declared-dev@playstake-test.com" },
  });
  // setDeclaredGame resolves catalogue slugs to real Game rows; provision any
  // that this database doesn't have, and remove only those afterwards.
  for (const game of GAMES) {
    let row = await prisma.game.findUnique({ where: { slug: game.slug } });
    if (!row) {
      row = await prisma.game.create({
        data: { ...game, developerProfileId: profile.id, platformFeePercent: new Decimal("0.05") },
      });
      createdGameIds.push(row.id);
    }
    if (game.slug === "ea-sports-fc-26") fcGameId = row.id;
  }
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { contains: "declared-" } }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  const bets = await prisma.bet.findMany({ where: { playerAId: { in: userIds } }, select: { id: true } });
  const betIds = bets.map((bet) => bet.id);
  await prisma.refereeAssignment.deleteMany({ where: { betId: { in: betIds } } });
  await prisma.bet.deleteMany({ where: { id: { in: betIds } } });
  await prisma.kickAccount.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.game.deleteMany({ where: { id: { in: createdGameIds } } });
  await prisma.developerProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await disconnectTestPrisma();
});

async function makeStreamer(name: string) {
  const uid = crypto.randomUUID().substring(0, 8);
  const user = await prisma.user.create({
    data: { email: `declared-${uid}@playstake-test.com`, displayName: name, emailVerified: true },
  });
  await prisma.kickAccount.create({
    data: {
      userId: user.id,
      kickUserId: `declared-${uid}`,
      channelSlug: `declared-${uid}`,
      accessTokenEnc: "enc",
      refreshTokenEnc: "enc",
      tokenExpiresAt: new Date(Date.now() + 3_600_000),
      scope: "user:read",
      isLive: true,
    },
  });
  return user;
}

async function startRefereedMatch(
  playerAId: string,
  playerBId: string,
  status: RefereeAssignmentStatus,
  betStatus: BetStatus = BetStatus.MATCHED,
) {
  const bet = await prisma.bet.create({
    data: {
      gameId: fcGameId,
      playerAId,
      playerBId,
      amount: new Decimal("5.00"),
      status: betStatus,
      matchType: BetMatchType.STREAM_VS_STREAM,
      platformFeePercent: new Decimal("0.05"),
      expiresAt: new Date(Date.now() + 3_600_000),
      matchedAt: new Date(),
    },
  });
  await prisma.refereeAssignment.create({ data: { betId: bet.id, status } });
  return bet;
}

describe("Declared game", () => {
  it("lets a streamer pick a game and go offline again", async () => {
    const streamer = await makeStreamer("Declared Solo");
    expect((await setDeclaredGame(streamer.id, "ea-sports-fc-26"))?.name).toBe("EA SPORTS FC 26");
    expect(await setDeclaredGame(streamer.id, null)).toBeNull();
  });

  it("refuses going offline or switching games while a refereed match is in play", async () => {
    const a = await makeStreamer("Declared A");
    const b = await makeStreamer("Declared B");
    await setDeclaredGame(a.id, "ea-sports-fc-26");
    await startRefereedMatch(a.id, b.id, RefereeAssignmentStatus.READY);

    await expect(setDeclaredGame(a.id, null)).rejects.toBeInstanceOf(ConflictError);
    await expect(setDeclaredGame(a.id, "call-of-duty")).rejects.toBeInstanceOf(ConflictError);
    // Re-saving the same game is a no-op, not a change.
    expect((await setDeclaredGame(a.id, "ea-sports-fc-26"))?.name).toBe("EA SPORTS FC 26");
  });

  it("allows going offline once the match is over", async () => {
    const a = await makeStreamer("Declared Done A");
    const b = await makeStreamer("Declared Done B");
    await setDeclaredGame(a.id, "ea-sports-fc-26");
    await startRefereedMatch(a.id, b.id, RefereeAssignmentStatus.COMPLETED, BetStatus.SETTLED);

    expect(await setDeclaredGame(a.id, null)).toBeNull();
  });

  it("requires a connected Kick account", async () => {
    const uid = crypto.randomUUID().substring(0, 8);
    const user = await prisma.user.create({
      data: { email: `declared-nokick-${uid}@playstake-test.com`, displayName: "No Kick", emailVerified: true },
    });
    await expect(setDeclaredGame(user.id, "ea-sports-fc-26")).rejects.toBeInstanceOf(ValidationError);
  });
});
