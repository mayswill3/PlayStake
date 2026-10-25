'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { DisputeEvidence, type DisputeEvidenceData } from '@/components/disputes/DisputeEvidence';
import { DisputeDecisionForm } from '@/components/disputes/DisputeDecisionForm';

type Evidence = DisputeEvidenceData & { viewerIsAdmin: boolean };

/** Review one dispute: the evidence, take it, then decide it with reasons. */
export default function DisputeReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<Evidence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/referees/disputes/${id}`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? 'You can’t review this dispute.');
      return;
    }
    setData(body);
  }, [id]);

  useEffect(() => {
    void load();
    void fetch('/api/user/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => setMe(p?.id ?? null))
      .catch(() => undefined);
  }, [load]);

  async function claim() {
    setBusy(true);
    try {
      const res = await fetch(`/api/referees/disputes/${id}`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) toast('error', body.error ?? 'Could not take this dispute.');
      else toast('success', 'You’ve taken this dispute.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function decide(status: string, resolution: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/referees/disputes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resolution }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast('error', body.error ?? 'Could not record the decision.');
        return;
      }
      toast('success', 'Decision recorded. Both players have been told.');
      router.push('/referee');
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="font-display text-xl font-bold text-ps-text dark:text-ps-text-on-dark">{error}</p>
        <Link href="/referee" className="mt-4 inline-block underline">Back to the Referee Hub</Link>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const open = data.status === 'OPEN' || data.status === 'UNDER_REVIEW';
  const takenByMe = data.reviewer?.id === me;
  const playerA = data.bet.playerA.displayName;
  const playerB = data.bet.playerB?.displayName ?? 'Player B';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <Link href="/referee" className="text-sm text-ps-muted hover:underline dark:text-ps-muted-on-dark">← Referee Hub</Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-ps-text dark:text-ps-text-on-dark">
          Dispute review · {playerA} vs {playerB}
        </h1>
      </div>

      <DisputeEvidence data={data} />

      <Card>
        <CardTitle>Decision</CardTitle>
        {!open ? (
          <p className="mt-2 text-sm">This dispute has been decided: {data.resolution}</p>
        ) : !takenByMe && !data.viewerIsAdmin ? (
          <div className="mt-2 space-y-3">
            <p className="text-sm text-ps-muted dark:text-ps-muted-on-dark">
              Take the dispute first, so nobody else decides it at the same time. Only take it if you can review it
              now and you don&apos;t know either player.
            </p>
            <Button loading={busy} onClick={claim}>Take this dispute</Button>
          </div>
        ) : (
          <div className="mt-3">
            <DisputeDecisionForm playerA={playerA} playerB={playerB} busy={busy} onDecide={decide} />
          </div>
        )}
      </Card>
    </div>
  );
}
