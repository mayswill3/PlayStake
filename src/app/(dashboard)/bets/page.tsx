'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCents, formatDate } from '@/lib/utils/format';
import { useBets } from '@/hooks/useBets';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Bets' },
  { value: 'OPEN', label: 'Active' },
  { value: 'MATCHED', label: 'Matched' },
  { value: 'SETTLED', label: 'Settled' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'DISPUTED', label: 'Disputed' },
];

export default function BetsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');

  const { bets, pagination, loading, error } = useBets({
    page,
    limit: 20,
    status: statusFilter,
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-surface-100">Bet History</h1>

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
      ) : bets.length === 0 ? (
        <Card>
          <EmptyState
            title="No bets found"
            description={statusFilter !== 'all'
              ? 'No bets match the selected filter. Try a different status.'
              : 'You have not placed any bets yet. Start playing to see your history here.'
            }
          />
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card padding="none" className="hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase text-surface-400 border-b border-surface-800">
                  <tr>
                    <th className="px-4 py-3">Game</th>
                    <th className="px-4 py-3">Opponent</th>
                    <th className="px-4 py-3">Stake</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Result</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  {bets.map((bet) => (
                    <tr key={bet.id} className="hover:bg-surface-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/bets/${bet.id}`} className="text-surface-200 hover:text-brand-400 transition-colors font-medium">
                          {bet.gameName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-surface-400">
                        {bet.opponent?.displayName ?? 'Awaiting'}
                      </td>
                      <td className="px-4 py-3 text-surface-200 font-medium">
                        {formatCents(bet.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={bet.status} />
                      </td>
                      <td className="px-4 py-3">
                        {bet.netResult !== null ? (
                          <span className={`font-medium ${bet.netResult >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
                            {bet.netResult >= 0 ? '+' : ''}{formatCents(bet.netResult)}
                          </span>
                        ) : (
                          <span className="text-surface-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-surface-400">
                        {formatDate(bet.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination && (
              <div className="px-4 pb-4">
                <Pagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} />
              </div>
            )}
          </Card>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {bets.map((bet) => (
              <Link key={bet.id} href={`/bets/${bet.id}`}>
                <Card className="hover:border-surface-700 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-surface-200 truncate">{bet.gameName}</p>
                      <p className="text-xs text-surface-500 mt-0.5">
                        vs {bet.opponent?.displayName ?? 'Awaiting'} &middot; {formatDate(bet.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={bet.status} />
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm text-surface-300">{formatCents(bet.amount)}</span>
                    {bet.netResult !== null && (
                      <span className={`text-sm font-semibold ${bet.netResult >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
                        {bet.netResult >= 0 ? '+' : ''}{formatCents(bet.netResult)}
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
            {pagination && (
              <Pagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
