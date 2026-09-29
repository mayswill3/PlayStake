import { prisma } from "../db/client";
import { fetchPublicChannels } from "./api";
import { publishLiveStatusChanged } from "../realtime/live-events";

/** How long a fresh live flag outranks Kick's (lagging) public API. */
const LIVE_GRACE_MS = 60_000;

export interface LiveStreamer {
  displayName: string | null;
  channelSlug: string | null;
  profilePicture: string | null;
  thumbnail: string | null;
  viewerCount: number | null;
  title: string | null;
  /** The game they've declared on PlayStake (what viewers can challenge them to). */
  gameName: string | null;
}

/**
 * Whether a channel counts as live, given the stored flag and what Kick's
 * public API reports (`null` when the API couldn't be reached — the stored
 * flag stands). Kick's webhook can beat its public API: a channel that just
 * went live may still read as offline there, so a fresh live flag outranks
 * the API for a grace window — otherwise the refetch the webhook triggers
 * would flip it straight back.
 */
export function isChannelLiveNow(
  stored: { isLive: boolean; lastLiveAt: Date | null },
  apiIsLive: boolean | null,
  now: Date,
): boolean {
  if (apiIsLive === null) return stored.isLive;
  if (apiIsLive) return true;
  return (
    stored.isLive &&
    stored.lastLiveAt !== null &&
    now.getTime() - stored.lastLiveAt.getTime() < LIVE_GRACE_MS
  );
}

/**
 * Poll every linked Kick channel through Kick's public API, synchronize the
 * webhook-maintained `isLive` flag, and return the channels that are live.
 *
 * Polling makes newly-live channels discoverable even when webhooks cannot
 * reach the app (for example during local development). When Kick's API is
 * unavailable the stored flag is used as-is. Any flag that flips is announced
 * on the live-status channel so open pages refresh without waiting to poll.
 */
export async function refreshKickLiveStatus(): Promise<LiveStreamer[]> {
  const linkedChannels = await prisma.kickAccount.findMany({
    where: { channelSlug: { not: null } },
    select: {
      id: true,
      channelSlug: true,
      displayName: true,
      profilePicture: true,
      isLive: true,
      lastLiveAt: true,
      declaredGame: { select: { name: true } },
    },
    take: 50,
  });

  if (linkedChannels.length === 0) return [];

  const slugs = linkedChannels
    .map((channel) => channel.channelSlug)
    .filter((s): s is string => Boolean(s));

  const enrich: Record<
    string,
    { isLive: boolean; viewerCount: number | null; thumbnail: string | null; title: string | null }
  > = {};
  let enriched = false;
  try {
    const channels = await fetchPublicChannels(slugs);
    enriched = true;
    for (const channel of channels) {
      enrich[channel.slug.toLowerCase()] = {
        isLive: channel.stream?.is_live ?? false,
        viewerCount: channel.stream?.viewer_count ?? null,
        // Kick returns "" until the live thumbnail is generated; treat as none.
        thumbnail: channel.stream?.thumbnail || null,
        title: channel.stream_title ?? null,
      };
    }
  } catch (err) {
    console.error("Kick live enrichment failed:", err);
  }

  const now = new Date();
  const isLiveNow = (channel: (typeof linkedChannels)[number]) =>
    isChannelLiveNow(
      channel,
      enriched
        ? Boolean(channel.channelSlug && enrich[channel.channelSlug.toLowerCase()]?.isLive)
        : null,
      now,
    );

  if (enriched) {
    const newlyLiveIds = linkedChannels
      .filter((channel) => !channel.isLive && isLiveNow(channel))
      .map((channel) => channel.id);
    const newlyOfflineIds = linkedChannels
      .filter((channel) => channel.isLive && !isLiveNow(channel))
      .map((channel) => channel.id);

    try {
      const updates = [];
      if (newlyLiveIds.length > 0) {
        updates.push(
          prisma.kickAccount.updateMany({
            where: { id: { in: newlyLiveIds } },
            data: { isLive: true, lastLiveAt: new Date() },
          }),
        );
      }
      if (newlyOfflineIds.length > 0) {
        updates.push(
          prisma.kickAccount.updateMany({
            where: { id: { in: newlyOfflineIds } },
            data: { isLive: false },
          }),
        );
      }
      if (updates.length > 0) {
        await Promise.all(updates);
        await publishLiveStatusChanged();
      }
    } catch (err) {
      // Discovery should still succeed if persisting the refreshed flag fails.
      console.error("Kick live-state synchronization failed:", err);
    }
  }

  return linkedChannels
    .map((channel) => {
      const current = channel.channelSlug
        ? enrich[channel.channelSlug.toLowerCase()]
        : undefined;
      return {
        displayName: channel.displayName,
        channelSlug: channel.channelSlug,
        profilePicture: channel.profilePicture,
        thumbnail: current?.thumbnail ?? null,
        viewerCount: current?.viewerCount ?? null,
        title: current?.title ?? null,
        gameName: channel.declaredGame?.name ?? null,
        isLive: isLiveNow(channel),
      };
    })
    .filter((x) => x.isLive)
    .map(({ isLive: _isLive, ...streamer }) => streamer);
}
