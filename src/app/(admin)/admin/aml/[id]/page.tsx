'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { StatusPill } from '@/components/ui/playstake/StatusPill';
import { useToast } from '@/components/ui/Toast';

interface AmlCaseDetail {
  id: string;
  type: string;
  status: string;
  severity: string;
  details: Record<string, unknown>;
  mlroDecision: string | null;
  sarReference: string | null;
  closedAt: string | null;
  createdAt: string;
  assignedTo: { displayName: string } | null;
  user: {
    id: string;
    displayName: string;
    email: string;
    accountStatus: string;
    kycStatus: string;
    createdAt: string;
    kycSubmissions: { legalFirstName: string; legalLastName: string; dateOfBirth: string; country: string }[];
  };
  relatedUser: { id: string; displayName: string; email: string; accountStatus: string } | null;
  notes: { id: string; body: string; createdAt: string; author: { displayName: string } }[];
  otherCases: { id: string; type: string; status: string; severity: string; createdAt: string }[];
}

const label = (value: string) => value.replace(/_/g, ' ').toLowerCase();
const when = (value: string) =>
  new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const fieldClass =
  'w-full rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] bg-ps-paper p-2.5 text-sm text-ps-text focus:outline-none focus:ring-2 focus:ring-ps-lime/60 dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2 dark:text-ps-text-on-dark';

export default function AdminAmlCasePage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [data, setData] = useState<AmlCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [decision, setDecision] = useState('');
  const [sarReference, setSarReference] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/aml/${id}`, { cache: 'no-store' });
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
      const res = await fetch(`/api/admin/aml/${id}`, {
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
  if (!data) return <Card><p className="text-ps-error">Case not found.</p></Card>;

  const closed = data.status.startsWith('CLOSED');
  const identity = data.user.kycSubmissions[0];
  const decisionReady = decision.trim().length >= 10;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/aml" className="text-sm text-ps-muted hover:underline">&larr; AML cases</Link>
          <h1 className="mt-1 font-display text-2xl font-bold capitalize text-ps-text dark:text-white">{label(data.type)}</h1>
          <p className="text-sm text-ps-muted dark:text-ps-muted-on-dark">
            Opened {when(data.createdAt)} · {data.severity} severity · {data.assignedTo ? `assigned to ${data.assignedTo.displayName}` : 'unassigned'}
          </p>
        </div>
        <StatusPill status={closed ? 'settled' : 'disputed'} label={label(data.status)} />
      </div>

      <Card>
        <CardTitle>Customer</CardTitle>
        <div className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          <Link href={`/admin/users/${data.user.id}`} className="text-ps-lime hover:underline">{data.user.displayName} · {data.user.email}</Link>
          <span>Account {label(data.user.accountStatus)} · KYC {label(data.user.kycStatus)}</span>
          {identity && (
            <span>
              {identity.legalFirstName} {identity.legalLastName} · born {identity.dateOfBirth.slice(0, 10)} · {identity.country}
            </span>
          )}
          <span>Joined {when(data.user.createdAt)}</span>
        </div>
        {data.relatedUser && (
          <p className="mt-3 text-sm">
            Related account:{' '}
            <Link href={`/admin/users/${data.relatedUser.id}`} className="text-ps-lime hover:underline">
              {data.relatedUser.displayName} · {data.relatedUser.email}
            </Link>{' '}
            ({label(data.relatedUser.accountStatus)})
          </p>
        )}
        <p className="mt-3 text-xs text-ps-muted">
          To suspend or close either account, use the customer&apos;s page (it asks for a reason and is audited).
        </p>
      </Card>

      <Card>
        <CardTitle>Why this was raised</CardTitle>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {Object.entries(data.details).map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-ps-muted">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</dt>
              <dd className="break-words font-mono">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
            </div>
          ))}
        </dl>
        {data.otherCases.length > 0 && (
          <p className="mt-3 text-xs text-ps-muted">
            Other cases on this customer:{' '}
            {data.otherCases.map((other, index) => (
              <span key={other.id}>
                {index > 0 && ', '}
                <Link href={`/admin/aml/${other.id}`} className="underline">{label(other.type)} ({label(other.status)})</Link>
              </span>
            ))}
          </p>
        )}
      </Card>

      <Card>
        <CardTitle>Notes and decisions</CardTitle>
        {data.mlroDecision && (
          <pre className="mt-3 whitespace-pre-wrap rounded-[var(--ps-radius-md)] bg-ps-paper p-3 font-mono text-xs dark:bg-ps-ink-2">{data.mlroDecision}</pre>
        )}
        {data.sarReference && <p className="mt-2 text-sm">NCA SAR reference: <span className="font-mono">{data.sarReference}</span></p>}
        <ol className="mt-3 space-y-2 text-sm">
          {data.notes.map((entry) => (
            <li key={entry.id} className="border-l-2 border-[var(--ps-border-light)] pl-3 dark:border-[var(--ps-border-dark)]">
              <p className="text-xs text-ps-muted">{entry.author.displayName} · {when(entry.createdAt)}</p>
              <p className="whitespace-pre-wrap">{entry.body}</p>
            </li>
          ))}
        </ol>
        <textarea className={`${fieldClass} mt-3 min-h-[70px]`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Investigation note" />
        <PSButton size="sm" className="mt-2" disabled={busy || note.trim().length < 3} onClick={() => act({ kind: 'note', body: note }, 'Note added.', () => setNote(''))}>
          Add note
        </PSButton>
      </Card>

      {!closed && (
        <Card className="border-ps-lime/40">
          <CardTitle>Decide</CardTitle>
          {!data.assignedTo && (
            <PSButton size="sm" variant="secondary" className="mt-3" disabled={busy} onClick={() => act({ kind: 'assign' }, 'Assigned to you.')}>
              Assign to me
            </PSButton>
          )}
          <textarea className={`${fieldClass} mt-3 min-h-[100px]`} value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="Reasoning for this decision (at least 10 characters) — recorded against the case" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {data.status !== 'ESCALATED_TO_MLRO' && (
              <PSButton size="sm" variant="secondary" disabled={busy || !decisionReady} onClick={() => act({ kind: 'escalate', decision }, 'Escalated to the MLRO.', () => setDecision(''))}>
                Escalate to MLRO
              </PSButton>
            )}
            <input className={`${fieldClass} w-48`} value={sarReference} onChange={(e) => setSarReference(e.target.value)} placeholder="NCA SAR reference" />
            <PSButton size="sm" variant="danger" disabled={busy || !decisionReady || sarReference.trim().length < 3} onClick={() => act({ kind: 'sar', sarReference, decision }, 'SAR recorded.', () => setDecision(''))}>
              Record SAR submitted
            </PSButton>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <PSButton size="sm" disabled={busy || !decisionReady} onClick={() => act({ kind: 'close', outcome: 'CLOSED_NO_ACTION', decision }, 'Closed — no further action.')}>
              Close: no suspicion
            </PSButton>
            <PSButton size="sm" variant="ghost" disabled={busy || !decisionReady} onClick={() => act({ kind: 'close', outcome: 'CLOSED_ACTION_TAKEN', decision }, 'Closed — action taken.')}>
              Close: action taken
            </PSButton>
          </div>
          <p className="mt-3 text-xs text-ps-muted">
            Closing with no suspicion releases held withdrawals of the same kind for 7 days. Do not
            tell the customer a SAR has been considered or filed (tipping off is an offence).
          </p>
        </Card>
      )}
    </div>
  );
}
