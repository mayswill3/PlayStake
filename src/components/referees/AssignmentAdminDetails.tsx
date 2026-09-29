'use client';

import type { HistoryAssignment } from './AssignmentHistoryList';

/** Admin-only extras on top of the shared history fields (see admin-history.ts). */
export interface AdminAssignment extends HistoryAssignment {
  evidence: { notes?: string } | null;
  readyAt: string | null;
  startedAt: string | null;
  decisionSubmittedAt: string | null;
  overturnedAt: string | null;
  refereeProfile: {
    id: string;
    user: { displayName: string; kickAccount: { channelSlug: string | null } | null };
  } | null;
  auditEvents: Array<{
    id: string;
    sequence: number;
    action: string;
    details: Record<string, unknown> | null;
    createdAt: string;
    actor: { displayName: string } | null;
  }>;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Short, human-readable summary of an audit event's details (notes shown separately). */
function summarizeDetails(details: Record<string, unknown> | null) {
  if (!details) return null;
  const parts = Object.entries(details)
    .filter(([key, value]) => key !== 'notes' && value !== null && typeof value !== 'object')
    .map(([key, value]) => `${key}: ${String(value)}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function AssignmentNotes({ assignment }: { assignment: AdminAssignment }) {
  const notes = assignment.evidence?.notes;
  if (!notes) return null;
  return (
    <blockquote className="whitespace-pre-wrap border-l-2 border-ps-lime/40 pl-3 text-sm text-ps-text dark:text-ps-text-on-dark">
      {notes}
    </blockquote>
  );
}

export function AssignmentTimeline({ assignment }: { assignment: AdminAssignment }) {
  const steps: Array<[string, string | null]> = [
    ['Opened', assignment.createdAt],
    ['Claimed', assignment.claimedAt],
    ['Ready', assignment.readyAt],
    ['Started', assignment.startedAt],
    ['Decision submitted', assignment.decisionSubmittedAt],
    ['Dispute window closes', assignment.disputeDeadline],
    ['Overturned', assignment.overturnedAt],
    ['Completed', assignment.completedAt],
    ['Cancelled', assignment.cancelledAt],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
      {steps
        .filter(([, value]) => value !== null)
        .map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-ps-muted dark:text-ps-muted-on-dark">{label}</dt>
            <dd className="font-mono tabular-nums text-ps-text dark:text-ps-text-on-dark">{formatTimestamp(value!)}</dd>
          </div>
        ))}
    </dl>
  );
}

export function AssignmentAuditTrail({ assignment }: { assignment: AdminAssignment }) {
  if (assignment.auditEvents.length === 0) {
    return <p className="text-xs text-ps-muted dark:text-ps-muted-on-dark">No audit events recorded.</p>;
  }
  return (
    <ol className="space-y-1.5 text-xs">
      {assignment.auditEvents.map((event) => {
        const summary = summarizeDetails(event.details);
        return (
          <li key={event.id} className="flex gap-3">
            <span className="w-6 shrink-0 text-right font-mono text-ps-muted dark:text-ps-muted-on-dark">#{event.sequence}</span>
            <div className="min-w-0">
              <p className="text-ps-text dark:text-ps-text-on-dark">
                <span className="font-semibold">{event.action.replace(/_/g, ' ').toLowerCase()}</span>
                {' '}by {event.actor?.displayName ?? 'system'} · {formatTimestamp(event.createdAt)}
              </p>
              {summary && <p className="break-words font-mono text-ps-muted dark:text-ps-muted-on-dark">{summary}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Collapsible notes + timeline + audit trail, for rows in the admin history. */
export function AssignmentAdminDetails({ assignment }: { assignment: AdminAssignment }) {
  return (
    <details className="group rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] px-3 py-2 dark:border-[var(--ps-border-dark)]">
      <summary className="cursor-pointer select-none text-xs font-semibold text-ps-muted hover:text-ps-lime dark:text-ps-muted-on-dark">
        Notes, timeline &amp; audit trail
      </summary>
      <div className="mt-3 space-y-4">
        <AssignmentNotes assignment={assignment} />
        <section>
          <h4 className="mb-1.5 font-mono text-[11px] uppercase tracking-widest text-ps-muted dark:text-ps-muted-on-dark">Timeline</h4>
          <AssignmentTimeline assignment={assignment} />
        </section>
        <section>
          <h4 className="mb-1.5 font-mono text-[11px] uppercase tracking-widest text-ps-muted dark:text-ps-muted-on-dark">Audit trail</h4>
          <AssignmentAuditTrail assignment={assignment} />
        </section>
      </div>
    </details>
  );
}
