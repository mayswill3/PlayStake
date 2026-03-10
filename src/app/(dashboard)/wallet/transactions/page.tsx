'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dialog } from '@/components/ui/Dialog';
import { formatCents, formatDate } from '@/lib/utils/format';
import { useTransactions, type Transaction } from '@/hooks/useTransactions';

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'DEPOSIT', label: 'Deposits' },
  { value: 'WITHDRAWAL', label: 'Withdrawals' },
  { value: 'BET_ESCROW', label: 'Bet Escrow' },
  { value: 'BET_ESCROW_RELEASE', label: 'Payouts' },
  { value: 'BET_ESCROW_REFUND', label: 'Refunds' },
  { value: 'PLATFORM_FEE', label: 'Fees' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' },
];

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [txDetail, setTxDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const { transactions, pagination, loading, error } = useTransactions({
    page,
    limit: 20,
    type: typeFilter,
    status: statusFilter,
  });

  async function handleRowClick(tx: Transaction) {
    setSelectedTx(tx);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/wallet/transactions/${tx.id}`);
      if (res.ok) {
        setTxDetail(await res.json());
      }
    } catch {
      // Ignore, just show basic info
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-surface-100">Transaction History</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-surface-700 bg-surface-800 text-surface-200 text-sm px-3 py-2"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-surface-700 bg-surface-800 text-surface-200 text-sm px-3 py-2"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <Card padding="none">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="p-4 text-danger-400 text-sm">{error}</div>
        ) : transactions.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No transactions found"
              description="Try adjusting your filters or make your first deposit."
            />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase text-surface-400 border-b border-surface-800">
                  <tr>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      onClick={() => handleRowClick(tx)}
                      className="hover:bg-surface-800/50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 text-surface-200">{tx.description}</td>
                      <td className="px-4 py-3 text-surface-400 text-xs">{tx.type.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
                      <td className="px-4 py-3 text-surface-400">{formatDate(tx.createdAt)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${
                        isCredit(tx.type) ? 'text-brand-400' : 'text-danger-400'
                      }`}>
                        {isCredit(tx.type) ? '+' : '-'}{formatCents(Math.abs(tx.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-surface-800">
              {transactions.map((tx) => (
                <button
                  key={tx.id}
                  onClick={() => handleRowClick(tx)}
                  className="w-full flex items-center justify-between p-4 hover:bg-surface-800/50 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-surface-200 truncate">{tx.description}</p>
                    <p className="text-xs text-surface-500 mt-0.5">
                      {formatDate(tx.createdAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className={`text-sm font-medium ${isCredit(tx.type) ? 'text-brand-400' : 'text-danger-400'}`}>
                      {isCredit(tx.type) ? '+' : '-'}{formatCents(Math.abs(tx.amount))}
                    </p>
                    <StatusBadge status={tx.status} />
                  </div>
                </button>
              ))}
            </div>

            {pagination && (
              <div className="px-4 pb-4">
                <Pagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </Card>

      {/* Transaction detail dialog */}
      <Dialog
        open={!!selectedTx}
        onClose={() => { setSelectedTx(null); setTxDetail(null); }}
        title="Transaction Detail"
      >
        {selectedTx && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-surface-500">Description</p>
                <p className="text-surface-200">{selectedTx.description}</p>
              </div>
              <div>
                <p className="text-surface-500">Amount</p>
                <p className={`font-semibold ${isCredit(selectedTx.type) ? 'text-brand-400' : 'text-danger-400'}`}>
                  {isCredit(selectedTx.type) ? '+' : '-'}{formatCents(Math.abs(selectedTx.amount))}
                </p>
              </div>
              <div>
                <p className="text-surface-500">Type</p>
                <p className="text-surface-200">{selectedTx.type.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <p className="text-surface-500">Status</p>
                <StatusBadge status={selectedTx.status} />
              </div>
              <div>
                <p className="text-surface-500">Date</p>
                <p className="text-surface-200">{formatDate(selectedTx.createdAt)}</p>
              </div>
            </div>

            {detailLoading && (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            )}

            {txDetail?.ledgerEntries && (
              <div>
                <p className="text-sm font-medium text-surface-300 mb-2">Ledger Entries</p>
                <div className="space-y-1">
                  {txDetail.ledgerEntries.map((entry: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs p-2 rounded bg-surface-800">
                      <span className="text-surface-400">{entry.accountType}</span>
                      <span className={entry.amount >= 0 ? 'text-brand-400' : 'text-danger-400'}>
                        {entry.amount >= 0 ? '+' : ''}{formatCents(entry.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}

function isCredit(type: string): boolean {
  return ['DEPOSIT', 'BET_ESCROW_RELEASE', 'BET_ESCROW_REFUND'].includes(type);
}
