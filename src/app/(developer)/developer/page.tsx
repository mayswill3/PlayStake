'use client';

import { useState, useEffect } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { StatCard } from '@/components/ui/StatCard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { FadeIn } from '@/components/ui/FadeIn';
import { formatCents, formatNumber } from '@/lib/utils/format';

interface Analytics {
  totalBets: number;
  totalVolume: number;
  activeBets: number;
  revShareEarned: number;
  periodStart: string;
  periodEnd: string;
}

export default function DeveloperDashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/developer/analytics')
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load analytics');
        return r.json();
      })
      .then(setAnalytics)
      .catch(() => setError('Failed to load developer analytics.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="h-8 w-56 bg-white/5 rounded-sm animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
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
          <h1 className="text-2xl font-display font-bold text-text-primary">Developer Dashboard</h1>
          {analytics && (
            <p className="text-text-secondary font-mono text-sm mt-1">
              {analytics.periodStart} &mdash; {analytics.periodEnd}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Bets" value={formatNumber(analytics?.totalBets ?? 0)} />
          <StatCard label="Total Volume" value={formatCents(analytics?.totalVolume ?? 0)} />
          <StatCard label="Active Bets" value={formatNumber(analytics?.activeBets ?? 0)} />
          <StatCard label="Rev Share Earned" value={formatCents(analytics?.revShareEarned ?? 0)} valueColor="text-brand-400" />
        </div>
      </div>
    </FadeIn>
  );
}
