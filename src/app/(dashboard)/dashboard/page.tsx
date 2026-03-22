'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
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
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-danger-500/10 border border-danger-500/25 text-danger-300 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-100">Dashboard</h1>
        <p className="text-surface-400 text-sm mt-1">Your betting overview and quick actions</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <h2 className="text-lg font-semibold text-surface-100">Recent Bets</h2>
          <Link href="/bets" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
            View all
          </Link>
        </div>

        {recentBets.length === 0 ? (
          <EmptyState
            icon={<span>&#x2694;</span>}
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
                className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-800/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-surface-200 truncate">
                      {bet.gameName}
                    </p>
                    <p className="text-xs text-surface-500">
                      vs {bet.opponent?.displayName ?? 'Awaiting opponent'} &middot; {formatDate(bet.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={bet.status} />
                  <div className="text-right">
                    <p className="text-sm font-medium text-surface-200">
                      {formatCents(bet.amount)}
                    </p>
                    {bet.netResult !== null && (
                      <p className={`text-xs font-medium ${bet.netResult >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
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
  );
}

