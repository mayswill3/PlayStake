'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Radio, X } from 'lucide-react';
import { useLiveStatusEvents } from '@/hooks/useLiveStatusEvents';
import type { FollowedStreamer } from './useFollowing';

/** How long an alert stays up before it hides itself. */
const ALERT_MS = 12_000;

/**
 * In-app alert when someone you follow goes live. The server returns nothing
 * while you're on a break, self-excluded or restricted, so no alert appears
 * then. Streamers already live when the page opens don't trigger an alert;
 * only a change while you're here does.
 */
export function FollowLiveAlerts() {
  const seen = useRef<Set<string> | null>(null);
  const [alert, setAlert] = useState<FollowedStreamer | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/follows/live', { cache: 'no-store' });
      if (!res.ok) return;
      const { live } = (await res.json()) as { live: FollowedStreamer[] };
      const ids = new Set(live.map((streamer) => streamer.streamerId));
      if (seen.current) {
        const fresh = live.find((streamer) => !seen.current!.has(streamer.streamerId));
        if (fresh) setAlert(fresh);
      }
      seen.current = ids;
    } catch {
      /* try again on the next event or poll */
    }
  }, []);

  useEffect(() => {
    void check();
    const timer = window.setInterval(() => void check(), 60_000);
    return () => window.clearInterval(timer);
  }, [check]);
  useLiveStatusEvents(check);

  useEffect(() => {
    if (!alert) return;
    const timer = window.setTimeout(() => setAlert(null), ALERT_MS);
    return () => window.clearTimeout(timer);
  }, [alert]);

  if (!alert) return null;
  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 z-50 flex w-[calc(100%-2rem)] max-w-sm items-center gap-3 rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] bg-ps-paper-elevated p-4 shadow-2xl dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2 lg:bottom-6 lg:left-6"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-500">
        <Radio className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ps-text dark:text-ps-text-on-dark">
          {alert.displayName} is live
        </p>
        <p className="truncate text-xs text-ps-muted dark:text-ps-muted-on-dark">
          {alert.gameName ? `Playing ${alert.gameName}` : 'Streaming on Kick'}
        </p>
      </div>
      <Link
        href={`/streams/${alert.channelSlug}`}
        onClick={() => setAlert(null)}
        className="shrink-0 rounded-[var(--ps-radius-md)] bg-[var(--ps-lime)] px-3 py-1.5 text-xs font-bold text-ps-ink"
      >
        Watch
      </Link>
      <button
        type="button"
        onClick={() => setAlert(null)}
        aria-label="Dismiss"
        className="shrink-0 text-ps-muted hover:text-ps-text dark:text-ps-muted-on-dark dark:hover:text-ps-text-on-dark"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
