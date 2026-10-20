// =============================================================================
// PlayStake — Finding players: search, profiles, follows and blocks
// =============================================================================
// Who can be found: streamers (their channel is public anyway), and players
// who have switched on "Let other players find and follow me". Never anyone
// whose account is closed or restricted, who is on GAMSTOP, on a break or
// self-excluded, or who has blocked the viewer.
//
// Profiles show identity only (photo, names, join date, live status). No
// balances, stakes or results: gambling activity stays private.
// =============================================================================

import {
  AccountStatus,
  GamstopStatus,
  PlayBreakType,
  type Prisma,
} from "../../../generated/prisma/client";
import { prisma } from "../db/client";
import { AuthorizationError, NotFoundError, ValidationError } from "../errors";
import { normalizeUsername } from "./username";

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_LIMIT = 10;

export interface PlayerSummary {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isStreamer: boolean;
  channelSlug: string | null;
  isLive: boolean;
}

export interface PlayerProfile extends PlayerSummary {
  memberSince: string;
  gameName: string | null;
  isSelf: boolean;
  isFollowing: boolean;
  blockedByMe: boolean;
}

/** Accounts that may appear to others at all, before blocks are applied. */
function listedWhere(now: Date): Prisma.UserWhereInput {
  return {
    deletedAt: null,
    username: { not: null },
    accountStatus: AccountStatus.ACTIVE,
    playBreaks: {
      none: {
        OR: [
          { endsAt: { gt: now } },
          {
            type: PlayBreakType.SELF_EXCLUSION,
            OR: [{ returnEffectiveAt: null }, { returnEffectiveAt: { gt: now } }],
          },
        ],
      },
    },
    AND: [
      { OR: [{ gamstopStatus: null }, { gamstopStatus: { not: GamstopStatus.EXCLUDED } }] },
      { OR: [{ discoverable: true }, { kickAccount: { isNot: null } }] },
    ],
  };
}

const summarySelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  createdAt: true,
  kickAccount: {
    select: { channelSlug: true, isLive: true, declaredGame: { select: { name: true } } },
  },
} satisfies Prisma.UserSelect;

type SummaryRow = Prisma.UserGetPayload<{ select: typeof summarySelect }>;

function toSummary(row: SummaryRow): PlayerSummary {
  return {
    username: row.username!,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    isStreamer: Boolean(row.kickAccount?.channelSlug),
    channelSlug: row.kickAccount?.channelSlug ?? null,
    isLive: Boolean(row.kickAccount?.isLive),
  };
}

/** True if either user has blocked the other. */
export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });
  return block !== null;
}

export async function searchPlayers(viewerId: string, rawQuery: string, now: Date = new Date()): Promise<PlayerSummary[]> {
  const query = rawQuery.trim().replace(/^@/, "");
  if (query.length < SEARCH_MIN_LENGTH) return [];

  const rows = await prisma.user.findMany({
    where: {
      AND: [
        listedWhere(now),
        {
          id: { not: viewerId },
          blocksMade: { none: { blockedId: viewerId } },
          blocksReceived: { none: { blockerId: viewerId } },
          OR: [
            { username: { startsWith: query.toLowerCase() } },
            { displayName: { contains: query, mode: "insensitive" } },
          ],
        },
      ],
    },
    select: summarySelect,
    take: SEARCH_LIMIT * 2,
  });

  const lower = query.toLowerCase();
  return rows
    .map(toSummary)
    .sort(
      (a, b) =>
        Number(b.username === lower) - Number(a.username === lower) ||
        Number(b.isLive) - Number(a.isLive) ||
        a.username.localeCompare(b.username),
    )
    .slice(0, SEARCH_LIMIT);
}

/**
 * A player's profile as this viewer may see it. Hidden (404) if they aren't
 * listed or have blocked the viewer. Someone the viewer blocked stays visible
 * to them, so they can unblock.
 */
export async function getPlayerProfile(viewerId: string, rawUsername: string, now: Date = new Date()): Promise<PlayerProfile> {
  const username = normalizeUsername(rawUsername);
  const self = await prisma.user.findUnique({ where: { id: viewerId }, select: { username: true } });
  const isSelf = self?.username === username;

  const row = await prisma.user.findFirst({
    where: isSelf
      ? { id: viewerId }
      : { AND: [listedWhere(now), { username, blocksMade: { none: { blockedId: viewerId } } }] },
    select: summarySelect,
  });
  if (!row?.username) throw new NotFoundError("Player not found");

  const [follow, block] = isSelf
    ? [null, null]
    : await Promise.all([
        prisma.streamerFollow.findUnique({
          where: { followerId_streamerId: { followerId: viewerId, streamerId: row.id } },
          select: { id: true },
        }),
        prisma.userBlock.findUnique({
          where: { blockerId_blockedId: { blockerId: viewerId, blockedId: row.id } },
          select: { id: true },
        }),
      ]);

  return {
    ...toSummary(row),
    memberSince: row.createdAt.toISOString(),
    gameName: row.kickAccount?.declaredGame?.name ?? null,
    isSelf,
    isFollowing: follow !== null,
    blockedByMe: block !== null,
  };
}

/** The user behind a username that this viewer is allowed to follow. */
async function followableUserId(viewerId: string, rawUsername: string, now: Date): Promise<string> {
  const row = await prisma.user.findFirst({
    where: { AND: [listedWhere(now), { username: normalizeUsername(rawUsername) }] },
    select: { id: true },
  });
  if (!row) throw new NotFoundError("Player not found");
  if (row.id === viewerId) throw new ValidationError("You can't follow yourself");
  if (await isBlockedEitherWay(viewerId, row.id)) throw new NotFoundError("Player not found");
  return row.id;
}

export async function followPlayer(viewerId: string, username: string, now: Date = new Date()): Promise<void> {
  const targetId = await followableUserId(viewerId, username, now);
  await prisma.streamerFollow.createMany({
    data: [{ followerId: viewerId, streamerId: targetId }],
    skipDuplicates: true,
  });
}

export async function unfollowPlayer(viewerId: string, rawUsername: string): Promise<void> {
  const row = await prisma.user.findUnique({
    where: { username: normalizeUsername(rawUsername) },
    select: { id: true },
  });
  if (!row) return;
  await prisma.streamerFollow.deleteMany({ where: { followerId: viewerId, streamerId: row.id } });
}

/** Block a user: removes follows both ways and hides each from the other. */
export async function blockPlayer(viewerId: string, rawUsername: string): Promise<void> {
  const row = await prisma.user.findUnique({
    where: { username: normalizeUsername(rawUsername) },
    select: { id: true, role: true },
  });
  if (!row) throw new NotFoundError("Player not found");
  if (row.id === viewerId) throw new ValidationError("You can't block yourself");
  if (row.role === "ADMIN") throw new AuthorizationError("PlayStake staff can't be blocked");

  await prisma.$transaction([
    prisma.userBlock.createMany({ data: [{ blockerId: viewerId, blockedId: row.id }], skipDuplicates: true }),
    prisma.streamerFollow.deleteMany({
      where: {
        OR: [
          { followerId: viewerId, streamerId: row.id },
          { followerId: row.id, streamerId: viewerId },
        ],
      },
    }),
  ]);
}

export async function unblockPlayer(viewerId: string, rawUsername: string): Promise<void> {
  const row = await prisma.user.findUnique({
    where: { username: normalizeUsername(rawUsername) },
    select: { id: true },
  });
  if (!row) return;
  await prisma.userBlock.deleteMany({ where: { blockerId: viewerId, blockedId: row.id } });
}

export async function listBlocked(viewerId: string) {
  const rows = await prisma.userBlock.findMany({
    where: { blockerId: viewerId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, blocked: { select: { username: true, displayName: true, avatarUrl: true } } },
  });
  return rows
    .filter((row) => row.blocked.username)
    .map((row) => ({
      username: row.blocked.username!,
      displayName: row.blocked.displayName,
      avatarUrl: row.blocked.avatarUrl,
      blockedAt: row.createdAt.toISOString(),
    }));
}
