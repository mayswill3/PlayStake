'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
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
        <h1 className="text-2xl font-bold text-surface-100">Developer Dashboard</h1>
        {analytics && (
          <p className="text-surface-400 text-sm mt-1">
            {analytics.periodStart} &mdash; {analytics.periodEnd}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Bets" value={formatNumber(analytics?.totalBets ?? 0)} />
        <StatCard label="Total Volume" value={formatCents(analytics?.totalVolume ?? 0)} />
        <StatCard label="Active Bets" value={formatNumber(analytics?.activeBets ?? 0)} />
        <StatCard
          label="Rev Share Earned"
          value={formatCents(analytics?.revShareEarned ?? 0)}
          valueColor="text-brand-400"
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueColor = 'text-surface-100',
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <Card>
      <p className="text-sm text-surface-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
    </Card>
  );
}
