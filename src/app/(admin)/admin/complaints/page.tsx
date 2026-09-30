'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { StatusPill } from '@/components/ui/playstake/StatusPill';

interface ComplaintRow {
  id: string;
  reference: string;
  name: string;
  email: string;
  category: string;
  status: string;
  receivedAt: string;
  finalResponseDueAt: string;
  finalResponseAt: string | null;
  outcome: string | null;
}

const SCOPES = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Final response issued' },
  { value: 'all', label: 'All' },
] as const;

function daysUntil(value: string, now: number) {
  return Math.ceil((new Date(value).getTime() - now) / (24 * 60 * 60 * 1000));
}

function day(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminComplaintsPage() {
  const [scope, setScope] = useState<(typeof SCOPES)[number]['value']>('open');
  const [rows, setRows] = useState<ComplaintRow[] | null>(null);
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/complaints?status=${scope}`, { cache: 'no-store' });
      const data = response.ok ? await response.json() : { complaints: [] };
      setRows(data.complaints);
      setNow(Date.now());
    } catch {
      setRows([]);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.22em] text-ps-lime">Customer care</p>
        <h1 className="font-display text-3xl font-bold text-ps-text dark:text-white">Complaints</h1>
        <p className="mt-2 text-ps-muted dark:text-ps-muted-on-dark">
          Every complaint needs a final response within 8 weeks. After that, or once we
          respond, the customer can take it to IBAS.
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
        {rows === null ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-ps-muted">No complaints here.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
                {['Reference', 'Customer', 'About', 'Received', 'Status', 'Final response'].map((header) => (
                  <th key={header} className="py-2 pr-4 font-mono text-[11px] uppercase tracking-widest text-ps-muted dark:text-ps-muted-on-dark">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const left = daysUntil(row.finalResponseDueAt, now);
                return (
                  <tr key={row.id} className="border-b border-[var(--ps-border-light)] last:border-0 dark:border-[var(--ps-border-dark)]">
                    <td className="py-2 pr-4">
                      <Link href={`/admin/complaints/${row.id}`} className="font-mono font-semibold text-ps-lime hover:underline">
                        {row.reference}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">
                      {row.name}
                      <span className="block text-xs text-ps-muted dark:text-ps-muted-on-dark">{row.email}</span>
                    </td>
                    <td className="py-2 pr-4">{row.category.replace(/_/g, ' ').toLowerCase()}</td>
                    <td className="py-2 pr-4">{day(row.receivedAt)}</td>
                    <td className="py-2 pr-4">
                      <StatusPill
                        status={row.finalResponseAt ? 'settled' : left < 0 ? 'disputed' : 'waiting'}
                        label={row.status.replace(/_/g, ' ')}
                      />
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {row.finalResponseAt ? (
                        `${day(row.finalResponseAt)} · ${row.outcome?.replace(/_/g, ' ').toLowerCase()}`
                      ) : (
                        <span className={left < 0 ? 'font-semibold text-ps-error' : left <= 14 ? 'text-ps-warning' : ''}>
                          {left < 0 ? `Overdue by ${-left} days` : `Due ${day(row.finalResponseDueAt)} (${left} days)`}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
