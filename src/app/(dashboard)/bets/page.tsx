'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeIn } from '@/components/ui/FadeIn';
import { StatusPill } from '@/components/ui/playstake/StatusPill';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { Target } from 'lucide-react';
import { formatCents, formatDate } from '@/lib/utils/format';
import { useBets } from '@/hooks/useBets';

type PillStatus = 'live' | 'waiting' | 'completed' | 'disputed' | 'settled' | 'expired';

function mapBetStatusToPill(status: string): PillStatus {
  switch (status) {
    case 'OPEN':
    case 'PENDING':
    case 'PENDING_CONSENT':
      return 'waiting';
    case 'MATCHED':
    case 'RESULT_REPORTED':
      return 'live';
    case 'SETTLED':
      return 'settled';
    case 'DISPUTED':
      return 'disputed';
    case 'CANCELLED':
    case 'VOIDED':
    case 'EXPIRED':
      return 'expired';
    default:
      return 'waiting';
  }
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Bets' },
  { value: 'OPEN', label: 'Active' },
  { value: 'MATCHED', label: 'Matched' },
  { value: 'SETTLED', label: 'Settled' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'DISPUTED', label: 'Disputed' },
];

const statusBorderColor: Record<string, string> = {
  DISPUTED: 'border-l-2 border-l-ps-error',
  PENDING: 'border-l-2 border-l-ps-warning',
  PENDING_CONSENT: 'border-l-2 border-l-ps-warning',
  OPEN: 'border-l-2 border-l-ps-blue',
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
        <h1 className="text-2xl font-display font-bold text-ps-text dark:text-ps-text-on-dark">Bet History</h1>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value); setPage(1); }}
              className={`
                px-3 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-wider font-medium transition-colors
                ${statusFilter === opt.value
                  ? 'bg-ps-lime/10 text-ps-lime border border-ps-lime/25'
                  : 'text-ps-muted dark:text-ps-muted-on-dark hover:text-ps-text dark:hover:text-ps-text-on-dark border border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] hover:border-ps-lime/20'
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
          <div className="p-4 rounded-[var(--ps-radius-md)] bg-ps-error/10 border border-ps-error/25 text-ps-error text-sm font-mono">
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
                <PSButton variant="secondary" size="sm" onClick={() => { setStatusFilter('all'); setPage(1); }}>
                  Clear Filters
                </PSButton>
              ) : undefined}
            />
          </Card>
        ) : (
          <>
            {/* Desktop table */}
            <Card padding="none" className="hidden sm:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="border-b border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
                    <tr>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-ps-muted dark:text-ps-muted-on-dark">Game</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-ps-muted dark:text-ps-muted-on-dark">Opponent</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-ps-muted dark:text-ps-muted-on-dark">Stake</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-ps-muted dark:text-ps-muted-on-dark">Status</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-ps-muted dark:text-ps-muted-on-dark">Result</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-ps-muted dark:text-ps-muted-on-dark">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ps-border-light)] dark:divide-[var(--ps-border-dark)]">
                    {bets.map((bet) => (
                      <tr key={bet.id} className={`hover:bg-ps-paper-elevated dark:hover:bg-ps-ink-2 transition-colors ${statusBorderColor[bet.status] || ''}`}>
                        <td className="px-4 py-3">
                          <Link href={`/bets/${bet.id}`} className="font-mono text-ps-text dark:text-ps-text-on-dark hover:text-ps-lime transition-colors font-medium">
                            {bet.gameName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-ps-muted dark:text-ps-muted-on-dark">
                          {bet.opponent?.displayName ?? 'Awaiting'}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-ps-text dark:text-ps-text-on-dark font-medium">
                          {formatCents(bet.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={mapBetStatusToPill(bet.status)} label={bet.status.replace(/_/g, ' ')} />
                        </td>
                        <td className="px-4 py-3">
                          {bet.netResult !== null ? (
                            <span className={`font-mono tabular-nums font-medium ${bet.netResult >= 0 ? 'text-ps-lime' : 'text-ps-error'}`}>
                              {bet.netResult >= 0 ? '+' : ''}{formatCents(bet.netResult)}
                            </span>
                          ) : (
                            <span className="text-ps-muted dark:text-ps-muted-on-dark">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-ps-muted dark:text-ps-muted-on-dark">
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
                  <Card className={`hover:border-ps-lime/20 transition-colors ${statusBorderColor[bet.status] || ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-mono font-medium text-ps-text dark:text-ps-text-on-dark truncate">{bet.gameName}</p>
                        <p className="text-xs font-mono text-ps-muted dark:text-ps-muted-on-dark mt-0.5">
                          vs {bet.opponent?.displayName ?? 'Awaiting'} &middot; {formatDate(bet.createdAt)}
                        </p>
                      </div>
                      <StatusPill status={mapBetStatusToPill(bet.status)} label={bet.status.replace(/_/g, ' ')} />
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-sm font-mono tabular-nums text-ps-muted dark:text-ps-muted-on-dark">{formatCents(bet.amount)}</span>
                      {bet.netResult !== null && (
                        <span className={`text-sm font-mono tabular-nums font-semibold ${bet.netResult >= 0 ? 'text-ps-lime' : 'text-ps-error'}`}>
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
