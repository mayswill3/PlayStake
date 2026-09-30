'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Eye, Scale } from 'lucide-react';
import { MatchPreview, PhoneMockup } from '@/components/ui/playstake';
import {
  ParticipantAvatar,
  PhaseBadge,
  StreamThumbnail,
  heroThumbnail,
  matchTitle,
  withCacheBust,
  type SpectatorMatch,
} from '@/components/matches/live-matches';
import { formatCents, formatNumber } from '@/lib/utils/format';

type Featured = { match: SpectatorMatch; viewerCount: number } | null;

/** Re-check for a live match (and refresh its thumbnail) this often. */
const POLL_MS = 30_000;
/** The desktop frame and mobile preview mount together; share one request. */
const DEDUPE_MS = 5_000;

let shared: { at: number; promise: Promise<Featured> } | null = null;

function fetchFeatured(): Promise<Featured> {
  if (shared && Date.now() - shared.at < DEDUPE_MS) return shared.promise;
  const promise = fetch('/api/matches/featured', { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : { featured: null }))
    .then((data) => (data.featured ?? null) as Featured)
    .catch(() => null);
  shared = { at: Date.now(), promise };
  return promise;
}

/** The most-watched live match, or null (show the static preview) when none. */
function useFeaturedMatch() {
  const [featured, setFeatured] = useState<Featured>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetchFeatured().then((next) => {
        if (!active) return;
        setFeatured(next);
        setRefreshKey((key) => key + 1);
      });
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return { featured, refreshKey };
}

function Watching({ count, className = '' }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white ${className}`}
    >
      <Eye className="h-3 w-3" aria-hidden="true" />
      {formatNumber(count)} watching
    </span>
  );
}

/**
 * Desktop hero: a wide feature card for the most-watched live match — the
 * referee cam large, both players' feeds beneath — or the phone mockup when
 * nothing is live. The card stretches to the height of the hero's text column
 * and the referee cam absorbs the difference, so the two always line up.
 */
export function HeroFeature() {
  const { featured, refreshKey } = useFeaturedMatch();
  if (!featured) return <PhoneMockup />;

  const { match, viewerCount } = featured;
  const players = [match.playerA, ...(match.playerB ? [match.playerB] : [])];

  return (
    <Link
      href={`/watch/${match.betId}`}
      aria-label={`Watch ${matchTitle(match)} live — ${match.gameName}`}
      className="group relative flex h-full w-full max-w-xl flex-col overflow-hidden rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-dark)] bg-ps-ink text-left transition-colors hover:border-ps-lime/50"
      style={{ boxShadow: 'var(--ps-glow-lg)' }}
    >
      {/* Referee cam, large, with the match headline over it. */}
      <div className="relative min-h-[180px] flex-1 overflow-hidden">
        <StreamThumbnail
          src={withCacheBust(heroThumbnail(match), refreshKey)}
          alt=""
          className="absolute inset-0 h-full w-full transition-transform duration-700 group-hover:scale-[1.02]"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-ps-ink via-ps-ink/40 to-transparent"
          aria-hidden="true"
        />
        <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PhaseBadge phase={match.phase} />
            <span className="rounded bg-black/60 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-white">
              {match.gameName}
            </span>
          </div>
          <Watching count={viewerCount} />
        </div>
        <div className="absolute bottom-4 left-5 right-5">
          <p className="font-display text-3xl font-bold leading-tight text-white">{matchTitle(match)}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ps-muted-on-dark">
            <Scale className="h-4 w-4 shrink-0 text-ps-lime" aria-hidden="true" />
            {match.referee ? `Refereed by ${match.referee.displayName}` : 'Finding a referee…'}
          </p>
        </div>
      </div>

      {/* The two players' feeds side by side, as compact previews. */}
      <div className="grid shrink-0 grid-cols-2 gap-3 px-5 pt-4">
        {players.map((player) => (
          <div
            key={player.displayName}
            className="flex items-center gap-2.5 overflow-hidden rounded-[var(--ps-radius-md)] border border-white/10 bg-white/[0.03] pr-2.5"
          >
            <StreamThumbnail
              src={withCacheBust(player.thumbnail, refreshKey)}
              alt=""
              className="aspect-video w-24 shrink-0"
            />
            <ParticipantAvatar participant={player} size="sm" />
            <span className="truncate text-xs font-semibold text-white">{player.displayName}</span>
            {player.isLive && (
              <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-ps-error animate-pulse" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-ps-muted-on-dark">Pot</p>
          <p className="font-display text-2xl font-bold tabular-nums text-ps-lime">{formatCents(match.potCents)}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-[var(--ps-radius-md)] bg-ps-lime px-5 py-2.5 text-sm font-bold text-ps-ink transition-all group-hover:gap-3">
          Watch live <ArrowRight size={16} />
        </span>
      </div>
    </Link>
  );
}

/** Mobile hero: the frameless preview, showing the most-watched live match if any. */
export function HeroMobilePreview() {
  const { featured, refreshKey } = useFeaturedMatch();
  if (!featured) return <MatchPreview variant="bare" />;

  const { match, viewerCount } = featured;

  return (
    <Link
      href={`/watch/${match.betId}`}
      aria-label={`Watch ${matchTitle(match)} live — ${match.gameName}`}
      className="group block overflow-hidden rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-dark)] bg-ps-ink text-left"
    >
      <div className="relative">
        <StreamThumbnail
          src={withCacheBust(heroThumbnail(match), refreshKey)}
          alt=""
          className="aspect-video w-full"
        />
        <PhaseBadge phase={match.phase} className="absolute left-2 top-2" />
        <Watching count={viewerCount} className="absolute right-2 top-2" />
      </div>
      <div className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-ps-muted-on-dark">{match.gameName}</p>
        <p className="mt-1 font-display text-lg font-bold leading-tight text-white">{matchTitle(match)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ps-muted-on-dark">
          <span className="inline-flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5 text-ps-lime" aria-hidden="true" />
            {match.referee ? `Refereed by ${match.referee.displayName}` : 'Finding a referee…'}
          </span>
          <span className="font-semibold tabular-nums text-ps-lime">{formatCents(match.potCents)} pot</span>
        </div>
        <span className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[var(--ps-radius-md)] bg-ps-lime px-4 py-2.5 text-sm font-bold text-ps-ink transition-all group-hover:gap-3">
          Watch live <ArrowRight size={16} />
        </span>
      </div>
    </Link>
  );
}
