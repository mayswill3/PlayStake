'use client';

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'playstake-sound-enabled';

export function useSoundEnabled() {
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'false') setIsMuted(true);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'false' : 'true');
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }, []);

  return { isMuted, toggleMute };
}
