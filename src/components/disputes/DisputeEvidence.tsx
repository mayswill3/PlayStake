'use client';

import { useRef, useState } from 'react';
import { formatCents } from '@/lib/utils/format';

/** The shape returned by getDisputeEvidence (src/lib/disputes/review.ts). */
export interface DisputeEvidenceData {
  id: string;
  status: string;
  reason: string;
  moments: Array<{ at: string; note: string }> | null;
  resolution: string | null;
  createdAt: string;
  reviewer: { id: string; displayName: string } | null;
  filedBy: { id: string; displayName: string };
  messages: Array<{ body: string; createdAt: string; author: { displayName: string; role: string } }>;
  bet: {
    id: string;
    amount: string | number;
    status: string;
    outcome: string | null;
    game: { name: string };
    playerA: { id: string; displayName: string; kickAccount: { channelSlug: string | null } | null };
    playerB: { id: string; displayName: string; kickAccount: { channelSlug: string | null } | null } | null;
    refereeAssignment: null | {
      status: string;
      decision: string | null;
      evidence: { notes?: string } | null;
      startedAt: string | null;
      decisionSubmittedAt: string | null;
      refereeProfile: { user: { id: string; displayName: string; kickAccount: { channelSlug: string | null } | null } } | null;
      auditEvents: Array<{ sequence: number; action: string; createdAt: string; actor: { displayName: string } | null }>;
    };
    chatMessages: Array<{ body: string; createdAt: string; user: { id: string; displayName: string } }>;
    recordings: Array<{
      id: string;
      role: 'PLAYER_A' | 'PLAYER_B' | 'REFEREE' | 'COMPOSITE' | 'VOICE';
      segment?: number;
      channelSlug: string;
      sha256?: string | null;
      status: string;
      startedAt: string;
      endedAt: string | null;
      durationSeconds: number | null;
      failureReason: string | null;
    }>;
  };
}

const DECISION_LABEL: Record<string, string> = {
  PLAYER_A_WIN: 'Player A won',
  PLAYER_B_WIN: 'Player B won',
  DRAW: 'Draw',
};

const ACTION_LABEL: Record<string, string> = {
  ASSIGNMENT_OPENED: 'Match agreed, waiting for a referee',
  ASSIGNMENT_RELEASED: 'Referee released the match',
  ASSIGNMENT_CANCELLED: 'Match cancelled',
  ASSIGNMENT_EXPIRED: 'No referee in time',
  MATCH_OVERRUN: 'Match ran past 2 hours',
  SETTLEMENT_COMPLETED: 'Paid out',
  REFEREE_CLAIMED: 'Referee took the match',
  REFEREE_READY: 'Referee ready',
  MATCH_STARTED: 'Match started',
  DECISION_SUBMITTED: 'Referee recorded the result',
  DISPUTE_FILED: 'Dispute filed',
  DISPUTE_REVIEW_CLAIMED: 'Reviewer took the dispute',
  DISPUTE_RESOLVED: 'Dispute decided',
  RECORDING_SEALED: 'Recording sealed',
};

/** "87:40", "1:02:15" or "18:55 into the match" → seconds, if it reads as a time. */
function momentSeconds(at: string): number | null {
  const match = at.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const [a, b, c] = [match[1], match[2], match[3]].map((part) => (part === undefined ? undefined : Number(part)));
  return c === undefined ? a! * 60 + b! : a! * 3600 + b! * 60 + c;
}

function RecordingPlayer({
  disputeId,
  recording,
  jumps,
}: {
  disputeId: string;
  recording: DisputeEvidenceData['bet']['recordings'][number];
  jumps: Array<{ label: string; seconds: number }>;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/referees/disputes/${disputeId}/recordings/${recording.id}`, { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Could not load the recording');
      setUrl(body.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the recording');
    } finally {
      setLoading(false);
    }
  };

  const seek = (seconds: number) => {
    if (!video.current) return;
    video.current.currentTime = Math.max(0, seconds);
    void video.current.play();
  };

  if (!url) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-md bg-brand-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
        >
          {loading ? 'Loading…' : 'Watch the recording'}
        </button>
        <p className="mt-1 text-xs text-fg-secondary">Each viewing is logged.</p>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      <video ref={video} src={url} controls preload="metadata" className="w-full rounded-md bg-black" />
      {jumps.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {jumps.map((jump, index) => (
            <button
              key={index}
              type="button"
              onClick={() => seek(jump.seconds)}
              className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs text-fg hover:bg-white/5"
            >
              {jump.label}
            </button>
          ))}
        </div>
      )}
      {recording.sha256 && (
        <p className="break-all font-mono text-[11px] text-fg-secondary">SHA-256 {recording.sha256}</p>
      )}
    </div>
  );
}

/** "+12:05" from the match start, or the clock time before it started. */
function relative(at: string, start: string | null): string {
  const time = new Date(at);
  if (!start) return time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const diff = Math.round((time.getTime() - new Date(start).getTime()) / 1000);
  const sign = diff < 0 ? '−' : '+';
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${sign}${h ? `${h}:${pad(m)}` : m}:${pad(s)}`;
}

const panel = 'rounded-lg border border-[var(--border)] p-4';
const heading = 'text-sm font-semibold text-fg';

/** One voice-chat recording: load a private link on demand, then play it. */
function VoicePart({ disputeId, recording, index }: { disputeId: string; recording: DisputeEvidenceData['bet']['recordings'][number]; index: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setError(null);
    const res = await fetch(`/api/referees/disputes/${disputeId}/recordings/${recording.id}`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) setUrl(body.url);
    else setError(body.error ?? 'Could not load the recording');
  };
  const minutes = recording.durationSeconds ? Math.max(1, Math.round(recording.durationSeconds / 60)) : null;
  return (
    <li className="space-y-1">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-fg">Part {index + 1}</span>
        <span className="text-fg-secondary">
          {new Date(recording.startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          {minutes ? ` · ${minutes} min` : ''}
        </span>
        {recording.status === 'READY' && !url && (
          <button type="button" onClick={load} className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs text-fg hover:bg-white/5">
            Listen
          </button>
        )}
        {recording.status === 'FAILED' && <span className="text-xs text-fg-secondary">Recording failed{recording.failureReason ? `: ${recording.failureReason}` : ''}</span>}
      </div>
      {url && <audio src={url} controls preload="metadata" className="w-full" />}
      {recording.sha256 && <p className="break-all font-mono text-[11px] text-fg-secondary">SHA-256 {recording.sha256}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </li>
  );
}

export function DisputeEvidence({ data }: { data: DisputeEvidenceData }) {
  const assignment = data.bet.refereeAssignment;
  const start = assignment?.startedAt ?? null;
  const nameFor = (userId: string) =>
    userId === data.bet.playerA.id
      ? `${data.bet.playerA.displayName} (A)`
      : userId === data.bet.playerB?.id
        ? `${data.bet.playerB.displayName} (B)`
        : userId === assignment?.refereeProfile?.user.id
          ? `${assignment.refereeProfile.user.displayName} (referee)`
          : 'Someone else';

  const composite = data.bet.recordings.find((r) => r.role === 'COMPOSITE');
  const voiceParts = data.bet.recordings
    .filter((r) => r.role === 'VOICE' && r.status !== 'DELETED')
    .sort((a, b) => (a.segment ?? 0) - (b.segment ?? 0));
  // Seek points within the video: it starts when the referee starts the match.
  const videoStart = composite ? new Date(composite.startedAt).getTime() : null;
  const at = (iso: string) => (videoStart ? (new Date(iso).getTime() - videoStart) / 1000 : 0);
  const jumps: Array<{ label: string; seconds: number }> = [
    ...(start ? [{ label: 'Match start', seconds: at(start) }] : []),
    ...(data.moments ?? []).flatMap((moment) => {
      const seconds = momentSeconds(moment.at);
      return seconds === null ? [] : [{ label: `${moment.at} · ${moment.note.slice(0, 30)}`, seconds: seconds + (start ? at(start) : 0) }];
    }),
    ...(assignment?.decisionSubmittedAt ? [{ label: 'Result recorded', seconds: at(assignment.decisionSubmittedAt) }] : []),
  ];
  const participants: Array<{ role: 'PLAYER_A' | 'PLAYER_B' | 'REFEREE'; label: string; channel: string | null }> = [
    { role: 'PLAYER_A', label: `${data.bet.playerA.displayName} (A)`, channel: data.bet.playerA.kickAccount?.channelSlug ?? null },
    { role: 'PLAYER_B', label: `${data.bet.playerB?.displayName ?? '—'} (B)`, channel: data.bet.playerB?.kickAccount?.channelSlug ?? null },
    {
      role: 'REFEREE',
      label: `${assignment?.refereeProfile?.user.displayName ?? '—'} (referee)`,
      channel: assignment?.refereeProfile?.user.kickAccount?.channelSlug ?? null,
    },
  ];

  return (
    <div className="space-y-4">
      <section className={panel}>
        <p className={heading}>The match</p>
        <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_1fr]">
          <dt className="text-fg-secondary">Game</dt>
          <dd className="text-fg">{data.bet.game.name}</dd>
          <dt className="text-fg-secondary">Stake</dt>
          <dd className="text-fg">{formatCents(Math.round(Number(data.bet.amount) * 100))} each</dd>
          <dt className="text-fg-secondary">Referee&apos;s call</dt>
          <dd className="text-fg">
            {assignment?.decision === 'PLAYER_A_WIN'
              ? `${data.bet.playerA.displayName} won`
              : assignment?.decision === 'PLAYER_B_WIN'
                ? `${data.bet.playerB?.displayName ?? 'Player B'} won`
                : assignment?.decision
                  ? DECISION_LABEL[assignment.decision] ?? assignment.decision
                  : 'None recorded'}
            {assignment?.refereeProfile ? ` — ${assignment.refereeProfile.user.displayName}` : ''}
          </dd>
          <dt className="text-fg-secondary">Referee&apos;s notes</dt>
          <dd className="whitespace-pre-wrap text-fg">{assignment?.evidence?.notes || '—'}</dd>
        </dl>
      </section>

      <section className={panel}>
        <p className={heading}>{data.filedBy.displayName}&apos;s dispute</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-fg">{data.reason}</p>
        {data.moments && data.moments.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {data.moments.map((moment, index) => (
              <li key={index}>
                <span className="font-mono font-semibold text-fg">{moment.at}</span>{' '}
                <span className="text-fg-secondary">{moment.note}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={panel}>
        <p className={heading}>Recording</p>
        <p className="mt-1 text-xs text-fg-secondary">
          PlayStake&apos;s recording of all three streams in one synced video, with sound, from when the referee
          started the match until the result. The match clock is shown in the video.
        </p>
        {composite ? (
          composite.status === 'READY' ? (
            <RecordingPlayer disputeId={data.id} recording={composite} jumps={jumps} />
          ) : (
            <p className="mt-3 text-sm text-fg-secondary">
              {composite.status === 'RECORDING'
                ? 'Recording in progress…'
                : composite.status === 'FAILED'
                  ? `The recording failed${composite.failureReason ? `: ${composite.failureReason}` : ''}. Use the players' Kick channels below.`
                  : 'This recording has been deleted under the retention policy.'}
            </p>
          )
        ) : (
          <p className="mt-3 text-sm text-fg-secondary">No PlayStake recording for this match.</p>
        )}
        <p className="mt-4 text-xs font-semibold text-fg-secondary">Voice chat</p>
        {voiceParts.length === 0 ? (
          <p className="mt-1 text-sm text-fg-secondary">No voice chat was recorded for this match.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {voiceParts.map((recording, index) => (
              <VoicePart key={recording.id} disputeId={data.id} recording={recording} index={index} />
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-fg-secondary">Each listen is logged.</p>
        <p className="mt-4 text-xs font-semibold text-fg-secondary">Kick channels</p>
        <ul className="mt-2 space-y-2 text-sm">
          {participants.map((participant) => {
            return (
              <li key={participant.role} className="text-fg">
                {participant.label}
                <span className="text-fg-secondary">
                  {participant.channel ? ` · kick.com/${participant.channel}` : ' · no Kick channel linked'}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {assignment && (
        <section className={panel}>
          <p className={heading}>Timeline</p>
          <p className="mt-1 text-xs text-fg-secondary">Times are from the moment the referee started the match.</p>
          <ol className="mt-3 space-y-1 text-sm">
            {assignment.auditEvents.map((event) => (
              <li key={event.sequence} className="flex gap-3">
                <span className="w-20 shrink-0 font-mono text-fg-secondary">{relative(event.createdAt, start)}</span>
                <span className="text-fg">
                  {ACTION_LABEL[event.action] ?? event.action.replace(/_/g, ' ').toLowerCase()}
                  {event.actor ? <span className="text-fg-secondary"> · {event.actor.displayName}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className={panel}>
        <p className={heading}>Match chat</p>
        {data.bet.chatMessages.length === 0 ? (
          <p className="mt-2 text-sm text-fg-secondary">No messages.</p>
        ) : (
          <ol className="mt-3 max-h-80 space-y-1 overflow-y-auto text-sm">
            {data.bet.chatMessages.map((message, index) => (
              <li key={index} className="flex gap-3">
                <span className="w-20 shrink-0 font-mono text-fg-secondary">{relative(message.createdAt, start)}</span>
                <span className="min-w-0 text-fg">
                  <span className="font-semibold">{nameFor(message.user.id)}:</span> {message.body}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
