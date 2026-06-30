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
 * "Who is live" comes from our own DB (kept current by the livestream webhook).
 * We then best-effort enrich each with the live thumbnail + viewer count via
 * Kick's public channels API (app token). If that enrichment confirms a channel
 * is NOT live, we drop it — self-healing any stale is_live flag.
 */
export async function GET(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const candidates = await prisma.kickAccount.findMany({
      where: { isLive: true, channelSlug: { not: null } },
      select: { channelSlug: true, displayName: true, profilePicture: true },
      take: 50,
    });

    if (candidates.length === 0) {
      return NextResponse.json({ live: [] });
    }

    const slugs = candidates
      .map((c) => c.channelSlug)
      .filter((s): s is string => Boolean(s));

    const enrich: Record<
      string,
      { isLive: boolean; viewerCount: number | null; thumbnail: string | null; title: string | null }
    > = {};
    let enriched = false;
    try {
      const channels = await fetchPublicChannels(slugs);
      enriched = true;
      for (const ch of channels) {
        enrich[ch.slug] = {
          isLive: ch.stream?.is_live ?? false,
          viewerCount: ch.stream?.viewer_count ?? null,
          thumbnail: ch.stream?.thumbnail ?? null,
          title: ch.stream_title ?? null,
        };
      }
    } catch (err) {
      console.error("Kick live enrichment failed:", err);
    }

    const live = candidates
      .map((c) => {
        const e = c.channelSlug ? enrich[c.channelSlug] : undefined;
        return {
          displayName: c.displayName,
          channelSlug: c.channelSlug,
          profilePicture: c.profilePicture,
          thumbnail: e?.thumbnail ?? null,
          viewerCount: e?.viewerCount ?? null,
          title: e?.title ?? null,
          // Trust the live API when we have it; otherwise fall back to our flag.
          isLive: enriched ? e?.isLive ?? false : true,
        };
      })
      .filter((x) => x.isLive);

    return NextResponse.json({ live });
  } catch (error) {
    return errorResponse(error);
  }
}
