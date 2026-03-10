'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Balance {
  available: number;
  escrowed: number;
  currency: string;
}

export function useBalance() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/wallet/balance');
      if (!res.ok) throw new Error('Failed to fetch balance');
      const data = await res.json();
      setBalance(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, loading, error, refresh: fetchBalance };
}
