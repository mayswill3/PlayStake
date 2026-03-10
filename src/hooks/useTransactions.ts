'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Transaction {
  id: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  description: string;
  createdAt: string;
  completedAt: string | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

interface UseTransactionsOptions {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
}

export function useTransactions(options: UseTransactionsOptions = {}) {
  const { page = 1, limit = 20, type, status } = options;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (type && type !== 'all') params.set('type', type);
      if (status && status !== 'all') params.set('status', status);

      const res = await fetch(`/api/wallet/transactions?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      setTransactions(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, type, status]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return { transactions, pagination, loading, error, refresh: fetchTransactions };
}
