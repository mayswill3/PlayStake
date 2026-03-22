'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { StatCard } from '@/components/ui/StatCard';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { formatCents, formatNumber } from '@/lib/utils/format';

interface AdminStats {
  totalUsers: number;
  totalDevelopers: number;
  totalBets: number;
  activeBets: number;
  openDisputes: number;
  totalVolume: number;
  platformRevenue: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load admin stats');
        return r.json();
      })
      .then(setStats)
      .catch(() => setError('Failed to load platform statistics.'))
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
        <h1 className="text-2xl font-bold text-surface-100">Admin Dashboard</h1>
        <p className="text-surface-400 text-sm mt-1">Platform overview and management</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={formatNumber(stats?.totalUsers ?? 0)} />
        <StatCard label="Developers" value={formatNumber(stats?.totalDevelopers ?? 0)} />
        <StatCard label="Total Bets" value={formatNumber(stats?.totalBets ?? 0)} />
        <StatCard label="Active Bets" value={formatNumber(stats?.activeBets ?? 0)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Volume"
          value={formatCents(stats?.totalVolume ?? 0)}
          valueColor="text-brand-400"
        />
        <StatCard
          label="Platform Revenue"
          value={formatCents(stats?.platformRevenue ?? 0)}
          valueColor="text-brand-400"
        />
        <StatCard
          label="Open Disputes"
          value={formatNumber(stats?.openDisputes ?? 0)}
          valueColor={stats && stats.openDisputes > 0 ? 'text-danger-400' : 'text-surface-100'}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/admin/users">
          <Button variant="secondary">Manage Users</Button>
        </Link>
        <Link href="/admin/disputes">
          <Button variant="secondary">View Disputes</Button>
        </Link>
        <Link href="/admin/anomalies">
          <Button variant="secondary">Anomaly Alerts</Button>
        </Link>
      </div>
    </div>
  );
}
