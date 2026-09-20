'use client';

// =============================================================================
// PlayStake — Rematch
// =============================================================================
// A finished bet is a dead end today: the match settles and the only way to
// play the same person again is to remember their channel and navigate there
// by hand. This puts the next match one click from the last one.
//
// A challenge resolves the game server-side from the opponent's declared game,
// so it can only be issued while they are live. When they aren't, this says so
// plainly rather than offering a button that would fail.
// =============================================================================

import Link from 'next/link';
import { Card, CardTitle } from '@/components/ui/Card';

interface RematchOpponent {
  id: string;
  displayName: string;
  kick: { channelSlug: string; isLive: boolean } | null;
}

/** Bet states where the match is over and a rematch makes sense. */
const FINISHED_STATUSES = ['SETTLED', 'CANCELLED', 'VOIDED', 'EXPIRED'];

export function isRematchable(status: string): boolean {
  return FINISHED_STATUSES.includes(status);
}

export function RematchCard({ opponent }: { opponent: RematchOpponent | null }) {
  // An unmatched bet has no opponent to rematch.
  if (!opponent) return null;

  const channelSlug = opponent.kick?.channelSlug ?? null;
  const isLive = opponent.kick?.isLive ?? false;

  return (
    <Card>
      <CardTitle className="mb-1">Play again</CardTitle>

      {channelSlug && isLive ? (
        <>
          <p className="text-sm text-ps-muted dark:text-ps-muted-on-dark mb-4">
            {opponent.displayName} is live right now.
          </p>
          <Link
            href={`/streams/${channelSlug}`}
            className="inline-flex items-center justify-center w-full px-4 min-h-[44px] rounded-lg text-sm font-medium bg-brand-400 text-ps-ink hover:bg-brand-500 transition-colors"
          >
            Challenge {opponent.displayName} again
          </Link>
        </>
      ) : channelSlug ? (
        <>
          <p className="text-sm text-ps-muted dark:text-ps-muted-on-dark mb-4">
            {opponent.displayName} is offline. You can challenge them from their
            channel once they go live.
          </p>
          <Link
            href={`/streams/${channelSlug}`}
            className="inline-flex items-center justify-center w-full px-4 min-h-[44px] rounded-lg text-sm font-medium border border-brand-500/30 text-brand-400 hover:border-brand-500/60 hover:text-brand-300 transition-colors"
          >
            View channel
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm text-ps-muted dark:text-ps-muted-on-dark mb-4">
            {opponent.displayName} has no linked Kick channel, so they can&apos;t
            be challenged directly.
          </p>
          <Link
            href="/play"
            className="inline-flex items-center justify-center w-full px-4 min-h-[44px] rounded-lg text-sm font-medium border border-brand-500/30 text-brand-400 hover:border-brand-500/60 hover:text-brand-300 transition-colors"
          >
            Find a new match
          </Link>
        </>
      )}
    </Card>
  );
}
