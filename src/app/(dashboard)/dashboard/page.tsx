'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { SkeletonCard, SkeletonTableRow } from '@/components/ui/Skeleton';
import { FadeIn } from '@/components/ui/FadeIn';
import { Target } from 'lucide-react';
import { formatCents, formatPercent, formatDate } from '@/lib/utils/format';

interface DashboardStats {
  totalBets: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  totalWagered: number;
  totalWon: number;
  totalLost: number;
  netProfit: number;
  activeBets: number;
}

interface RecentBet {
  id: string;
  gameName: string;
  opponent: { displayName: string } | null;
  amount: number;
  status: string;
  outcome: string | null;
  myRole: string;
  netResult: number | null;
  createdAt: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBets, setRecentBets] = useState<RecentBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/stats').then((r) => r.ok ? r.json() : null),
      fetch('/api/bets?limit=5').then((r) => r.ok ? r.json() : null),
    ])
      .then(([statsData, betsData]) => {
        if (statsData) setStats(statsData);
        if (betsData) setRecentBets(betsData.data || []);
      })
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <div className="h-8 w-48 bg-white/5 rounded-sm animate-pulse" />
          <div className="h-4 w-72 bg-white/5 rounded-sm animate-pulse mt-2" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
        <Card padding="none">
          <div className="p-6">
            <div className="h-6 w-32 bg-white/5 rounded-sm animate-pulse mb-4" />
            {Array.from({ length: 5 }, (_, i) => <SkeletonTableRow key={i} cols={4} />)}
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-sm bg-danger-500/10 border border-danger-500/25 text-danger-400 text-sm font-mono">
        {error}
      </div>
    );
  }

  return (
    <FadeIn>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-text-primary">Dashboard</h1>
          <p className="text-text-secondary font-mono text-sm mt-1">Your betting overview and quick actions</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Bets" value={String(stats?.totalBets ?? 0)} />
          <StatCard
            label="Win Rate"
            value={stats ? formatPercent(stats.winRate) : '0%'}
            subtitle={stats ? `${stats.wins}W / ${stats.losses}L / ${stats.draws}D` : undefined}
          />
          <StatCard
            label="Net Profit"
            value={formatCents(stats?.netProfit ?? 0)}
            valueColor={stats && stats.netProfit >= 0 ? 'text-brand-400' : 'text-danger-400'}
          />
          <StatCard
            label="Active Bets"
            value={String(stats?.activeBets ?? 0)}
          />
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-3">
          <Link href="/wallet/deposit">
            <Button variant="primary">Deposit Funds</Button>
          </Link>
          <Link href="/bets">
            <Button variant="secondary">View All Bets</Button>
          </Link>
        </div>

        {/* Recent bets */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-text-primary">Recent Bets</h2>
            <Link href="/bets" className="text-sm font-mono text-brand-400 hover:text-brand-500 transition-colors">
              View all
            </Link>
          </div>

          {recentBets.length === 0 ? (
            <EmptyState
              icon={<Target className="h-10 w-10" />}
              title="No bets yet"
              description="Your betting history will appear here once you place your first wager."
              action={
                <Link href="/wallet/deposit">
                  <Button variant="primary" size="sm">Start Playing</Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {recentBets.map((bet) => (
                <Link
                  key={bet.id}
                  href={`/bets/${bet.id}`}
                  className="flex items-center justify-between p-3 rounded-sm hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="text-sm font-mono font-medium text-surface-200 truncate">
                        {bet.gameName}
                      </p>
                      <p className="text-xs font-mono text-text-secondary">
                        vs {bet.opponent?.displayName ?? 'Awaiting opponent'} &middot; {formatDate(bet.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={bet.status} />
                    <div className="text-right">
                      <p className="text-sm font-mono tabular-nums font-medium text-surface-200">
                        {formatCents(bet.amount)}
                      </p>
                      {bet.netResult !== null && (
                        <p className={`text-xs font-mono tabular-nums font-medium ${bet.netResult >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
                          {bet.netResult >= 0 ? '+' : ''}{formatCents(bet.netResult)}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </FadeIn>
  );
}
