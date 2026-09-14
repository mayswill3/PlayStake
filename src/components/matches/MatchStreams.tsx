'use client';

import { useState } from 'react';
import { Maximize2, Scale, Video } from 'lucide-react';
import { KickPlayer } from '@/components/ui/playstake/KickPlayer';

export interface StreamSource {
  name: string;
  channelSlug: string | null;
  isLive: boolean;
}

interface Feed extends StreamSource {
  key: string;
  isReferee: boolean;
}

/**
 * A refereed match's Kick feeds, with one featured as the large "main screen"
 * and the rest side by side underneath. The referee is featured by default;
 * viewers can switch the main screen to any feed.
 *
 * Every player stays at a fixed position in the DOM — switching only changes
 * CSS order and span — because moving an iframe in the DOM reloads it, which
 * would restart the stream each time the viewer switched.
 */
export function MatchStreams({
  referee,
  players,
}: {
  referee: StreamSource | null;
  players: StreamSource[];
}) {
  const [chosenKey, setChosenKey] = useState<string | null>(null);

  const feeds: Feed[] = [
    ...(referee?.channelSlug ? [{ ...referee, key: 'referee', isReferee: true }] : []),
    ...players
      .filter((player) => player.channelSlug)
      .map((player) => ({ ...player, key: `player:${player.channelSlug}`, isReferee: false })),
  ];
  if (feeds.length === 0) return null;

  // Until the viewer picks, the referee (first feed) is the main screen — so a
  // referee who joins after the page loads is promoted automatically.
  const main = feeds.find((feed) => feed.key === chosenKey) ?? feeds[0];
  const others = feeds.filter((feed) => feed !== main);

  return (
    <div className="space-y-4">
      {feeds.length > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Choose the main screen">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-widest text-ps-muted dark:text-ps-muted-on-dark">
            Main screen
          </span>
          {feeds.map((feed) => {
            const selected = feed === main;
            return (
              <button
                key={feed.key}
                type="button"
                onClick={() => setChosenKey(feed.key)}
                aria-pressed={selected}
                className={`inline-flex max-w-[12rem] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selected
                    ? 'border-ps-lime bg-ps-lime text-ps-ink'
                    : 'border-[var(--ps-border-light)] text-ps-text hover:border-ps-lime/60 dark:border-[var(--ps-border-dark)] dark:text-ps-text-on-dark'
                }`}
              >
                {feed.isReferee ? (
                  <Scale className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Video className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">{feed.isReferee ? 'Referee' : feed.name}</span>
                {feed.isLive && (
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${selected ? 'bg-ps-ink' : 'bg-ps-error'}`}
                    aria-label="live"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
        {feeds.map((feed) => {
          const isMain = feed === main;
          return (
            <div
              key={feed.key}
              style={{ order: isMain ? 0 : others.indexOf(feed) + 1 }}
              className={isMain ? 'sm:col-span-2' : others.length === 1 ? 'sm:col-span-2 sm:mx-auto sm:w-1/2' : ''}
            >
              <div className={isMain ? 'mx-auto w-full max-w-3xl' : ''}>
                <div className={`mb-2 flex items-center gap-2 ${isMain ? 'flex-wrap justify-center' : ''}`}>
                  {feed.isReferee && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-ps-lime/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-ps-lime">
                      <Scale className="h-3.5 w-3.5" aria-hidden="true" />
                      {isMain ? 'Referee cam' : 'Referee'}
                    </span>
                  )}
                  <p
                    className={`truncate font-display text-ps-text dark:text-ps-text-on-dark ${
                      isMain ? 'text-base font-semibold' : 'text-sm font-medium'
                    }`}
                  >
                    {feed.name}
                  </p>
                  <LiveBadge live={feed.isLive} />
                  {!isMain && (
                    <button
                      type="button"
                      onClick={() => setChosenKey(feed.key)}
                      className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-ps-lime transition-colors hover:bg-ps-lime/10"
                      aria-label={`Make ${feed.isReferee ? 'the referee cam' : feed.name} the main screen`}
                    >
                      <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">Make main</span>
                    </button>
                  )}
                </div>
                <div
                  className={
                    isMain
                      ? 'rounded-[calc(var(--ps-radius-md)+3px)] p-[3px] ring-1 ring-ps-lime/50 shadow-[0_0_40px_-12px_var(--ps-lime)]'
                      : ''
                  }
                >
                  <KickPlayer slug={feed.channelSlug!} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LiveBadge({ live }: { live: boolean }) {
  return live ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ps-error/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ps-error">
      <span className="h-1.5 w-1.5 rounded-full bg-ps-error animate-pulse" />
      Live
    </span>
  ) : (
    <span className="text-[10px] font-mono uppercase tracking-wider text-ps-muted dark:text-ps-muted-on-dark">
      Offline
    </span>
  );
}
