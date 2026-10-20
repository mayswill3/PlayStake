'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLiveStatusEvents } from '@/hooks/useLiveStatusEvents';

export interface FollowedStreamer {
  streamerId: string;
  username: string | null;
  displayName: string;
  /** Null for a player who doesn't stream. */
  channelSlug: string | null;
  profilePicture: string | null;
  isLive: boolean;
  gameName: string | null;
}

/** Streamers the signed-in user follows, kept fresh as people go live. */
export function useFollowing(): FollowedStreamer[] | null {
  const [following, setFollowing] = useState<FollowedStreamer[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/follows', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { following: FollowedStreamer[] };
      setFollowing(data.following);
    } catch {
      /* keep what we have; the next event or poll retries */
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);
  useLiveStatusEvents(load);

  return following;
}
