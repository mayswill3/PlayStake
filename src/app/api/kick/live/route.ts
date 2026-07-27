import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/client";
import { validateSession } from "../../../../lib/auth/session";
import { getSessionToken } from "../../../../lib/auth/helpers";
import { fetchPublicChannels } from "../../../../lib/kick/api";
import { errorResponse, AuthenticationError } from "../../../../lib/errors/index";

export const dynamic = "force-dynamic";

/**
 * Return PlayStake users whose linked Kick channel is currently live.
 *
 * Poll every linked channel through Kick's public API so newly-live channels
 * are discoverable even when webhooks cannot reach the app (for example during
 * local development). The webhook-maintained DB flag remains a fallback when
 * Kick's API is unavailable, and successful polls synchronize that flag.
 */
export async function GET(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const linkedChannels = await prisma.kickAccount.findMany({
      where: { channelSlug: { not: null } },
      select: {
        id: true,
        channelSlug: true,
        displayName: true,
        profilePicture: true,
        isLive: true,
      },
      take: 50,
    });

    if (linkedChannels.length === 0) {
      return NextResponse.json({ live: [] });
    }

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

    if (enriched) {
      const newlyLiveIds = linkedChannels
        .filter((channel) => {
          const current = channel.channelSlug
            ? enrich[channel.channelSlug.toLowerCase()]
            : undefined;
          return !channel.isLive && Boolean(current?.isLive);
        })
        .map((channel) => channel.id);
      const newlyOfflineIds = linkedChannels
        .filter((channel) => {
          const current = channel.channelSlug
            ? enrich[channel.channelSlug.toLowerCase()]
            : undefined;
          return channel.isLive && !current?.isLive;
        })
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
        await Promise.all(updates);
      } catch (err) {
        // Discovery should still succeed if persisting the refreshed flag fails.
        console.error("Kick live-state synchronization failed:", err);
      }
    }

    const live = linkedChannels
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
          isLive: enriched ? current?.isLive ?? false : channel.isLive,
        };
      })
      .filter((x) => x.isLive);

    return NextResponse.json({ live });
  } catch (error) {
    return errorResponse(error);
  }
}
