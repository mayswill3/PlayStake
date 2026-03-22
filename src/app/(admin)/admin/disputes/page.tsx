'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCents, formatDate } from '@/lib/utils/format';

interface DisputeListItem {
  id: string;
  status: string;
  reason: string;
  createdAt: string;
  bet: {
    id: string;
    amount: number;
    game: { name: string };
  };
  filedBy: {
    id: string;
    displayName: string;
    email: string;
  };
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'RESOLVED_PLAYER_A', label: 'Resolved (A)' },
  { value: 'RESOLVED_PLAYER_B', label: 'Resolved (B)' },
  { value: 'RESOLVED_DRAW', label: 'Resolved (Draw)' },
  { value: 'RESOLVED_VOID', label: 'Voided' },
];

const disputeVariant = (status: string) => {
  if (status === 'OPEN') return 'warning' as const;
  if (status === 'UNDER_REVIEW') return 'info' as const;
  if (status.startsWith('RESOLVED')) return 'success' as const;
  return 'neutral' as const;
};

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<DisputeListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/admin/disputes?${params}`);
      if (!res.ok) throw new Error('Failed to load disputes');
      const data = await res.json();
      setDisputes(data.data);
      setTotalPages(data.pagination.totalPages);
    } catch {
      setError('Failed to load disputes.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-surface-100">Dispute Management</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setStatusFilter(opt.value); setPage(1); }}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${statusFilter === opt.value
                ? 'bg-brand-600/15 text-brand-400 border border-brand-500/25'
                : 'text-surface-400 hover:text-surface-200 border border-surface-700 hover:border-surface-600'
              }
            `}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-danger-500/10 border border-danger-500/25 text-danger-300 text-sm">
          {error}
        </div>
      ) : disputes.length === 0 ? (
        <Card>
          <EmptyState
            title="No disputes found"
            description={statusFilter !== 'all'
              ? 'No disputes match the selected filter.'
              : 'No disputes have been filed yet.'}
          />
        </Card>
      ) : (
        <>
          <Card padding="none" className="hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase text-surface-400 border-b border-surface-800">
                  <tr>
                    <th className="px-4 py-3">Game</th>
                    <th className="px-4 py-3">Filed By</th>
                    <th className="px-4 py-3">Bet Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  {disputes.map((d) => (
                    <tr key={d.id} className="hover:bg-surface-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/admin/disputes/${d.id}`} className="text-surface-200 hover:text-brand-400 transition-colors font-medium">
                          {d.bet.game.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-surface-400">{d.filedBy.displayName}</td>
                      <td className="px-4 py-3 text-surface-200 font-medium">
                        {formatCents(Number(d.bet.amount))}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={disputeVariant(d.status)}>
                          {d.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-surface-400 max-w-xs truncate">{d.reason}</td>
                      <td className="px-4 py-3 text-surface-400">{formatDate(d.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="px-4 pb-4">
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </Card>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {disputes.map((d) => (
              <Link key={d.id} href={`/admin/disputes/${d.id}`}>
                <Card className="hover:border-surface-700 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-surface-200 truncate">{d.bet.game.name}</p>
                      <p className="text-xs text-surface-500 mt-0.5">
                        Filed by {d.filedBy.displayName} &middot; {formatDate(d.createdAt)}
                      </p>
                    </div>
                    <Badge variant={disputeVariant(d.status)}>
                      {d.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <p className="text-xs text-surface-400 mt-2 line-clamp-2">{d.reason}</p>
                </Card>
              </Link>
            ))}
            {totalPages > 1 && (
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
