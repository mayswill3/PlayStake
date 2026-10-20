// =============================================================================
// PlayStake — Following
// =============================================================================
// Users follow streamers (users with a linked Kick channel) and players who
// let others find and follow them (see ../users/directory). Follows are
// private: a follower sees who they follow, a streamer sees only how many
// follow them. Following drives three things:
//
//   - a Following list (live streamers first),
//   - an in-app alert when someone you follow goes live,
//   - an email when they go live, which is marketing: it needs marketing
//     consent, and the email outbox never sends it to anyone on a break,
//     self-excluded, on GAMSTOP or recently flagged for harm.
//
// Alerts are held back for anyone who may not gamble right now, so a break
// or exclusion is never interrupted by an invitation to watch or play.
// =============================================================================

import { AccountStatus, GamstopStatus } from "../../../generated/prisma/client";
import { prisma } from "../db/client";
import { queueEmailSafely } from "../email/outbox";
import { NotFoundError, ValidationError } from "../errors";
import { getActiveBreak } from "../responsible-play/service";
import { isBlockedEitherWay } from "../users/directory";
import { assertNoRefereeLinkDuringMatch } from "../referees/conflicts";

export interface FollowedStreamer {
  streamerId: string;
  username: string | null;
  displayName: string;
  /** Null for a player who doesn't stream. */
  channelSlug: string | null;
  profilePicture: string | null;
  isLive: boolean;
  gameName: string | null;
}

async function streamerBySlug(slug: string) {
  const account = await prisma.kickAccount.findFirst({
    where: { channelSlug: { equals: slug, mode: "insensitive" } },
    select: { userId: true },
  });
  if (!account) throw new NotFoundError("Streamer not found");
  return account.userId;
}

export async function followStreamer(followerId: string, slug: string): Promise<void> {
  const streamerId = await streamerBySlug(slug);
  if (streamerId === followerId) throw new ValidationError("You can't follow yourself");
  if (await isBlockedEitherWay(followerId, streamerId)) throw new NotFoundError("Streamer not found");
  await assertNoRefereeLinkDuringMatch(followerId, streamerId);
  await prisma.streamerFollow.createMany({
    data: [{ followerId, streamerId }],
    skipDuplicates: true,
  });
}

export async function unfollowStreamer(followerId: string, slug: string): Promise<void> {
  const streamerId = await streamerBySlug(slug);
  await prisma.streamerFollow.deleteMany({ where: { followerId, streamerId } });
}

export async function isFollowing(followerId: string, streamerId: string): Promise<boolean> {
  const row = await prisma.streamerFollow.findUnique({
    where: { followerId_streamerId: { followerId, streamerId } },
    select: { id: true },
  });
  return row !== null;
}

export function followerCount(streamerId: string): Promise<number> {
  return prisma.streamerFollow.count({ where: { streamerId } });
}

/**
 * Everyone this user follows, live streamers first. A player who has since
 * stopped letting others find them, or whose account is no longer active,
 * drops out of the list.
 */
export async function listFollowing(followerId: string): Promise<FollowedStreamer[]> {
  const rows = await prisma.streamerFollow.findMany({
    where: { followerId },
    select: {
      streamer: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          discoverable: true,
          accountStatus: true,
          kickAccount: {
            select: {
              channelSlug: true,
              profilePicture: true,
              isLive: true,
              declaredGame: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  return rows
    .filter(({ streamer }) =>
      streamer.kickAccount?.channelSlug
        ? true
        : streamer.discoverable && streamer.accountStatus === AccountStatus.ACTIVE && streamer.username,
    )
    .map(({ streamer }) => ({
      streamerId: streamer.id,
      username: streamer.username,
      displayName: streamer.displayName,
      channelSlug: streamer.kickAccount?.channelSlug ?? null,
      profilePicture: streamer.kickAccount?.profilePicture ?? streamer.avatarUrl,
      isLive: Boolean(streamer.kickAccount?.isLive),
      gameName: streamer.kickAccount?.declaredGame?.name ?? null,
    }))
    .sort((a, b) => Number(b.isLive) - Number(a.isLive) || a.displayName.localeCompare(b.displayName));
}

/**
 * Followed streamers who are live, for in-app alerts. Empty for anyone who
 * may not gamble right now: restricted, on GAMSTOP, on a break or excluded.
 */
export async function liveFollowedForAlerts(userId: string): Promise<FollowedStreamer[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountStatus: true, gamstopStatus: true },
  });
  if (!user || user.accountStatus !== AccountStatus.ACTIVE) return [];
  if (user.gamstopStatus === GamstopStatus.EXCLUDED) return [];
  if (await getActiveBreak(userId)) return [];
  return (await listFollowing(userId)).filter((streamer) => streamer.isLive);
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Email the followers of streamers who have just gone live. At most one email
 * per follower, per streamer, per day. The outbox applies the consent and
 * protection rules; this only picks followers who want these emails.
 */
export async function notifyFollowersWentLive(streamerIds: string[], now: Date = new Date()): Promise<void> {
  if (streamerIds.length === 0) return;
  const streamers = await prisma.user.findMany({
    where: { id: { in: streamerIds } },
    select: {
      id: true,
      displayName: true,
      kickAccount: { select: { channelSlug: true, declaredGame: { select: { name: true } } } },
      followers: {
        where: { follower: { followLiveEmails: true, marketingConsent: true } },
        select: { follower: { select: { id: true, displayName: true } } },
      },
    },
  });
  for (const streamer of streamers) {
    const slug = streamer.kickAccount?.channelSlug;
    if (!slug) continue;
    for (const { follower } of streamer.followers) {
      await queueEmailSafely({
        template: "follow.streamer-live",
        userId: follower.id,
        dedupeKey: `follow-live:${follower.id}:${streamer.id}:${isoDay(now)}`,
        payload: {
          name: follower.displayName,
          streamerName: streamer.displayName,
          gameName: streamer.kickAccount?.declaredGame?.name ?? null,
          channelSlug: slug,
        },
      });
    }
  }
}

/** For callers on a hot path (webhooks): never throws. */
export function notifyFollowersWentLiveQuietly(streamerIds: string[]): void {
  void notifyFollowersWentLive(streamerIds).catch((error) => {
    console.error("[Follows] go-live notification failed:", error);
  });
}
