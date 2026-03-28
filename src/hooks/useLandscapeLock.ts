'use client';

import { useEffect } from 'react';

export function useLandscapeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const isMobile = window.matchMedia('(max-width: 1024px)').matches;
    if (!isMobile) return;

    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
      unlock?: () => void;
    };

    const lock = async () => {
      try {
        await orientation.lock?.('landscape');
      } catch {
        // Orientation API not supported or permission denied
      }
    };

    lock();

    return () => {
      try {
        orientation.unlock?.();
      } catch {}
    };
  }, [enabled]);
}
