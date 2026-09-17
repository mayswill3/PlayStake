'use client';

import { useCallback, useEffect, useState } from 'react';

export interface KickStatus {
  connected: boolean;
  channelSlug?: string | null;
  displayName?: string | null;
  isLive?: boolean;
  /** Game declared on PlayStake — what viewers can challenge them to. */
  declaredGameName?: string | null;
}

/** Re-check live status so Kick controls flip to Live without a reload. */
const STATUS_POLL_MS = 30_000;
const CHANGED_EVENT = 'playstake:kick-status-changed';

/**
 * Tell every Kick control on the page (sidebar card, Go Live banner, stream
 * page) that the user's Kick status or declared game just changed, so they
 * refetch now instead of on their next poll.
 */
export function notifyKickStatusChanged() {
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

/** Run `callback` whenever another control reports a Kick status change. */
export function useOnKickStatusChanged(callback: () => void) {
  useEffect(() => {
    window.addEventListener(CHANGED_EVENT, callback);
    return () => window.removeEventListener(CHANGED_EVENT, callback);
  }, [callback]);
}

/** The signed-in user's Kick connection, live state and declared game. */
export function useKickStatus() {
  const [status, setStatus] = useState<KickStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/user/kick', { cache: 'no-store' });
      setStatus(response.ok ? await response.json() : { connected: false });
    } catch {
      setStatus((current) => current ?? { connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useOnKickStatusChanged(refresh);

  return { status, setStatus, loading, refresh };
}

/**
 * Go offline on PlayStake: clear the declared game so no new challenges come
 * in. Throws with the server's message (e.g. refused mid-match). It can't end
 * the Kick broadcast itself.
 */
export async function goOfflineOnPlayStake() {
  const response = await fetch('/api/user/declared-game', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameType: null }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Could not go offline.');
  }
  notifyKickStatusChanged();
}

export const GO_OFFLINE_TOAST =
  'You’re offline on PlayStake — challenges are paused. End the broadcast on Kick to stop streaming.';
