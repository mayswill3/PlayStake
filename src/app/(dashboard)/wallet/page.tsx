'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard, SkeletonTableRow } from '@/components/ui/Skeleton';
import { FadeIn } from '@/components/ui/FadeIn';
import { Lock, ArrowLeftRight, ArrowDown, ArrowUp, Unlock, Trophy, Minus } from 'lucide-react';
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

const txTypeIcons: Record<string, typeof ArrowDown> = {
  DEPOSIT: ArrowDown,
  WITHDRAWAL: ArrowUp,
  BET_ESCROW: Lock,
  BET_ESCROW_RELEASE: Unlock,
  BET_ESCROW_REFUND: Unlock,
  PLATFORM_FEE: Minus,
};

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
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="h-8 w-32 bg-white/5 rounded-sm animate-pulse" />
        <SkeletonCard />
        <Card padding="none">
          <div className="p-6">
            {Array.from({ length: 5 }, (_, i) => <SkeletonTableRow key={i} cols={3} />)}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <FadeIn>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-display font-bold text-text-primary">Wallet</h1>

        {/* Balance card */}
        <Card className="bg-gradient-to-br from-surface-900 to-surface-850">
          <div className="flex flex-col sm:flex-row sm:items-end gap-6">
            <div className="flex-1">
              <p className="font-mono text-[11px] uppercase tracking-wider text-text-muted mb-1">Available Balance</p>
              <p className="text-3xl font-display font-bold tabular-nums text-brand-400">
                {formatCents(balance?.available ?? 0)}
              </p>
            </div>
            <div className="flex-1">
              <p className="font-mono text-[11px] uppercase tracking-wider text-text-muted mb-1 flex items-center gap-1.5">
                <Lock className="h-3 w-3" /> In Escrow
              </p>
              <p className="text-3xl font-display font-bold tabular-nums text-text-secondary">
                {formatCents(balance?.escrowed ?? 0)}
              </p>
              <p className="text-xs font-mono text-text-muted mt-1">Locked in active bets</p>
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
            <h2 className="text-lg font-display font-semibold text-text-primary">Recent Transactions</h2>
            <Link href="/wallet/transactions" className="text-sm font-mono text-brand-400 hover:text-brand-500 transition-colors">
              View all
            </Link>
          </div>

          {transactions.length === 0 ? (
            <EmptyState
              icon={<ArrowLeftRight className="h-10 w-10" />}
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
              {transactions.map((tx) => {
                const Icon = txTypeIcons[tx.type] || ArrowLeftRight;
                const credit = isCredit(tx.type);
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-sm hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-sm bg-surface-800">
                        <Icon className="h-4 w-4 text-text-secondary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-mono font-medium text-surface-200">{tx.description}</p>
                        <p className="text-xs font-mono text-text-muted">{formatDate(tx.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadge status={tx.status} />
                      <span className={`text-sm font-mono tabular-nums font-semibold ${
                        credit ? 'text-brand-400' : 'text-text-secondary'
                      }`}>
                        {credit ? '+' : '-'}{formatCents(Math.abs(tx.amount))}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </FadeIn>
  );
}

function isCredit(type: string): boolean {
  return ['DEPOSIT', 'BET_ESCROW_RELEASE', 'BET_ESCROW_REFUND'].includes(type);
}
