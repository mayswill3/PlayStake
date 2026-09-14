'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, Scale } from 'lucide-react';
import { formatCents } from '@/lib/utils/format';
import {
  ParticipantAvatar,
  PhaseBadge,
  StreamThumbnail,
  heroThumbnail,
  matchTitle,
  useLiveMatches,
  withCacheBust,
  type SpectatorMatch,
} from './live-matches';

const AUTO_ADVANCE_MS = 7_000;

/**
 * Dashboard hero: a slideshow of refereed stream matches happening right now.
 * Renders nothing when no match is live, so the dashboard is unchanged then.
 */
export function LiveMatchesCarousel() {
  const { matches, refreshKey } = useLiveMatches();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const count = matches?.length ?? 0;
  const current = count > 0 ? Math.min(index, count - 1) : 0;

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (count < 2 || paused || reducedMotion) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [count, paused, reducedMotion]);

  if (!matches || count === 0) return null;
  const go = (next: number) => setIndex(((next % count) + count) % count);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Live matches"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ps-text dark:text-ps-text-on-dark">
          <span className="h-2 w-2 rounded-full bg-ps-error animate-pulse" aria-hidden="true" />
          Live matches
          <span className="font-mono text-xs font-normal text-ps-muted dark:text-ps-muted-on-dark">{count}</span>
        </h2>
        <div className="flex items-center gap-3">
          {count > 1 && (
            // Controls sit in the header rather than on the slide, so they never
            // cover the slide copy or the player previews at any width.
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => go(current - 1)}
                aria-label="Previous live match"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--ps-border-light)] text-ps-text transition-colors hover:border-ps-lime/60 dark:border-[var(--ps-border-dark)] dark:text-ps-text-on-dark"
              >
                <ChevronLeft size={15} />
              </button>
              {matches.map((match, i) => (
                <button
                  key={match.betId}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Show live match ${i + 1}`}
                  aria-current={i === current}
                  className={`h-1.5 rounded-full transition-all ${
                    i === current ? 'w-5 bg-ps-lime' : 'w-1.5 bg-ps-muted/40 hover:bg-ps-muted dark:bg-white/30'
                  }`}
                />
              ))}
              <button
                type="button"
                onClick={() => go(current + 1)}
                aria-label="Next live match"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--ps-border-light)] text-ps-text transition-colors hover:border-ps-lime/60 dark:border-[var(--ps-border-dark)] dark:text-ps-text-on-dark"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}
          <Link href="/watch" className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-ps-lime hover:gap-2 transition-all">
            See all <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-dark)] bg-ps-ink">
        <div
          className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {matches.map((match, i) => (
            <Slide
              key={match.betId}
              match={match}
              refreshKey={refreshKey}
              hidden={i !== current}
              label={`${i + 1} of ${count}`}
            />
          ))}
        </div>

      </div>
    </section>
  );
}

function Slide({
  match,
  refreshKey,
  hidden,
  label,
}: {
  match: SpectatorMatch;
  refreshKey: number;
  hidden: boolean;
  label: string;
}) {
  const players = [match.playerA, ...(match.playerB ? [match.playerB] : [])];

  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={label}
      aria-hidden={hidden}
      className="relative w-full shrink-0"
    >
      <Link
        href={`/watch/${match.betId}`}
        tabIndex={hidden ? -1 : undefined}
        className="group relative flex min-h-[240px] w-full sm:aspect-[21/8] sm:min-h-0"
      >
        <StreamThumbnail
          src={withCacheBust(heroThumbnail(match), refreshKey)}
          alt=""
          className="absolute inset-0 h-full w-full transition-transform duration-700 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ps-ink via-ps-ink/80 to-ps-ink/10" aria-hidden="true" />

        <div className="relative flex w-full items-end justify-between gap-6 p-5 pb-10 sm:items-center sm:p-8">
          <div className="min-w-0 max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <PhaseBadge phase={match.phase} />
              <span className="text-xs font-semibold uppercase tracking-widest text-ps-muted-on-dark">
                {match.gameName}
              </span>
            </div>
            <p className="mt-3 font-display text-2xl font-bold leading-tight text-white sm:text-4xl">
              {matchTitle(match)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ps-muted-on-dark">
              <span className="inline-flex items-center gap-1.5">
                <Scale className="h-4 w-4 text-ps-lime" aria-hidden="true" />
                {match.referee ? `Refereed by ${match.referee.displayName}` : 'Finding a referee…'}
              </span>
              <span className="font-semibold tabular-nums text-ps-lime">{formatCents(match.potCents)} pot</span>
            </div>
            <span className="mt-5 inline-flex items-center gap-2 rounded-[var(--ps-radius-md)] bg-ps-lime px-4 py-2 text-sm font-bold text-ps-ink transition-all group-hover:gap-3">
              Watch live <ArrowRight size={16} />
            </span>
          </div>

          {/* The two players' feeds, as small previews beside the referee cam. */}
          <div className="hidden w-56 shrink-0 space-y-3 lg:block">
            {players.map((player) => (
              <div key={player.displayName} className="overflow-hidden rounded-[var(--ps-radius-md)] border border-white/10 bg-black/40 backdrop-blur-sm">
                <StreamThumbnail
                  src={withCacheBust(player.thumbnail, refreshKey)}
                  alt=""
                  className="aspect-video w-full"
                />
                <div className="flex items-center gap-2 px-2.5 py-1.5">
                  <ParticipantAvatar participant={player} size="sm" />
                  <span className="truncate text-xs font-semibold text-white">{player.displayName}</span>
                  {player.isLive && (
                    <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-ps-error animate-pulse" aria-label="live" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Link>
    </div>
  );
}
