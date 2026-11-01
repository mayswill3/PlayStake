'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Lock, ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { FadeIn } from '@/components/ui/FadeIn';
import { useToast } from '@/components/ui/Toast';
import { RecordingPlayer, VoicePart, adminLoader, type PlaybackRecording } from '@/components/disputes/DisputeEvidence';
import { formatDate } from '@/lib/utils/format';

interface AdminRecording extends PlaybackRecording {
  role: PlaybackRecording['role'];
  retainUntil: string | null;
  deletedAt: string | null;
  heldAt: string | null;
  heldReason: string | null;
}

interface MatchDetail {
  id: string;
  status: string;
  amount: string;
  outcome: string | null;
  createdAt: string;
  game: { name: string };
  playerA: { id: string; displayName: string };
  playerB: { id: string; displayName: string } | null;
  refereeAssignment: {
    status: string;
    startedAt: string | null;
    decisionSubmittedAt: string | null;
    refereeProfile: { user: { id: string; displayName: string } } | null;
  } | null;
  disputes: Array<{ id: string; status: string }>;
  recordings: AdminRecording[];
  conflict: string | null;
}

const label = 'text-xs font-semibold text-text-secondary';
/** A calendar date ("1 December 2026"), which also works for dates in the future. */
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export default function AdminMatchPage() {
  const { betId } = useParams<{ betId: string }>();
  const { toast } = useToast();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState<{ reason: string; note: string } | null>(null);
  const [holdReason, setHoldReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/matches/${betId}`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? 'Failed to load the match.');
    setMatch(body.match);
    setReasons(body.reasons);
  }, [betId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleHold(hold: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/matches/${betId}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hold, reason: holdReason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return toast('error', body.error ?? 'Could not change the hold.');
      toast('success', hold ? 'Recordings placed on hold.' : 'Hold released; normal retention restored.');
      setHoldReason('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (error) return <div className="mx-auto max-w-4xl rounded-sm border border-danger-500/25 bg-danger-500/10 p-4 text-sm text-danger-400">{error}</div>;
  if (!match) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const live = match.recordings.filter((r) => !r.deletedAt);
  const composite = live.find((r) => r.role === 'COMPOSITE');
  const voice = live.filter((r) => r.role === 'VOICE').sort((a, b) => (a.segment ?? 0) - (b.segment ?? 0));
  const held = live.find((r) => r.heldAt);
  const videoStart = composite ? new Date(composite.startedAt).getTime() : null;
  const at = (iso: string | null | undefined) => (iso && videoStart ? (new Date(iso).getTime() - videoStart) / 1000 : null);
  const jumps = [
    { label: 'Match start', seconds: at(match.refereeAssignment?.startedAt) },
    { label: 'Result recorded', seconds: at(match.refereeAssignment?.decisionSubmittedAt) },
  ].filter((jump): jump is { label: string; seconds: number } => jump.seconds !== null);

  return (
    <FadeIn>
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/admin/matches" className="text-sm text-text-secondary hover:text-text-primary">← Matches</Link>
        <h1 className="font-display text-2xl font-bold text-text-primary">
          {match.playerA.displayName} vs {match.playerB?.displayName ?? '—'}
        </h1>

        <Card>
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_1fr]">
            <dt className="text-text-secondary">Game</dt><dd className="text-text-primary">{match.game.name}</dd>
            <dt className="text-text-secondary">Stake</dt><dd className="text-text-primary">£{Number(match.amount).toFixed(2)} each</dd>
            <dt className="text-text-secondary">Status</dt><dd className="text-text-primary">{match.status}{match.outcome ? ` · ${match.outcome}` : ''}</dd>
            <dt className="text-text-secondary">Referee</dt><dd className="text-text-primary">{match.refereeAssignment?.refereeProfile?.user.displayName ?? '—'}</dd>
            <dt className="text-text-secondary">Agreed</dt><dd className="text-text-primary">{formatDate(match.createdAt)}</dd>
            {match.disputes.length > 0 && (
              <>
                <dt className="text-text-secondary">Disputes</dt>
                <dd className="space-x-2">
                  {match.disputes.map((d) => (
                    <Link key={d.id} href={`/admin/disputes/${d.id}`} className="text-brand-400 underline">{d.status}</Link>
                  ))}
                </dd>
              </>
            )}
          </dl>
        </Card>

        <Card>
          <h2 className="mb-1 font-display text-lg font-semibold text-text-primary">Recordings</h2>
          <p className="mb-4 text-xs text-text-secondary">
            Recordings show players&apos; faces, voices and homes. Open them only for one of the reasons below. Every
            viewing is logged with your reason and note, and reviewed by the compliance lead.
          </p>

          {match.conflict ? (
            <p className="flex items-start gap-2 text-sm text-amber-400"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />{match.conflict}</p>
          ) : live.length === 0 ? (
            <p className="text-sm text-text-secondary">No recordings are held for this match.</p>
          ) : !confirmed ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (reason && note.trim().length >= 5) setConfirmed({ reason, note: note.trim() });
              }}
            >
              <div>
                <p className={label}>Why do you need to open these recordings?</p>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full max-w-md rounded-sm border border-surface-700 bg-transparent px-3 py-2 text-sm text-text-primary"
                  required
                >
                  <option value="">Choose a reason…</option>
                  {Object.entries(reasons).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </select>
              </div>
              <div>
                <p className={label}>Note (case, complaint or reference)</p>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  minLength={5}
                  required
                  className="mt-1 w-full max-w-md rounded-sm border border-surface-700 bg-transparent px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <button type="submit" disabled={!reason || note.trim().length < 5} className="rounded-sm border border-brand-400/25 bg-brand-400/10 px-4 py-2 text-sm text-brand-400 disabled:opacity-50">
                Continue
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              <p className="text-xs text-text-secondary">
                Reason: <span className="text-text-primary">{reasons[confirmed.reason]}</span> · {confirmed.note}{' '}
                <button type="button" onClick={() => setConfirmed(null)} className="underline">Change</button>
              </p>
              <div>
                <p className={label}>Match video (all three streams)</p>
                {composite?.status === 'READY' ? (
                  <RecordingPlayer loadUrl={adminLoader(match.id, composite.id, confirmed.reason, confirmed.note)} recording={composite} jumps={jumps} />
                ) : (
                  <p className="mt-1 text-sm text-text-secondary">{composite ? `Not available (${composite.status.toLowerCase()})` : 'No video for this match.'}</p>
                )}
              </div>
              <div>
                <p className={label}>Voice chat</p>
                {voice.length === 0 ? (
                  <p className="mt-1 text-sm text-text-secondary">No voice chat was recorded for this match.</p>
                ) : (
                  <ul className="mt-2 space-y-3">
                    {voice.map((recording, index) => (
                      <VoicePart key={recording.id} loadUrl={adminLoader(match.id, recording.id, confirmed.reason, confirmed.note)} recording={recording} index={index} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Card>

        {live.length > 0 && !match.conflict && (
          <Card>
            <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-text-primary"><Lock className="h-4 w-4" />Investigation hold</h2>
            {held ? (
              <p className="mb-3 text-sm text-text-secondary">
                On hold since {day(held.heldAt!)}: {held.heldReason}. These recordings won&apos;t be deleted until the hold is released.
              </p>
            ) : (
              <p className="mb-3 text-sm text-text-secondary">
                Normally deleted {live[0].retainUntil ? `on ${day(live[0].retainUntil)}` : 'after any open dispute is decided'}. Place a hold to keep
                them for an investigation.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <input
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                placeholder={held ? 'Why the hold can be released' : 'Reason for the hold (case or reference)'}
                className="w-full max-w-md rounded-sm border border-surface-700 bg-transparent px-3 py-2 text-sm text-text-primary"
              />
              <button
                type="button"
                disabled={busy || holdReason.trim().length < 5}
                onClick={() => toggleHold(!held)}
                className="rounded-sm border border-brand-400/25 bg-brand-400/10 px-4 py-2 text-sm text-brand-400 disabled:opacity-50"
              >
                {held ? 'Release hold' : 'Place hold'}
              </button>
            </div>
          </Card>
        )}
      </div>
    </FadeIn>
  );
}
