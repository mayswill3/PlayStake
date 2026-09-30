'use client';

import { useEffect, useState } from 'react';

const cache = new Map<string, number>();

/** The platform fee for a game type, or null until known (or if unavailable). */
export function useMatchFee(gameType: string | null | undefined): number | null {
  const [fee, setFee] = useState<number | null>(() => (gameType ? cache.get(gameType) ?? null : null));

  useEffect(() => {
    if (!gameType) return;
    const known = cache.get(gameType);
    if (known !== undefined) {
      setFee(known);
      return;
    }
    let cancelled = false;
    fetch(`/api/lobby/fee?gameType=${encodeURIComponent(gameType)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { feePercent?: number } | null) => {
        if (cancelled || typeof data?.feePercent !== 'number') return;
        cache.set(gameType, data.feePercent);
        setFee(data.feePercent);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [gameType]);

  return fee;
}
