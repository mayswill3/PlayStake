'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeIn } from '@/components/ui/FadeIn';
import { Activity } from 'lucide-react';
import { formatDate } from '@/lib/utils/format';

interface AnomalyItem {
  id: string;
  type: string;
  status: string;
  severity: string;
  details: Record<string, unknown>;
  autoAction: string | null;
  createdAt: string;
  developerProfileId: string;
  gameId: string | null;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'DETECTED', label: 'Detected' },
  { value: 'INVESTIGATING', label: 'Investigating' },
  { value: 'CONFIRMED_FRAUD', label: 'Confirmed Fraud' },
  { value: 'FALSE_POSITIVE', label: 'False Positive' },
  { value: 'RESOLVED', label: 'Resolved' },
];

const severityVariant = (severity: string) => {
  switch (severity.toUpperCase()) {
    case 'HIGH': case 'CRITICAL': return 'danger' as const;
    case 'MEDIUM': return 'warning' as const;
    default: return 'info' as const;
  }
};

const statusVariant = (status: string) => {
  switch (status) {
    case 'DETECTED': return 'warning' as const;
    case 'INVESTIGATING': return 'info' as const;
    case 'CONFIRMED_FRAUD': return 'danger' as const;
    case 'FALSE_POSITIVE': return 'neutral' as const;
    case 'RESOLVED': return 'success' as const;
    default: return 'neutral' as const;
  }
};

export default function AdminAnomaliesPage() {
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchAnomalies = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/admin/anomalies?${params}`);
      if (!res.ok) throw new Error('Failed to load anomalies');
      const data = await res.json();
      setAnomalies(data.data);
      setTotalPages(data.pagination.totalPages);
    } catch {
      setError('Failed to load anomaly alerts.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchAnomalies(); }, [fetchAnomalies]);

  return (
    <FadeIn>
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-display font-bold text-text-primary">Anomaly Alerts</h1>

        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value); setPage(1); }}
              className={`
                px-3 py-1.5 rounded-sm font-mono text-[11px] uppercase tracking-wider font-medium transition-colors
                ${statusFilter === opt.value
                  ? 'bg-brand-400/10 text-brand-400 border border-brand-400/25'
                  : 'text-text-muted hover:text-text-secondary border border-surface-700 hover:border-surface-600'
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
        ) : error ? (
          <div className="p-4 rounded-sm bg-danger-500/10 border border-danger-500/25 text-danger-400 text-sm font-mono">{error}</div>
        ) : anomalies.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Activity className="h-10 w-10" />}
              title="No anomalies detected"
              description={statusFilter !== 'all' ? 'No anomalies match the selected filter.' : 'No anomaly alerts have been triggered. The platform is running clean.'}
            />
          </Card>
        ) : (
          <>
            <Card padding="none" className="hidden sm:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="border-b border-white/8">
                    <tr>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">Type</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">Severity</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">Status</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">Auto Action</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-muted">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8">
                    {anomalies.map((a) => (
                      <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 font-mono text-surface-200 font-medium">{a.type.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3"><Badge variant={severityVariant(a.severity)}>{a.severity}</Badge></td>
                        <td className="px-4 py-3"><Badge variant={statusVariant(a.status)}>{a.status.replace(/_/g, ' ')}</Badge></td>
                        <td className="px-4 py-3 font-mono text-text-secondary">{a.autoAction || 'None'}</td>
                        <td className="px-4 py-3 font-mono text-text-secondary">{formatDate(a.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && <div className="px-4 pb-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>}
            </Card>

            <div className="sm:hidden space-y-3">
              {anomalies.map((a) => (
                <Card key={a.id}>
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-mono font-medium text-surface-200">{a.type.replace(/_/g, ' ')}</p>
                      <p className="text-xs font-mono text-text-muted mt-0.5">{formatDate(a.createdAt)}</p>
                    </div>
                    <Badge variant={severityVariant(a.severity)}>{a.severity}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={statusVariant(a.status)}>{a.status.replace(/_/g, ' ')}</Badge>
                    {a.autoAction && <span className="text-xs font-mono text-text-muted">{a.autoAction}</span>}
                  </div>
                </Card>
              ))}
              {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
            </div>
          </>
        )}
      </div>
    </FadeIn>
  );
}
