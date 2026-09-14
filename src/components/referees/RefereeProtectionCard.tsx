'use client';

import { useEffect, useState } from 'react';
import { Check, Scale } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/playstake/StatusPill';
import { formatCents, formatDate } from '@/lib/utils/format';

export interface RefereeAssignmentView {
  id: string;
  status: string;
  decision: string | null;
  disputeDeadline: string | null;
  /** Start and end of the claim window — only set while the assignment is OPEN. */
  claimOpenedAt: string | null;
  claimDeadline: string | null;
  rewardPolicy: string;
  referee: { displayName: string; kickChannel: string | null; kickLive: boolean } | null;
}

interface RefereeProtectionCardProps {
  assignment: RefereeAssignmentView;
  gameName: string;
  stakeCents: number;
}

export function RefereeProtectionCard({ assignment, gameName, stakeCents }: RefereeProtectionCardProps) {
  if (assignment.status === 'OPEN') {
    return <FindingRefereeCard assignment={assignment} gameName={gameName} stakeCents={stakeCents} />;
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Human referee protection</CardTitle>
          <p className="mt-2 text-sm text-ps-muted dark:text-ps-muted-on-dark">
            {assignment.referee
              ? `${assignment.referee.displayName} is the independent referee`
              : 'Waiting for an approved referee to claim this match'}
          </p>
          {assignment.referee?.kickChannel && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  assignment.referee.kickLive ? 'bg-ps-error animate-pulse' : 'bg-ps-muted'
                }`}
                aria-hidden="true"
              />
              <span className={assignment.referee.kickLive ? 'text-ps-error' : 'text-ps-muted dark:text-ps-muted-on-dark'}>
                {assignment.referee.kickLive
                  ? `Officiating live on Kick · ${assignment.referee.kickChannel}`
                  : `Referee offline on Kick · ${assignment.referee.kickChannel}`}
              </span>
            </p>
          )}
          <p className="mt-1 text-xs font-mono text-ps-muted dark:text-ps-muted-on-dark">
            Reward: {assignment.rewardPolicy}
            {assignment.disputeDeadline
              ? ` · Dispute deadline ${formatDate(assignment.disputeDeadline)}`
              : ' · Funds remain locked until a reviewed result'}
          </p>
        </div>
        <StatusPill
          status={assignment.status === 'DISPUTED' ? 'disputed' : assignment.referee ? 'live' : 'waiting'}
          label={assignment.status.replace(/_/g, ' ')}
        />
      </div>
      <AuditLink assignmentId={assignment.id} />
    </Card>
  );
}

const MESSAGE_ROTATE_MS = 4_000;

/**
 * The OPEN state, styled like a ride-hail "finding your driver" screen: a
 * searching animation, rotating reassurance, where the match is in the flow,
 * and a live countdown to the automatic refund — so a player waiting on a
 * referee can see that something is happening rather than a static label.
 */
function FindingRefereeCard({ assignment, gameName, stakeCents }: RefereeProtectionCardProps) {
  const now = useNow(1_000);
  const [messageIndex, setMessageIndex] = useState(0);

  const messages = [
    'Approved referees have been notified of your match',
    `Your ${formatCents(stakeCents)} stake is locked in escrow while you wait`,
    `Stay live on Kick with ${gameName} selected so your referee can follow the match`,
    'An independent referee reviews the match before anything is paid out',
  ];

  useEffect(() => {
    const timer = window.setInterval(
      () => setMessageIndex((index) => (index + 1) % messages.length),
      MESSAGE_ROTATE_MS,
    );
    return () => window.clearInterval(timer);
  }, [messages.length]);

  const openedAt = assignment.claimOpenedAt ? new Date(assignment.claimOpenedAt).getTime() : null;
  const deadline = assignment.claimDeadline ? new Date(assignment.claimDeadline).getTime() : null;
  const remainingMs = deadline !== null ? Math.max(0, deadline - now) : null;
  const windowMs = openedAt !== null && deadline !== null ? deadline - openedAt : null;
  const remainingFraction =
    remainingMs !== null && windowMs ? Math.min(1, remainingMs / windowMs) : null;
  const expired = remainingMs === 0;
  const runningLow = remainingMs !== null && remainingMs < 2 * 60_000;

  return (
    <Card className="relative overflow-hidden border-ps-lime/40">
      {/* Soft lime wash so the card reads as the active thing on the page. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-ps-lime/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <SearchingPulse />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-ps-muted dark:text-ps-muted-on-dark">
                Human referee protection
              </p>
              <StatusPill status="waiting" label="Searching" />
            </div>
            <h2 className="mt-1 font-display text-xl font-semibold text-ps-text dark:text-ps-text-on-dark">
              Finding your{' '}
              <span className="whitespace-nowrap">
                referee
                <TypingDots />
              </span>
            </h2>
            <p
              key={messageIndex}
              className="animate-fade-up mt-1 min-h-10 text-sm text-ps-muted dark:text-ps-muted-on-dark"
              aria-live="polite"
            >
              {messages[messageIndex]}
            </p>
          </div>
        </div>

        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Referee progress">
          <Step state="done" label="Match locked" />
          <Step state="done" label="Referees notified" />
          <Step state="active" label="Referee claims" />
          <Step state="upcoming" label="Kick-off" />
        </ol>

        {remainingMs !== null && (
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
              <span className="text-ps-muted dark:text-ps-muted-on-dark">
                {expired
                  ? 'No referee claimed in time — both stakes are being refunded'
                  : 'If no referee claims it, both stakes are refunded automatically in'}
              </span>
              {!expired && (
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    runningLow ? 'text-ps-warning' : 'text-ps-text dark:text-ps-text-on-dark'
                  }`}
                >
                  {formatCountdown(remainingMs)}
                </span>
              )}
            </div>
            {remainingFraction !== null && (
              <div className="h-1.5 overflow-hidden rounded-full bg-ps-lime/10">
                <div
                  className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
                    runningLow ? 'bg-ps-warning' : 'bg-ps-lime'
                  }`}
                  style={{ width: `${remainingFraction * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        <p className="text-xs font-mono text-ps-muted dark:text-ps-muted-on-dark">
          Referee reward: {assignment.rewardPolicy}
          {' · You can leave this page — we’ll keep searching'}
        </p>
      </div>
      <AuditLink assignmentId={assignment.id} />
    </Card>
  );
}

function SearchingPulse() {
  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center" aria-hidden="true">
      <span className="absolute inset-0 rounded-full bg-ps-lime/25 animate-ping motion-reduce:animate-none" />
      <span className="absolute inset-0 rounded-full bg-ps-lime/15 animate-ping [animation-delay:700ms] motion-reduce:animate-none" />
      <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-ps-paper-elevated text-ps-lime ring-1 ring-ps-lime/50 dark:bg-ps-ink-2">
        <Scale className="h-5 w-5" />
      </span>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="ml-2 inline-flex items-end gap-1 align-middle" aria-hidden="true">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 rounded-full bg-ps-lime animate-bounce motion-reduce:animate-none"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

function Step({ state, label }: { state: 'done' | 'active' | 'upcoming'; label: string }) {
  return (
    <li
      className={`flex items-center gap-2 rounded-[var(--ps-radius-md)] border px-2.5 py-2 text-xs font-medium ${
        state === 'active'
          ? 'border-ps-lime/50 bg-ps-lime/10 text-ps-text dark:text-ps-text-on-dark'
          : 'border-[var(--ps-border-light)] text-ps-muted dark:border-[var(--ps-border-dark)] dark:text-ps-muted-on-dark'
      }`}
      aria-current={state === 'active' ? 'step' : undefined}
    >
      {state === 'done' ? (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-ps-lime text-ps-ink">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      ) : state === 'active' ? (
        <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
          <span className="absolute h-4 w-4 rounded-full bg-ps-lime/40 animate-ping motion-reduce:animate-none" />
          <span className="relative h-2 w-2 rounded-full bg-ps-lime" />
        </span>
      ) : (
        <span className="h-4 w-4 shrink-0 rounded-full border border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)]" />
      )}
      {label}
    </li>
  );
}

function AuditLink({ assignmentId }: { assignmentId: string }) {
  return (
    <a
      href={`/api/referees/assignments/${assignmentId}/audit`}
      target="_blank"
      rel="noreferrer"
      className="relative mt-4 inline-block text-xs font-semibold text-ps-lime hover:underline"
    >
      Verify immutable audit trail
    </a>
  );
}

/** Current time, re-rendering every `intervalMs`. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
