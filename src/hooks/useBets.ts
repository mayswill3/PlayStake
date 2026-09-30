'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Bet {
  id: string;
  gameId: string;
  gameName: string;
  opponent: { id: string; displayName: string } | null;
  amount: number;
  status: string;
  outcome: string | null;
  myRole: string;
  netResult: number | null;
  createdAt: string;
  settledAt: string | null;
  /** When escrow is due to release; null unless the bet is on that clock. */
  resolvesAt: string | null;
}

/** While a listed bet is counting down to payout, refresh so it flips to settled. */
const RESOLVING_REFRESH_MS = 15_000;

interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

interface UseBetsOptions {
  page?: number;
  limit?: number;
  status?: string;
  gameId?: string;
}

export function useBets(options: UseBetsOptions = {}) {
  const { page = 1, limit = 20, status, gameId } = options;
  const [bets, setBets] = useState<Bet[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBets = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (status && status !== 'all') params.set('status', status);
      if (gameId) params.set('gameId', gameId);

      const res = await fetch(`/api/bets?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch bets');
      const data = await res.json();
      setBets(data.data);
      setPagination(data.pagination);
    } catch (err) {
      // A missed background refresh keeps the list on screen; the next tick retries.
      if (!quiet) setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [page, limit, status, gameId]);

  useEffect(() => {
    fetchBets();
  }, [fetchBets]);

  const resolving = bets.some((bet) => bet.resolvesAt !== null);
  useEffect(() => {
    if (!resolving) return;
    const timer = window.setInterval(() => void fetchBets(true), RESOLVING_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [resolving, fetchBets]);

  return { bets, pagination, loading, error, refresh: () => fetchBets() };
}
