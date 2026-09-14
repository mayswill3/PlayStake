'use client';

import Link from 'next/link';
import { Radio } from 'lucide-react';
import { FadeIn } from '@/components/ui/FadeIn';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { LiveMatchCard, useLiveMatches } from '@/components/matches/live-matches';

export default function WatchIndexPage() {
  const { matches, refreshKey } = useLiveMatches();

  return (
    <FadeIn>
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.22em] text-ps-lime">Spectate</p>
          <h1 className="font-display text-3xl font-bold text-ps-text dark:text-ps-text-on-dark">Watch live</h1>
          <p className="mt-2 text-ps-muted dark:text-ps-muted-on-dark">
            Refereed stream matches happening right now — both players and the referee, live on Kick.
          </p>
        </div>

        {matches === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-[var(--ps-radius-lg)] bg-ps-paper-elevated dark:bg-ps-ink-2" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] bg-ps-paper-elevated px-6 py-16 text-center dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-[var(--ps-radius-lg)] bg-ps-paper text-ps-muted dark:bg-ps-ink-3 dark:text-ps-muted-on-dark">
              <Radio size={22} />
            </div>
            <p className="font-medium text-ps-text dark:text-ps-text-on-dark">No live matches right now</p>
            <p className="mt-1 text-sm text-ps-muted dark:text-ps-muted-on-dark">
              When two streamers start a refereed match, it shows up here.
            </p>
            <Link href="/play" className="mt-5 inline-block">
              <PSButton variant="primary">Start your own</PSButton>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((match) => (
              <LiveMatchCard key={match.betId} match={match} refreshKey={refreshKey} />
            ))}
          </div>
        )}
      </div>
    </FadeIn>
  );
}
