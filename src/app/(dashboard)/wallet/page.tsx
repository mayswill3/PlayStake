'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCents, formatDate } from '@/lib/utils/format';

interface Balance {
  available: number;
  escrowed: number;
  currency: string;
}

interface Transaction {
  id: string;
  type: string;
  status: string;
  amount: number;
  description: string;
  createdAt: string;
}

export default function WalletPage() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/wallet/balance').then((r) => r.ok ? r.json() : null),
      fetch('/api/wallet/transactions?limit=10').then((r) => r.ok ? r.json() : null),
    ])
      .then(([bal, txns]) => {
        if (bal) setBalance(bal);
        if (txns) setTransactions(txns.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-surface-100">Wallet</h1>

      {/* Balance card */}
      <Card className="bg-gradient-to-br from-surface-900 to-surface-850">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-surface-400 mb-1">Available Balance</p>
            <p className="text-3xl font-bold text-brand-400">
              {formatCents(balance?.available ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-sm text-surface-400 mb-1">In Escrow</p>
            <p className="text-3xl font-bold text-surface-300">
              {formatCents(balance?.escrowed ?? 0)}
            </p>
            <p className="text-xs text-surface-500 mt-1">Locked in active bets</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-6">
          <Link href="/wallet/deposit">
            <Button variant="primary">Deposit</Button>
          </Link>
          <Link href="/wallet/withdraw">
            <Button variant="secondary">Withdraw</Button>
          </Link>
        </div>
      </Card>

      {/* Recent transactions */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-surface-100">Recent Transactions</h2>
          <Link href="/wallet/transactions" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
            View all
          </Link>
        </div>

        {transactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="Make your first deposit to get started."
            action={
              <Link href="/wallet/deposit">
                <Button variant="primary" size="sm">Deposit Now</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-800/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-surface-200">{tx.description}</p>
                  <p className="text-xs text-surface-500">{formatDate(tx.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={tx.status} />
                  <span className={`text-sm font-semibold ${
                    tx.type === 'DEPOSIT' || tx.type === 'BET_ESCROW_RELEASE' || tx.type === 'BET_ESCROW_REFUND'
                      ? 'text-brand-400'
                      : 'text-danger-400'
                  }`}>
                    {tx.type === 'DEPOSIT' || tx.type === 'BET_ESCROW_RELEASE' || tx.type === 'BET_ESCROW_REFUND' ? '+' : '-'}
                    {formatCents(Math.abs(tx.amount))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
