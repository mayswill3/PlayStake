'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { PSButton } from '@/components/ui/playstake/PSButton';

interface Entry {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
  actor: { displayName: string; email: string };
}

const fieldClass =
  'rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] bg-ps-paper px-2.5 py-1.5 text-sm text-ps-text focus:outline-none focus:ring-2 focus:ring-ps-lime/60 dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2 dark:text-ps-text-on-dark';

export default function AdminAuditLogPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [action, setAction] = useState('');
  const [targetId, setTargetId] = useState('');
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(
    async (before?: string) => {
      const params = new URLSearchParams();
      if (action.trim()) params.set('action', action.trim());
      if (targetId.trim()) params.set('targetId', targetId.trim());
      if (before) params.set('before', before);
      try {
        const res = await fetch(`/api/admin/audit-log?${params}`, { cache: 'no-store' });
        const data = res.ok ? await res.json() : { entries: [], pageSize: 100 };
        setEntries((current) => (before ? [...(current ?? []), ...data.entries] : data.entries));
        setHasMore(data.entries.length === data.pageSize);
      } catch {
        setEntries((current) => current ?? []);
      }
    },
    [action, targetId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.22em] text-ps-lime">Governance</p>
        <h1 className="font-display text-3xl font-bold text-ps-text dark:text-white">Audit log</h1>
        <p className="mt-2 text-ps-muted dark:text-ps-muted-on-dark">
          Every staff action — account changes, KYC decisions, dispute and complaint handling,
          harm and AML case work. The log is append-only: entries can&apos;t be edited or deleted.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input className={fieldClass} value={action} onChange={(e) => setAction(e.target.value)} placeholder="Action starts with (e.g. user., kyc.)" />
        <input className={fieldClass} value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="Target ID" />
      </div>

      <Card className="overflow-x-auto">
        {entries === null ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : entries.length === 0 ? (
          <p className="py-10 text-center text-ps-muted">No entries.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
                {['When', 'Who', 'Action', 'Target', 'Details'].map((header) => (
                  <th key={header} className="py-2 pr-4 font-mono uppercase tracking-widest text-ps-muted">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-[var(--ps-border-light)] align-top last:border-0 dark:border-[var(--ps-border-dark)]">
                  <td className="whitespace-nowrap py-2 pr-4 tabular-nums">{new Date(entry.createdAt).toLocaleString('en-GB')}</td>
                  <td className="py-2 pr-4">{entry.actor.displayName}<span className="block text-ps-muted">{entry.ipAddress ?? ''}</span></td>
                  <td className="py-2 pr-4 font-mono">{entry.action}</td>
                  <td className="py-2 pr-4 font-mono">{entry.targetType}<span className="block break-all text-ps-muted">{entry.targetId}</span></td>
                  <td className="max-w-md break-words py-2 pr-4 font-mono text-ps-muted">{JSON.stringify(entry.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {hasMore && entries && (
        <PSButton variant="secondary" onClick={() => load(entries[entries.length - 1].createdAt)}>
          Load older entries
        </PSButton>
      )}
    </div>
  );
}
