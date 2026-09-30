import { NextResponse } from "next/server";
import {
  listLiveMatches,
  matchViewerCount,
  pickFeaturedMatch,
  type SpectatorMatch,
} from "@/lib/matches/spectator";

export const dynamic = "force-dynamic";

/**
 * How long one lookup serves every visitor. The homepage is public, so without
 * this each page view would hit the database and Kick's API.
 */
const CACHE_MS = 20_000;

type Featured = { match: SpectatorMatch; viewerCount: number } | null;

let cached: { at: number; value: Promise<Featured> } | undefined;

function loadFeatured(): Promise<Featured> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) return cached.value;
  const value = listLiveMatches().then((matches) => {
    const match = pickFeaturedMatch(matches);
    return match ? { match, viewerCount: matchViewerCount(match) } : null;
  });
  cached = { at: now, value };
  // Don't serve a failure for the whole window; let the next request retry.
  value.catch(() => {
    if (cached?.value === value) cached = undefined;
  });
  return value;
}

/**
 * GET /api/matches/featured — public, for the homepage hero.
 *
 * The in-progress refereed stream match with the most viewers, or null when
 * none is live. Everything here is already public on Kick: both players and
 * the referee broadcast the match on their channels.
 */
export async function GET() {
  try {
    const featured = await loadFeatured();
    return NextResponse.json(
      { featured },
      { headers: { "Cache-Control": "public, max-age=10" } },
    );
  } catch (error) {
    console.error("Featured match lookup failed:", error);
    // The hero falls back to its static preview; never break the homepage.
    return NextResponse.json({ featured: null }, { status: 200 });
  }
}
