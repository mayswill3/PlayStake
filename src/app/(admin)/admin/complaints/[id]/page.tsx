'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { StatusPill } from '@/components/ui/playstake/StatusPill';
import { useToast } from '@/components/ui/Toast';

interface ComplaintDetail {
  id: string;
  reference: string;
  name: string;
  email: string;
  category: string;
  description: string;
  betId: string | null;
  status: string;
  receivedAt: string;
  acknowledgedAt: string | null;
  finalResponseDueAt: string;
  finalResponse: string | null;
  finalResponseAt: string | null;
  outcome: string | null;
  user: { id: string; displayName: string; email: string } | null;
  events: {
    id: string;
    type: string;
    body: string | null;
    visibleToCustomer: boolean;
    createdAt: string;
    actor: { displayName: string } | null;
  }[];
}

const OUTCOMES = [
  { value: 'UPHELD', label: 'Upheld' },
  { value: 'PARTIALLY_UPHELD', label: 'Partially upheld' },
  { value: 'NOT_UPHELD', label: 'Not upheld' },
];

const textareaClass =
  'w-full min-h-[110px] resize-y rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] bg-ps-paper p-3 text-sm text-ps-text focus:outline-none focus:ring-2 focus:ring-ps-lime/60 dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2 dark:text-ps-text-on-dark';

function when(value: string) {
  return new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminComplaintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [outcome, setOutcome] = useState('');
  const [response, setResponse] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/complaints/${id}`, { cache: 'no-store' });
      setComplaint(res.ok ? await res.json() : null);
    } catch {
      setComplaint(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(body: Record<string, string>, done: string, reset?: () => void) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/complaints/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast('error', data.error ?? 'That did not work.');
        return;
      }
      setComplaint(data);
      reset?.();
      toast('success', done);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!complaint) return <Card><p className="text-ps-error">Complaint not found.</p></Card>;

  const closed = complaint.status === 'FINAL_RESPONSE_ISSUED';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/complaints" className="text-sm text-ps-muted hover:underline">&larr; Complaints</Link>
          <h1 className="mt-1 font-display text-2xl font-bold text-ps-text dark:text-white">{complaint.reference}</h1>
          <p className="text-sm text-ps-muted dark:text-ps-muted-on-dark">
            {complaint.name} · {complaint.email} · {complaint.category.replace(/_/g, ' ').toLowerCase()}
          </p>
        </div>
        <StatusPill status={closed ? 'settled' : 'waiting'} label={complaint.status.replace(/_/g, ' ')} />
      </div>

      <Card>
        <CardTitle>Complaint</CardTitle>
        <p className="mt-3 whitespace-pre-wrap text-sm text-ps-text dark:text-ps-text-on-dark">{complaint.description}</p>
        <div className="mt-4 grid gap-1 text-xs text-ps-muted dark:text-ps-muted-on-dark sm:grid-cols-2">
          <span>Received {when(complaint.receivedAt)}</span>
          <span>Acknowledged {complaint.acknowledgedAt ? when(complaint.acknowledgedAt) : '—'}</span>
          <span>Final response due {when(complaint.finalResponseDueAt)}</span>
          {complaint.user && (
            <Link href={`/admin/users/${complaint.user.id}`} className="text-ps-lime hover:underline">
              Customer account: {complaint.user.displayName}
            </Link>
          )}
          {complaint.betId && (
            <span>Bet: <span className="font-mono">{complaint.betId}</span></span>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>History</CardTitle>
        <ol className="mt-3 space-y-3 text-sm">
          {complaint.events.map((event) => (
            <li key={event.id} className="border-l-2 border-[var(--ps-border-light)] pl-3 dark:border-[var(--ps-border-dark)]">
              <p className="text-xs text-ps-muted dark:text-ps-muted-on-dark">
                {event.type.replace(/_/g, ' ')} · {event.actor?.displayName ?? 'system'} · {when(event.createdAt)}
                {event.visibleToCustomer ? ' · sent to customer' : ' · internal'}
              </p>
              {event.body && event.type !== 'received' && (
                <p className="mt-1 whitespace-pre-wrap text-ps-text dark:text-ps-text-on-dark">{event.body}</p>
              )}
            </li>
          ))}
        </ol>
      </Card>

      {closed ? (
        <Card>
          <CardTitle>Final response ({complaint.outcome?.replace(/_/g, ' ').toLowerCase()})</CardTitle>
          <p className="mt-3 whitespace-pre-wrap text-sm">{complaint.finalResponse}</p>
          <p className="mt-3 text-xs text-ps-muted">
            The customer was told they can refer this to IBAS if they are not satisfied.
          </p>
        </Card>
      ) : (
        <>
          <Card>
            <CardTitle>Work on it</CardTitle>
            <div className="mt-3 flex flex-wrap gap-2">
              <PSButton size="sm" variant="secondary" disabled={busy} onClick={() => act({ kind: 'status', status: 'INVESTIGATING' }, 'Marked as investigating.')}>
                Mark investigating
              </PSButton>
              <PSButton size="sm" variant="secondary" disabled={busy} onClick={() => act({ kind: 'status', status: 'AWAITING_CUSTOMER' }, 'Marked as awaiting the customer.')}>
                Awaiting customer
              </PSButton>
            </div>
            <label className="mt-4 block text-sm">
              <span className="mb-1 block font-medium">Internal note</span>
              <textarea className={textareaClass} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <PSButton size="sm" className="mt-2" disabled={busy || note.trim().length < 3} onClick={() => act({ kind: 'note', body: note }, 'Note added.', () => setNote(''))}>
              Add note
            </PSButton>
            <label className="mt-4 block text-sm">
              <span className="mb-1 block font-medium">Message the customer (emailed)</span>
              <textarea className={textareaClass} value={message} onChange={(e) => setMessage(e.target.value)} />
            </label>
            <PSButton size="sm" className="mt-2" disabled={busy || message.trim().length < 10} onClick={() => act({ kind: 'message', body: message }, 'Message sent.', () => setMessage(''))}>
              Send message
            </PSButton>
          </Card>

          <Card className="border-ps-lime/40">
            <CardTitle>Issue final response</CardTitle>
            <p className="mt-1 text-sm text-ps-muted dark:text-ps-muted-on-dark">
              Explain the outcome, the reasons, and anything you will do to put it right. The
              email automatically tells the customer how to refer the complaint to IBAS.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {OUTCOMES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setOutcome(option.value)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    outcome === option.value
                      ? 'border-ps-lime bg-ps-lime/10 text-ps-lime'
                      : 'border-[var(--ps-border-light)] text-ps-muted dark:border-[var(--ps-border-dark)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <textarea className={`${textareaClass} mt-3 min-h-[160px]`} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="At least 50 characters" />
            <PSButton
              className="mt-2"
              disabled={busy || !outcome || response.trim().length < 50}
              onClick={() => act({ kind: 'final_response', outcome, response }, 'Final response sent.')}
            >
              Send final response
            </PSButton>
          </Card>
        </>
      )}
    </div>
  );
}
