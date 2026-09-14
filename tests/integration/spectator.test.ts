// =============================================================================
// Integration Tests: Spectator view of live matches
// =============================================================================
// Spectators may only ever see refereed stream matches (STREAM_VS_STREAM) —
// private lobby bets and finished matches must never leak into the live list.
// =============================================================================

import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";
import * as crypto from "crypto";
import { Decimal } from "@prisma/client/runtime/client";
import { disconnectTestPrisma, getTestPrisma } from "./helpers.js";
import {
  BetMatchType,
  BetStatus,
  RefereeAssignmentStatus,
} from "../../generated/prisma/client.js";

// Thumbnail enrichment calls Kick's public API — stub it so tests stay offline.
vi.mock("../../src/lib/kick/api.js", () => ({
  fetchPublicChannels: vi.fn(async (slugs: string[]) =>
    slugs.map((slug) => ({ slug, stream: { is_live: true, thumbnail: `https://thumb.test/${slug}.jpg` } })),
  ),
}));

const { getSpectatorMatch, listLiveMatches } = await import("../../src/lib/matches/spectator.js");

const prisma = getTestPrisma();
let gameId: string;

beforeAll(async () => {
  const devUser = await prisma.user.create({
    data: { email: "spectate-dev@playstake-test.com", role: "DEVELOPER", displayName: "Spectate Dev", emailVerified: true },
  });
  const profile = await prisma.developerProfile.create({
    data: { userId: devUser.id, companyName: "Spectate Co", contactEmail: "spectate-dev@playstake-test.com" },
  });
  const game = await prisma.game.create({
    data: {
      developerProfileId: profile.id,
      name: "Spectate Game",
      slug: "spectate-game",
      platformFeePercent: new Decimal("0.05"),
    },
  });
  gameId = game.id;
});

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { contains: "spectate-" } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  const bets = await prisma.bet.findMany({ where: { gameId }, select: { id: true } });
  const betIds = bets.map((bet) => bet.id);
  await prisma.refereeAssignment.deleteMany({ where: { betId: { in: betIds } } });
  await prisma.bet.deleteMany({ where: { id: { in: betIds } } });
  await prisma.kickAccount.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.developerProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await disconnectTestPrisma();
});

async function makeStreamer(displayName: string) {
  const uid = crypto.randomUUID().substring(0, 8);
  const user = await prisma.user.create({
    data: { email: `spectate-${uid}@playstake-test.com`, displayName, emailVerified: true },
  });
  await prisma.kickAccount.create({
    data: {
      userId: user.id,
      kickUserId: `spectate-${uid}`,
      channelSlug: `spectate-${uid}`,
      accessTokenEnc: "enc",
      refreshTokenEnc: "enc",
      tokenExpiresAt: new Date(Date.now() + 3_600_000),
      scope: "user:read",
      isLive: true,
    },
  });
  return user;
}

async function makeMatch(opts: {
  matchType: BetMatchType;
  betStatus?: BetStatus;
  assignmentStatus?: RefereeAssignmentStatus | null;
}) {
  const playerA = await makeStreamer("Spectate A");
  const playerB = await makeStreamer("Spectate B");
  const bet = await prisma.bet.create({
    data: {
      gameId,
      playerAId: playerA.id,
      playerBId: playerB.id,
      amount: new Decimal("7.50"),
      status: opts.betStatus ?? BetStatus.MATCHED,
      matchType: opts.matchType,
      platformFeePercent: new Decimal("0.05"),
      expiresAt: new Date(Date.now() + 3_600_000),
      matchedAt: new Date(),
    },
  });
  if (opts.assignmentStatus !== null) {
    await prisma.refereeAssignment.create({
      data: { betId: bet.id, status: opts.assignmentStatus ?? RefereeAssignmentStatus.OPEN },
    });
  }
  return bet;
}

describe("Spectator: live matches", () => {
  it("lists active refereed stream matches with pot, phase and thumbnails", async () => {
    const bet = await makeMatch({ matchType: BetMatchType.STREAM_VS_STREAM });

    const match = (await listLiveMatches()).find((item) => item.betId === bet.id);
    expect(match).toBeDefined();
    expect(match!.phase).toBe("FINDING_REFEREE");
    expect(match!.potCents).toBe(1500);
    expect(match!.referee).toBeNull();
    expect(match!.playerA.isLive).toBe(true);
    expect(match!.playerA.thumbnail).toMatch(/^https:\/\/thumb\.test\//);
  });

  it("never exposes lobby bets, even ones that look active", async () => {
    const lobby = await makeMatch({ matchType: BetMatchType.GAME_LOBBY });

    expect((await listLiveMatches()).map((item) => item.betId)).not.toContain(lobby.id);
    expect(await getSpectatorMatch(lobby.id)).toBeNull();
  });

  it("drops finished matches from the list but still serves their page", async () => {
    const settled = await makeMatch({
      matchType: BetMatchType.STREAM_VS_STREAM,
      betStatus: BetStatus.SETTLED,
      assignmentStatus: RefereeAssignmentStatus.COMPLETED,
    });

    expect((await listLiveMatches()).map((item) => item.betId)).not.toContain(settled.id);
    expect((await getSpectatorMatch(settled.id))?.phase).toBe("FINISHED");
  });
});
