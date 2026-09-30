'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { StatusPill } from '@/components/ui/playstake/StatusPill';

interface SignalRow {
  id: string;
  type: string;
  severity: string;
  status: string;
  createdAt: string;
  user: { id: string; displayName: string; email: string };
  _count: { interactions: number };
}

interface EffectivenessRow {
  signalType: string;
  interactionType: string;
  outcomes: Record<string, number>;
}

const SCOPES = ['OPEN', 'REVIEWED', 'DISMISSED', 'all'] as const;
const OUTCOME_COLUMNS = [
  'PENDING',
  'ACKNOWLEDGED',
  'CUSTOMER_SET_LIMIT',
  'CUSTOMER_TOOK_BREAK',
  'BEHAVIOUR_IMPROVED',
  'BEHAVIOUR_UNCHANGED',
  'ESCALATED',
  'NO_RESPONSE',
];

const label = (value: string) => value.replace(/_/g, ' ').toLowerCase();

export default function AdminHarmSignalsPage() {
  const [scope, setScope] = useState<(typeof SCOPES)[number]>('OPEN');
  const [signals, setSignals] = useState<SignalRow[] | null>(null);
  const [effectiveness, setEffectiveness] = useState<EffectivenessRow[]>([]);

  const load = useCallback(async () => {
    try {
      const [list, stats] = await Promise.all([
        fetch(`/api/admin/harm-signals?status=${scope}`, { cache: 'no-store' }),
        fetch('/api/admin/harm-signals/effectiveness', { cache: 'no-store' }),
      ]);
      setSignals(list.ok ? (await list.json()).signals : []);
      if (stats.ok) setEffectiveness((await stats.json()).rows);
    } catch {
      setSignals([]);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.22em] text-ps-lime">Safer gambling</p>
        <h1 className="font-display text-3xl font-bold text-ps-text dark:text-white">Harm signals</h1>
        <p className="mt-2 text-ps-muted dark:text-ps-muted-on-dark">
          Markers of harm raised by the 15-minute scan. The customer has already been shown a
          supportive message; review each one and decide whether to do more.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SCOPES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setScope(option)}
            className={`rounded-full border px-3 py-1 text-sm ${
              scope === option
                ? 'border-ps-lime bg-ps-lime/10 text-ps-lime'
                : 'border-[var(--ps-border-light)] text-ps-muted dark:border-[var(--ps-border-dark)]'
            }`}
          >
            {option === 'all' ? 'All' : label(option)}
          </button>
        ))}
      </div>

      <Card className="overflow-x-auto">
        {signals === null ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : signals.length === 0 ? (
          <p className="py-10 text-center text-ps-muted">No signals here.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
                {['Raised', 'Customer', 'Marker', 'Severity', 'Interactions', 'Status'].map((header) => (
                  <th key={header} className="py-2 pr-4 font-mono text-[11px] uppercase tracking-widest text-ps-muted dark:text-ps-muted-on-dark">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signals.map((signal) => (
                <tr key={signal.id} className="border-b border-[var(--ps-border-light)] last:border-0 dark:border-[var(--ps-border-dark)]">
                  <td className="py-2 pr-4 tabular-nums">
                    <Link href={`/admin/harm-signals/${signal.id}`} className="text-ps-lime hover:underline">
                      {new Date(signal.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">
                    {signal.user.displayName}
                    <span className="block text-xs text-ps-muted dark:text-ps-muted-on-dark">{signal.user.email}</span>
                  </td>
                  <td className="py-2 pr-4">{label(signal.type)}</td>
                  <td className={`py-2 pr-4 ${signal.severity === 'high' ? 'font-semibold text-ps-error' : ''}`}>{signal.severity}</td>
                  <td className="py-2 pr-4 tabular-nums">{signal._count.interactions}</td>
                  <td className="py-2 pr-4">
                    <StatusPill status={signal.status === 'OPEN' ? 'waiting' : 'settled'} label={signal.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <CardTitle>How well interactions work</CardTitle>
        <p className="mt-1 text-sm text-ps-muted dark:text-ps-muted-on-dark">
          Outcomes are recorded automatically 14 days after each interaction, from what the
          customer did next. Use this to decide which responses to keep, change or escalate.
        </p>
        {effectiveness.length === 0 ? (
          <p className="py-6 text-sm text-ps-muted">No interactions yet.</p>
        ) : (
          <table className="mt-4 w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]">
                <th className="py-2 pr-3 font-mono uppercase tracking-widest text-ps-muted">Marker</th>
                <th className="py-2 pr-3 font-mono uppercase tracking-widest text-ps-muted">Interaction</th>
                {OUTCOME_COLUMNS.map((column) => (
                  <th key={column} className="py-2 pr-3 font-mono uppercase tracking-widest text-ps-muted">{label(column)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {effectiveness.map((row) => (
                <tr key={`${row.signalType}-${row.interactionType}`} className="border-b border-[var(--ps-border-light)] last:border-0 dark:border-[var(--ps-border-dark)]">
                  <td className="py-2 pr-3">{label(row.signalType)}</td>
                  <td className="py-2 pr-3">{label(row.interactionType)}</td>
                  {OUTCOME_COLUMNS.map((column) => (
                    <td key={column} className="py-2 pr-3 tabular-nums">{row.outcomes[column] ?? 0}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
