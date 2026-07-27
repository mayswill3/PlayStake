'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Radio } from 'lucide-react';

interface LiveStreamer {
  displayName: string | null;
  channelSlug: string | null;
  profilePicture: string | null;
  thumbnail: string | null;
  viewerCount: number | null;
  title: string | null;
}

export function LiveNowRail() {
  const [live, setLive] = useState<LiveStreamer[] | null>(null);
  // Bumped on each poll so cards retry thumbnails that were not ready when a
  // stream first went live instead of retaining Kick's initial 404 response.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch('/api/kick/live')
        .then((response) => (response.ok ? response.json() : { live: [] }))
        .then((data) => active && setLive(data.live ?? []))
        .catch(() => active && setLive([]));

    load();
    const intervalId = setInterval(() => {
      if (!active) return;
      setRefreshKey((key) => key + 1);
      load();
    }, 45000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <section
      aria-labelledby="live-now-title"
      className="rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] bg-ps-paper-elevated p-5 dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2"
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-ps-error animate-pulse" />
        <h2
          id="live-now-title"
          className="text-base font-display font-semibold text-ps-text dark:text-ps-text-on-dark"
        >
          Live Now
        </h2>
        {live && live.length > 0 && (
          <span className="text-xs font-mono text-ps-muted dark:text-ps-muted-on-dark">
            {live.length}
          </span>
        )}
      </div>

      {live === null ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }, (_, index) => (
            <div
              key={index}
              className="aspect-video animate-pulse rounded-[var(--ps-radius-md)] bg-ps-paper dark:bg-ps-ink-3"
            />
          ))}
        </div>
      ) : live.length === 0 ? (
        <div className="py-8 text-center">
          <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-[var(--ps-radius-lg)] bg-ps-paper text-ps-muted dark:bg-ps-ink-3 dark:text-ps-muted-on-dark">
            <Radio size={18} />
          </div>
          <p className="text-sm text-ps-muted dark:text-ps-muted-on-dark">
            No one is live right now
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {live.map((streamer) => (
            <LiveStreamerCard
              key={streamer.channelSlug}
              streamer={streamer}
              refreshKey={refreshKey}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function LiveStreamerCard({
  streamer,
  refreshKey,
}: {
  streamer: LiveStreamer;
  refreshKey: number;
}) {
  const {
    displayName,
    channelSlug,
    profilePicture,
    thumbnail,
    viewerCount,
    title,
  } = streamer;
  const [thumbFailed, setThumbFailed] = useState(false);

  useEffect(() => {
    setThumbFailed(false);
  }, [thumbnail, refreshKey]);

  if (!channelSlug) return null;

  const thumbSrc =
    thumbnail && !thumbFailed
      ? `${thumbnail}${thumbnail.includes('?') ? '&' : '?'}_=${refreshKey}`
      : null;

  return (
    <Link href={`/streams/${channelSlug}`} className="group block">
      <div className="relative aspect-video overflow-hidden rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] bg-black dark:border-[var(--ps-border-dark)]">
        {thumbSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbSrc}
            alt={`${channelSlug} live`}
            onError={() => setThumbFailed(true)}
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ps-muted-on-dark">
            <Radio size={22} />
          </div>
        )}
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded bg-ps-error px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Live
        </span>
        {viewerCount !== null && (
          <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
            {viewerCount.toLocaleString()} watching
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {profilePicture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profilePicture}
            alt=""
            className="h-6 w-6 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ps-lime/15 text-[10px] font-bold text-ps-lime">
            {(displayName || channelSlug).slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ps-text dark:text-ps-text-on-dark">
            {displayName || channelSlug}
          </p>
          {title && (
            <p className="truncate text-xs text-ps-muted dark:text-ps-muted-on-dark">
              {title}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
