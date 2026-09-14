'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Radio, Scale } from 'lucide-react';
import type {
  SpectatorMatch,
  SpectatorParticipant,
  SpectatorPhase,
} from '@/lib/matches/spectator';
import { formatCents } from '@/lib/utils/format';

export type { SpectatorMatch, SpectatorParticipant, SpectatorPhase };

/** Phases that are still "happening" — spectator views keep polling in these. */
export const ACTIVE_PHASES: SpectatorPhase[] = ['LIVE', 'STARTING', 'FINDING_REFEREE', 'IN_REVIEW'];

const PHASE_STYLE: Record<SpectatorPhase, { label: string; className: string; pulse: boolean }> = {
  LIVE: { label: 'Live', className: 'bg-ps-error text-white', pulse: true },
  STARTING: { label: 'Starting soon', className: 'bg-ps-warning text-ps-ink', pulse: true },
  FINDING_REFEREE: { label: 'Finding referee', className: 'bg-ps-warning text-ps-ink', pulse: true },
  IN_REVIEW: { label: 'Result in review', className: 'bg-ps-cyan text-ps-ink', pulse: false },
  DISPUTED: { label: 'Disputed', className: 'bg-ps-error text-white', pulse: false },
  FINISHED: { label: 'Finished', className: 'bg-ps-lime text-ps-ink', pulse: false },
  VOIDED: { label: 'Voided', className: 'bg-ps-ink-3 text-white', pulse: false },
};

export function PhaseBadge({ phase, className = '' }: { phase: SpectatorPhase; className?: string }) {
  const style = PHASE_STYLE[phase];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${style.className} ${className}`}
    >
      {style.pulse && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" aria-hidden="true" />}
      {style.label}
    </span>
  );
}

/**
 * Polls the live-match list. `null` until the first response. `refreshKey`
 * bumps on each poll so thumbnails that weren't generated yet get retried.
 */
export function useLiveMatches(pollMs = 30_000) {
  const [matches, setMatches] = useState<SpectatorMatch[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch('/api/matches/live', { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : { matches: [] }))
        .then((data) => {
          if (!active) return;
          setMatches(data.matches ?? []);
          setRefreshKey((key) => key + 1);
        })
        .catch(() => active && setMatches((current) => current ?? []));
    void load();
    const timer = window.setInterval(() => void load(), pollMs);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [pollMs]);

  return { matches, refreshKey };
}

/** The best still image for a match: the referee cam, else a player's stream. */
export function heroThumbnail(match: SpectatorMatch): string | null {
  return match.referee?.thumbnail ?? match.playerA.thumbnail ?? match.playerB?.thumbnail ?? null;
}

export function withCacheBust(url: string | null, refreshKey: number): string | null {
  if (!url) return null;
  return `${url}${url.includes('?') ? '&' : '?'}_=${refreshKey}`;
}

/** A Kick thumbnail that falls back to a branded placeholder while unavailable. */
export function StreamThumbnail({
  src,
  alt,
  className = '',
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const usable = src && src !== failedSrc ? src : null;
  return usable ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={usable} alt={alt} onError={() => setFailedSrc(usable)} className={`object-cover ${className}`} />
  ) : (
    <div
      className={`flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--ps-lime)_22%,transparent),transparent_60%),linear-gradient(135deg,var(--ps-ink-2),var(--ps-ink))] text-ps-muted-on-dark ${className}`}
      role="img"
      aria-label={alt}
    >
      <Radio className="h-6 w-6" aria-hidden="true" />
    </div>
  );
}

export function ParticipantAvatar({
  participant,
  size = 'md',
}: {
  participant: SpectatorParticipant;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dimension = size === 'lg' ? 'h-14 w-14 text-lg' : size === 'md' ? 'h-9 w-9 text-sm' : 'h-6 w-6 text-[10px]';
  return participant.profilePicture ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={participant.profilePicture} alt="" className={`${dimension} shrink-0 rounded-full object-cover`} />
  ) : (
    <span
      className={`${dimension} flex shrink-0 items-center justify-center rounded-full bg-ps-lime/15 font-bold text-ps-lime`}
      aria-hidden="true"
    >
      {participant.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function matchTitle(match: SpectatorMatch): string {
  return `${match.playerA.displayName} vs ${match.playerB?.displayName ?? 'TBD'}`;
}

/** Grid card for a live match — the /watch index and "more live matches". */
export function LiveMatchCard({ match, refreshKey }: { match: SpectatorMatch; refreshKey: number }) {
  return (
    <Link
      href={`/watch/${match.betId}`}
      className="group block overflow-hidden rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] bg-ps-paper-elevated transition-colors hover:border-ps-lime/50 dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2"
    >
      <div className="relative aspect-video overflow-hidden bg-black">
        <StreamThumbnail
          src={withCacheBust(heroThumbnail(match), refreshKey)}
          alt={`${matchTitle(match)} live`}
          className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <PhaseBadge phase={match.phase} className="absolute left-2 top-2" />
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
          {formatCents(match.potCents)} pot
        </span>
      </div>
      <div className="p-4">
        <p className="truncate font-display font-semibold text-ps-text dark:text-ps-text-on-dark">{matchTitle(match)}</p>
        <p className="mt-0.5 truncate text-xs text-ps-muted dark:text-ps-muted-on-dark">{match.gameName}</p>
        <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-ps-muted dark:text-ps-muted-on-dark">
          <Scale className="h-3.5 w-3.5 shrink-0 text-ps-lime" aria-hidden="true" />
          {match.referee ? `Refereed by ${match.referee.displayName}` : 'Finding a referee…'}
        </p>
      </div>
    </Link>
  );
}
