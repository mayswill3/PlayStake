'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { StatusPill } from '@/components/ui/playstake/StatusPill';

interface CaseRow {
  id: string;
  type: string;
  status: string;
  severity: string;
  createdAt: string;
  user: { id: string; displayName: string; email: string; accountStatus: string };
  relatedUser: { id: string; displayName: string } | null;
  assignedTo: { displayName: string } | null;
}

const SCOPES = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
] as const;

const label = (value: string) => value.replace(/_/g, ' ').toLowerCase();

export default function AdminAmlPage() {
  const [scope, setScope] = useState<(typeof SCOPES)[number]['value']>('open');
  const [cases, setCases] = useState<CaseRow[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/aml?status=${scope}`, { cache: 'no-store' });
      setCases(res.ok ? (await res.json()).cases : []);
    } catch {
      setCases([]);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.22em] text-ps-lime">Financial crime</p>
        <h1 className="font-display text-3xl font-bold text-ps-text dark:text-white">AML cases</h1>
        <p className="mt-2 text-ps-muted dark:text-ps-muted-on-dark">
          Suspicions raised by transaction monitoring, identity screening and chargebacks.
          Withdrawals are held while a medium- or high-severity case is open. Suspicious
          Activity Reports are filed with the NCA by the MLRO; record the reference here.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SCOPES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setScope(option.value)}
            className={`rounded-full border px-3 py-1 text-sm ${
              scope === option.value
                ? 'border-ps-lime bg-ps-lime/10 text-ps-lime'
                : 'border-[var(--ps-border-light)] text-ps-muted dark:border-[var(--ps-border-dark)]'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Card className="overflow-x-auto">
        {cases === null ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : cases.length === 0 ? (
          <p className="py-10 text-center text-ps-muted">No cases here.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
                {['Opened', 'Type', 'Customer', 'Related account', 'Severity', 'Assigned', 'Status'].map((header) => (
                  <th key={header} className="py-2 pr-4 font-mono text-[11px] uppercase tracking-widest text-ps-muted dark:text-ps-muted-on-dark">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cases.map((row) => (
                <tr key={row.id} className="border-b border-[var(--ps-border-light)] last:border-0 dark:border-[var(--ps-border-dark)]">
                  <td className="py-2 pr-4 tabular-nums">
                    <Link href={`/admin/aml/${row.id}`} className="text-ps-lime hover:underline">
                      {new Date(row.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{label(row.type)}</td>
                  <td className="py-2 pr-4">
                    {row.user.displayName}
                    <span className="block text-xs text-ps-muted dark:text-ps-muted-on-dark">
                      {row.user.email}{row.user.accountStatus !== 'ACTIVE' ? ` · ${label(row.user.accountStatus)}` : ''}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{row.relatedUser?.displayName ?? '—'}</td>
                  <td className={`py-2 pr-4 ${row.severity === 'high' ? 'font-semibold text-ps-error' : ''}`}>{row.severity}</td>
                  <td className="py-2 pr-4">{row.assignedTo?.displayName ?? 'Unassigned'}</td>
                  <td className="py-2 pr-4">
                    <StatusPill
                      status={row.status.startsWith('CLOSED') ? 'settled' : row.status === 'OPEN' ? 'waiting' : 'disputed'}
                      label={label(row.status)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
