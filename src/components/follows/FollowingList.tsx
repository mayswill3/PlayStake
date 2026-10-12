'use client';

import Link from 'next/link';
import { BellPlus } from 'lucide-react';
import { useFollowing, type FollowedStreamer } from './useFollowing';

function Avatar({ streamer }: { streamer: FollowedStreamer }) {
  return (
    <span
      className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ps-lime/15 font-display font-bold ${
        streamer.isLive ? 'ring-2 ring-rose-500' : ''
      }`}
    >
      {streamer.profilePicture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={streamer.profilePicture} alt="" className="h-full w-full object-cover" />
      ) : (
        streamer.displayName.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

/**
 * The streamers you follow, live first. `compact` is a single scrolling row
 * for the dashboard; the full version is a grid for Watch Live.
 */
export function FollowingList({ compact = false }: { compact?: boolean }) {
  const following = useFollowing();
  if (following === null) return null;

  if (following.length === 0) {
    if (compact) return null;
    return (
      <div className="flex items-start gap-3 rounded-[var(--ps-radius-lg)] border border-dashed border-[var(--ps-border-light)] p-4 text-sm text-ps-muted dark:border-[var(--ps-border-dark)] dark:text-ps-muted-on-dark">
        <BellPlus className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p>
          Follow streamers from their page to see them here and hear when they go live.
        </p>
      </div>
    );
  }

  return (
    <section aria-label="Streamers you follow">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-bold text-ps-text dark:text-ps-text-on-dark">Following</h2>
        <span className="text-xs text-ps-muted dark:text-ps-muted-on-dark">
          {following.filter((s) => s.isLive).length} live now
        </span>
      </div>
      <ul className={compact ? 'flex gap-3 overflow-x-auto pb-1' : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'}>
        {following.map((streamer) => (
          <li key={streamer.streamerId} className={compact ? 'w-56 shrink-0' : ''}>
            <Link
              href={`/streams/${streamer.channelSlug}`}
              className="flex items-center gap-3 rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] bg-ps-paper-elevated p-3 transition-colors hover:border-[var(--ps-lime)] dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2"
            >
              <Avatar streamer={streamer} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ps-text dark:text-ps-text-on-dark">
                  {streamer.displayName}
                </span>
                <span className="block truncate text-xs text-ps-muted dark:text-ps-muted-on-dark">
                  {streamer.isLive ? (
                    <>
                      <span className="font-semibold text-rose-500">Live</span>
                      {streamer.gameName ? ` · ${streamer.gameName}` : ''}
                    </>
                  ) : (
                    'Offline'
                  )}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
