'use client';

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
      role: 'PLAYER_A' | 'PLAYER_B' | 'REFEREE';
      channelSlug: string;
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
};

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

  const recordingFor = (role: 'PLAYER_A' | 'PLAYER_B' | 'REFEREE') => data.bet.recordings.find((r) => r.role === role);
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
        <p className={heading}>Recordings</p>
        <p className="mt-1 text-xs text-fg-secondary">
          PlayStake&apos;s own recordings of each stream, from when the referee started the match until the result.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {participants.map((participant) => {
            const recording = recordingFor(participant.role);
            return (
              <li key={participant.role} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-fg">
                  {participant.label}
                  {participant.channel ? <span className="text-fg-secondary"> · kick.com/{participant.channel}</span> : null}
                </span>
                <span className="text-fg-secondary">
                  {!recording
                    ? 'No recording for this match'
                    : recording.status === 'READY'
                      ? `Recorded${recording.durationSeconds ? ` · ${Math.round(recording.durationSeconds / 60)} min` : ''}`
                      : recording.status === 'RECORDING'
                        ? 'Recording…'
                        : recording.status === 'FAILED'
                          ? `Recording failed${recording.failureReason ? `: ${recording.failureReason}` : ''}`
                          : 'Deleted'}
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
