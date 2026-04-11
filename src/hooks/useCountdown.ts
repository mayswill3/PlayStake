'use client';

import { useEffect, useState } from 'react';

export interface CountdownResult {
  /** Formatted "M:SS" — useful for direct display. */
  label: string;
  /** Remaining seconds, clamped to >= 0. */
  secondsLeft: number;
  /** True once the deadline has passed or no deadline was provided. */
  isExpired: boolean;
}

function format(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * useCountdown — ticks once per second and returns the time remaining
 * until `expiresAt`. Safe for null/undefined (returns an expired state).
 */
export function useCountdown(expiresAt: string | Date | null | undefined): CountdownResult {
  const compute = (): number => {
    if (!expiresAt) return 0;
    const target = typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : expiresAt.getTime();
    return Math.max(0, Math.floor((target - Date.now()) / 1000));
  };

  const [secondsLeft, setSecondsLeft] = useState<number>(compute);

  useEffect(() => {
    setSecondsLeft(compute());
    if (!expiresAt) return;
    const id = setInterval(() => {
      setSecondsLeft(compute());
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeof expiresAt === 'string' ? expiresAt : expiresAt?.getTime?.()]);

  return {
    label: format(secondsLeft),
    secondsLeft,
    isExpired: secondsLeft <= 0,
  };
}
