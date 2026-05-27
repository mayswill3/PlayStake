'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard, SkeletonTableRow } from '@/components/ui/Skeleton';
import { FadeIn } from '@/components/ui/FadeIn';
import { DarkGlowCard } from '@/components/ui/playstake/DarkGlowCard';
import { StatusPill } from '@/components/ui/playstake/StatusPill';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { Lock, ArrowLeftRight, ArrowDown, ArrowUp, Unlock, Minus, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
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

type PillStatus = 'live' | 'waiting' | 'completed' | 'disputed' | 'settled' | 'expired';

function mapTxStatusToPill(status: string): PillStatus {
  switch (status) {
    case 'COMPLETED':
      return 'completed';
    case 'PENDING':
    case 'PROCESSING':
      return 'waiting';
    case 'FAILED':
      return 'disputed';
    case 'CANCELLED':
      return 'expired';
    default:
      return 'waiting';
  }
}

/** Cache-busted fetch to bypass browser and Next.js caching */
function freshFetch(url: string) {
  const sep = url.includes('?') ? '&' : '?';
  return fetch(`${url}${sep}_t=${Date.now()}`, { cache: 'no-store' });
}

export default function WalletPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [balanceFlash, setBalanceFlash] = useState(false);
  const [depositPending, setDepositPending] = useState(false);
  const [depositSuccess, setDepositSuccess] = useState(false);
  const [depositFailed, setDepositFailed] = useState(false);

  const isDepositReturn = searchParams.get('deposit') === 'success';
  const depositTxnId = searchParams.get('txn');

  const fetchWalletData = useCallback(async () => {
    const [bal, txns] = await Promise.all([
      freshFetch('/api/wallet/balance').then((r) => r.ok ? r.json() : null),
      freshFetch('/api/wallet/transactions?limit=10').then((r) => r.ok ? r.json() : null),
    ]);
    return { bal, txns: (txns?.data || []) as Transaction[] };
  }, []);

  // Initial load
  useEffect(() => {
    fetchWalletData()
      .then(({ bal, txns }) => {
        if (bal) setBalance(bal);
        setTransactions(txns);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll deposit transaction status after returning from Stripe
  useEffect(() => {
    if (!isDepositReturn || !depositTxnId || loading || depositSuccess || depositFailed) return;

    setDepositPending(true);
    let attempts = 0;
    const maxAttempts = 30; // 30 x 2s = 60s max
    let cancelled = false;

    const poll = setInterval(async () => {
      if (cancelled) return;
      attempts++;

      try {
        const res = await freshFetch(`/api/wallet/deposit-status/${depositTxnId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();

        if (data.status === 'COMPLETED') {
          cancelled = true;
          clearInterval(poll);

          // Refresh wallet data to show updated balance + transactions
          const { bal, txns } = await fetchWalletData();
          if (bal) setBalance(bal);
          setTransactions(txns);
          setDepositPending(false);
          setDepositSuccess(true);
          setBalanceFlash(true);
          router.replace('/wallet', { scroll: false });
        } else if (data.status === 'FAILED') {
          cancelled = true;
          clearInterval(poll);
          setDepositPending(false);
          setDepositFailed(true);
          router.replace('/wallet', { scroll: false });
        } else if (attempts >= maxAttempts) {
          // Timed out — refresh data and stop polling
          cancelled = true;
          clearInterval(poll);
          const { bal, txns } = await fetchWalletData();
          if (bal) setBalance(bal);
          setTransactions(txns);
          setDepositPending(false);
          router.replace('/wallet', { scroll: false });
        }
      } catch {
        // Silently retry on next interval
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDepositReturn, depositTxnId, loading, depositSuccess, depositFailed]);

  // Clear the flash animation after it plays
  useEffect(() => {
    if (!balanceFlash) return;
    const t = setTimeout(() => setBalanceFlash(false), 2000);
    return () => clearTimeout(t);
  }, [balanceFlash]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="h-8 w-32 bg-ps-ink-2 rounded-[var(--ps-radius-md)] animate-pulse" />
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
        <h1 className="text-2xl font-display font-bold text-ps-text dark:text-ps-text-on-dark">Wallet</h1>

        {/* Deposit status banners */}
        {depositPending && (
          <div className="flex items-center gap-3 p-4 rounded-[var(--ps-radius-md)] bg-ps-lime/10 border border-ps-lime/25 animate-pulse">
            <Loader2 className="h-5 w-5 text-ps-lime animate-spin" />
            <p className="text-sm font-mono text-ps-lime">Processing your deposit...</p>
          </div>
        )}
        {depositSuccess && (
          <div className="flex items-center gap-3 p-4 rounded-[var(--ps-radius-md)] bg-ps-success/10 border border-ps-success/25 animate-in fade-in slide-in-from-top-2 duration-300">
            <CheckCircle className="h-5 w-5 text-ps-success" />
            <p className="text-sm font-mono text-ps-success">Deposit successful! Your balance has been updated.</p>
          </div>
        )}
        {depositFailed && (
          <div className="flex items-center gap-3 p-4 rounded-[var(--ps-radius-md)] bg-ps-error/10 border border-ps-error/25">
            <AlertCircle className="h-5 w-5 text-ps-error" />
            <p className="text-sm font-mono text-ps-error">Deposit failed. Please try again or contact support.</p>
          </div>
        )}

        {/* Balance card */}
        <DarkGlowCard glow="strong" padding="lg">
          <div className="flex flex-col sm:flex-row sm:items-end gap-6">
            <div className="flex-1">
              <p className="font-mono text-[11px] uppercase tracking-wider text-ps-muted-on-dark mb-1">Available Balance</p>
              <p
                className={`text-3xl font-display font-bold tabular-nums text-ps-lime transition-all duration-500 ${
                  balanceFlash ? 'scale-110 drop-shadow-[0_0_20px_var(--ps-lime)]' : ''
                }`}
              >
                {formatCents(balance?.available ?? 0)}
              </p>
            </div>
            <div className="flex-1">
              <p className="font-mono text-[11px] uppercase tracking-wider text-ps-muted-on-dark mb-1 flex items-center gap-1.5">
                <Lock className="h-3 w-3" /> In Escrow
              </p>
              <p className="text-3xl font-display font-bold tabular-nums text-ps-muted-on-dark">
                {formatCents(balance?.escrowed ?? 0)}
              </p>
              <p className="text-xs font-mono text-ps-muted-on-dark mt-1">Locked in active bets</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-6">
            <Link href="/wallet/deposit">
              <PSButton variant="primary">Deposit</PSButton>
            </Link>
            <Link href="/wallet/withdraw">
              <PSButton variant="secondary">Withdraw</PSButton>
            </Link>
          </div>
        </DarkGlowCard>

        {/* Recent transactions */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-ps-text dark:text-ps-text-on-dark">Recent Transactions</h2>
            <Link href="/wallet/transactions" className="text-sm font-mono text-ps-lime hover:brightness-110 transition-all">
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
                  <PSButton variant="primary" size="sm">Deposit Now</PSButton>
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
                    className="flex items-center justify-between p-3 rounded-[var(--ps-radius-md)] hover:bg-ps-paper-elevated dark:hover:bg-ps-ink-2 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-[var(--ps-radius-md)] bg-ps-paper-elevated dark:bg-ps-ink-2">
                        <Icon className="h-4 w-4 text-ps-muted dark:text-ps-muted-on-dark" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-mono font-medium text-ps-text dark:text-ps-text-on-dark">{tx.description}</p>
                        <p className="text-xs font-mono text-ps-muted dark:text-ps-muted-on-dark">{formatDate(tx.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusPill status={mapTxStatusToPill(tx.status)} label={tx.status} />
                      <span className={`text-sm font-mono tabular-nums font-semibold ${
                        credit ? 'text-ps-lime' : 'text-ps-text dark:text-ps-text-on-dark'
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
