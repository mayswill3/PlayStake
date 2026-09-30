'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { StatusPill } from '@/components/ui/playstake/StatusPill';
import { useToast } from '@/components/ui/Toast';
import { formatCents } from '@/lib/utils/format';

interface Interaction {
  id: string;
  type: string;
  message: string;
  outcome: string;
  outcomeNotes: string | null;
  acknowledgedAt: string | null;
  followUpAt: string | null;
  createdAt: string;
  createdBy: { displayName: string } | null;
}

interface SignalDetail {
  signal: {
    id: string;
    type: string;
    severity: string;
    status: string;
    details: Record<string, unknown>;
    windowStart: string;
    windowEnd: string;
    reviewNotes: string | null;
    reviewedAt: string | null;
    reviewedBy: { displayName: string } | null;
    createdAt: string;
    user: { id: string; displayName: string; email: string; accountStatus: string };
  };
  interactions: Interaction[];
  otherSignals: { id: string; type: string; severity: string; status: string; createdAt: string }[];
  last30: { depositedCents: number; stakedCents: number };
}

const OUTCOMES = [
  'ACKNOWLEDGED',
  'CUSTOMER_SET_LIMIT',
  'CUSTOMER_TOOK_BREAK',
  'BEHAVIOUR_IMPROVED',
  'BEHAVIOUR_UNCHANGED',
  'ESCALATED',
  'NO_RESPONSE',
];

const label = (value: string) => value.replace(/_/g, ' ').toLowerCase();
const when = (value: string) =>
  new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const fieldClass =
  'w-full rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] bg-ps-paper p-2.5 text-sm text-ps-text focus:outline-none focus:ring-2 focus:ring-ps-lime/60 dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2 dark:text-ps-text-on-dark';

export default function AdminHarmSignalPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [data, setData] = useState<SignalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [interactionType, setInteractionType] = useState<'PHONE_CALL' | 'EMAIL' | 'NOTE'>('PHONE_CALL');
  const [interactionText, setInteractionText] = useState('');
  const [limitPeriod, setLimitPeriod] = useState('WEEKLY');
  const [limitAmount, setLimitAmount] = useState('');
  const [coolOff, setCoolOff] = useState('72h');
  const [actionNote, setActionNote] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/harm-signals/${id}`, { cache: 'no-store' });
      setData(res.ok ? await res.json() : null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(body: Record<string, unknown>, done: string, reset?: () => void) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/harm-signals/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast('error', json.error ?? 'That did not work.');
        return;
      }
      setData(json);
      reset?.();
      toast('success', done);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!data) return <Card><p className="text-ps-error">Signal not found.</p></Card>;
  const { signal } = data;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/harm-signals" className="text-sm text-ps-muted hover:underline">&larr; Harm signals</Link>
          <h1 className="mt-1 font-display text-2xl font-bold capitalize text-ps-text dark:text-white">{label(signal.type)}</h1>
          <p className="text-sm text-ps-muted dark:text-ps-muted-on-dark">
            <Link href={`/admin/users/${signal.user.id}`} className="text-ps-lime hover:underline">{signal.user.displayName}</Link>
            {' '}· {signal.user.email} · account {label(signal.user.accountStatus)} · raised {when(signal.createdAt)}
          </p>
        </div>
        <StatusPill status={signal.status === 'OPEN' ? 'waiting' : 'settled'} label={`${signal.severity} · ${signal.status}`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="font-mono text-xs uppercase text-ps-muted">Deposited, 30 days</p>
          <p className="font-display text-2xl font-bold">{formatCents(data.last30.depositedCents)}</p>
        </Card>
        <Card>
          <p className="font-mono text-xs uppercase text-ps-muted">Staked, 30 days</p>
          <p className="font-display text-2xl font-bold">{formatCents(data.last30.stakedCents)}</p>
        </Card>
        <Card>
          <p className="font-mono text-xs uppercase text-ps-muted">Other signals</p>
          <p className="font-display text-2xl font-bold">{data.otherSignals.length}</p>
        </Card>
      </div>

      <Card>
        <CardTitle>What was observed</CardTitle>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {Object.entries(signal.details).map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-ps-muted">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</dt>
              <dd className="font-mono">{String(value)}</dd>
            </div>
          ))}
          <dt className="text-ps-muted">window</dt>
          <dd className="font-mono">{when(signal.windowStart)} – {when(signal.windowEnd)}</dd>
        </dl>
      </Card>

      <Card>
        <CardTitle>Interactions with this customer</CardTitle>
        {data.interactions.length === 0 ? (
          <p className="mt-3 text-sm text-ps-muted">None yet.</p>
        ) : (
          <ol className="mt-3 space-y-4 text-sm">
            {data.interactions.map((interaction) => (
              <li key={interaction.id} className="border-l-2 border-[var(--ps-border-light)] pl-3 dark:border-[var(--ps-border-dark)]">
                <p className="text-xs text-ps-muted">
                  {label(interaction.type)} · {interaction.createdBy?.displayName ?? 'automatic'} · {when(interaction.createdAt)}
                  {interaction.acknowledgedAt ? ` · seen ${when(interaction.acknowledgedAt)}` : ''}
                </p>
                <p className="mt-1">{interaction.message}</p>
                <p className="mt-1 text-xs">
                  <span className="font-semibold">Outcome: {label(interaction.outcome)}</span>
                  {interaction.outcomeNotes ? ` — ${interaction.outcomeNotes}` : ''}
                  {interaction.followUpAt && interaction.outcome === 'PENDING' ? ` · evaluated ${when(interaction.followUpAt)}` : ''}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {OUTCOMES.filter((outcome) => outcome !== interaction.outcome).map((outcome) => (
                    <button
                      key={outcome}
                      type="button"
                      disabled={busy}
                      onClick={() => act({ kind: 'outcome', interactionId: interaction.id, outcome, notes: 'Recorded by staff' }, 'Outcome recorded.')}
                      className="rounded-full border border-[var(--ps-border-light)] px-2 py-0.5 text-[11px] text-ps-muted hover:border-ps-lime/60 dark:border-[var(--ps-border-dark)]"
                    >
                      {label(outcome)}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card>
        <CardTitle>Reach out or step in</CardTitle>
        <div className="mt-3 space-y-5 text-sm">
          <div>
            <p className="mb-1 font-medium">Record a contact</p>
            <div className="mb-2 flex gap-2">
              {(['PHONE_CALL', 'EMAIL', 'NOTE'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setInteractionType(type)}
                  className={`rounded-full border px-3 py-1 text-xs ${interactionType === type ? 'border-ps-lime bg-ps-lime/10 text-ps-lime' : 'border-[var(--ps-border-light)] text-ps-muted dark:border-[var(--ps-border-dark)]'}`}
                >
                  {label(type)}
                </button>
              ))}
            </div>
            <textarea className={`${fieldClass} min-h-[80px]`} value={interactionText} onChange={(e) => setInteractionText(e.target.value)} placeholder="What was said or done" />
            <PSButton size="sm" className="mt-2" disabled={busy || interactionText.trim().length < 10} onClick={() => act({ kind: 'interaction', type: interactionType, message: interactionText }, 'Interaction recorded.', () => setInteractionText(''))}>
              Record
            </PSButton>
          </div>

          <div>
            <p className="mb-1 font-medium">Apply a deposit limit (can only lower their limit)</p>
            <div className="flex flex-wrap items-center gap-2">
              <select className={`${fieldClass} w-auto`} value={limitPeriod} onChange={(e) => setLimitPeriod(e.target.value)}>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
              <input className={`${fieldClass} w-32`} type="number" min="1" step="0.01" placeholder="$ amount" value={limitAmount} onChange={(e) => setLimitAmount(e.target.value)} />
              <PSButton size="sm" variant="secondary" disabled={busy || !(parseFloat(limitAmount) > 0)} onClick={() => act({ kind: 'apply_limit', period: limitPeriod, amountCents: Math.round(parseFloat(limitAmount) * 100), message: actionNote }, 'Limit applied.', () => setLimitAmount(''))}>
                Apply limit
              </PSButton>
            </div>
          </div>

          <div>
            <p className="mb-1 font-medium">Apply a cool-off</p>
            <div className="flex flex-wrap items-center gap-2">
              <select className={`${fieldClass} w-auto`} value={coolOff} onChange={(e) => setCoolOff(e.target.value)}>
                <option value="24h">24 hours</option>
                <option value="72h">72 hours</option>
                <option value="1w">1 week</option>
                <option value="1m">1 month</option>
                <option value="6w">6 weeks</option>
              </select>
              <PSButton size="sm" variant="danger" disabled={busy} onClick={() => act({ kind: 'apply_cool_off', optionId: coolOff, message: actionNote }, 'Cool-off applied.')}>
                Apply cool-off
              </PSButton>
            </div>
            <input className={`${fieldClass} mt-2`} placeholder="Why (recorded with the limit or cool-off)" value={actionNote} onChange={(e) => setActionNote(e.target.value)} />
          </div>

          <p className="text-xs text-ps-muted">
            To restrict the account entirely, suspend it from the{' '}
            <Link href={`/admin/users/${signal.user.id}`} className="underline">customer&apos;s page</Link>.
          </p>
        </div>
      </Card>

      <Card className="border-ps-lime/40">
        <CardTitle>Review</CardTitle>
        {signal.reviewedAt ? (
          <p className="mt-2 text-sm">
            {signal.status.toLowerCase()} by {signal.reviewedBy?.displayName} on {when(signal.reviewedAt)}: {signal.reviewNotes}
          </p>
        ) : (
          <>
            <textarea className={`${fieldClass} mt-3 min-h-[90px]`} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="What you found and what you decided (at least 10 characters)" />
            <div className="mt-2 flex gap-2">
              <PSButton size="sm" disabled={busy || reviewNotes.trim().length < 10} onClick={() => act({ kind: 'review', status: 'REVIEWED', notes: reviewNotes }, 'Signal reviewed.')}>
                Mark reviewed
              </PSButton>
              <PSButton size="sm" variant="ghost" disabled={busy || reviewNotes.trim().length < 10} onClick={() => act({ kind: 'review', status: 'DISMISSED', notes: reviewNotes }, 'Signal dismissed.')}>
                Dismiss
              </PSButton>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
