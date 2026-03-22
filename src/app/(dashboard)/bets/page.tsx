'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { FadeIn } from '@/components/ui/FadeIn';
import { Target } from 'lucide-react';
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

const statusBorderColor: Record<string, string> = {
  DISPUTED: 'border-l-2 border-l-danger-500',
  PENDING: 'border-l-2 border-l-warning-500',
  PENDING_CONSENT: 'border-l-2 border-l-warning-500',
  OPEN: 'border-l-2 border-l-blue-500',
};

export default function BetsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');

  const { bets, pagination, loading, error } = useBets({
    page,
    limit: 20,
    status: statusFilter,
  });

  return (
    <FadeIn>
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-display font-bold text-text-primary">Bet History</h1>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value); setPage(1); }}
              className={`
                px-3 py-1.5 rounded-sm font-mono text-[11px] uppercase tracking-wider font-medium transition-colors
                ${statusFilter === opt.value
                  ? 'bg-brand-400/10 text-brand-400 border border-brand-400/25'
                  : 'text-text-muted hover:text-text-secondary border border-surface-700 hover:border-surface-600'
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
          <div className="p-4 rounded-sm bg-danger-500/10 border border-danger-500/25 text-danger-400 text-sm font-mono">
            {error}
          </div>
        ) : bets.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Target className="h-10 w-10" />}
              title="No bets found"
              description={statusFilter !== 'all'
                ? 'No bets match the selected filter.'
                : 'You have not placed any bets yet. Start playing to see your history here.'
              }
              action={statusFilter !== 'all' ? (
                <Button variant="secondary" size="sm" onClick={() => { setStatusFilter('all'); setPage(1); }}>
                  Clear Filters
                </Button>
              ) : undefined}
            />
          </Card>
        ) : (
          <>
            {/* Desktop table */}
            <Card padding="none" className="hidden sm:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="border-b border-white/8">
                    <tr>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">Game</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">Opponent</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">Stake</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">Status</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">Result</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8">
                    {bets.map((bet) => (
                      <tr key={bet.id} className={`hover:bg-white/[0.02] transition-colors ${statusBorderColor[bet.status] || ''}`}>
                        <td className="px-4 py-3">
                          <Link href={`/bets/${bet.id}`} className="font-mono text-surface-200 hover:text-brand-400 transition-colors font-medium">
                            {bet.gameName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-text-secondary">
                          {bet.opponent?.displayName ?? 'Awaiting'}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-surface-200 font-medium">
                          {formatCents(bet.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={bet.status} />
                        </td>
                        <td className="px-4 py-3">
                          {bet.netResult !== null ? (
                            <span className={`font-mono tabular-nums font-medium ${bet.netResult >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
                              {bet.netResult >= 0 ? '+' : ''}{formatCents(bet.netResult)}
                            </span>
                          ) : (
                            <span className="text-text-muted">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-text-secondary">
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
                  <Card className={`hover:border-surface-700 transition-colors ${statusBorderColor[bet.status] || ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-mono font-medium text-surface-200 truncate">{bet.gameName}</p>
                        <p className="text-xs font-mono text-text-muted mt-0.5">
                          vs {bet.opponent?.displayName ?? 'Awaiting'} &middot; {formatDate(bet.createdAt)}
                        </p>
                      </div>
                      <StatusBadge status={bet.status} />
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-sm font-mono tabular-nums text-surface-300">{formatCents(bet.amount)}</span>
                      {bet.netResult !== null && (
                        <span className={`text-sm font-mono tabular-nums font-semibold ${bet.netResult >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
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
    </FadeIn>
  );
}
