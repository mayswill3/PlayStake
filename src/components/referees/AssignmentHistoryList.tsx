'use client';

import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';
import { Swords } from 'lucide-react';
import { StatusPill } from '@/components/ui/playstake/StatusPill';
import { formatDate } from '@/lib/utils/format';

type PillStatus = ComponentProps<typeof StatusPill>['status'];

/** The fields every assignment-history view needs (referee's own and admin). */
export interface HistoryAssignment {
  id: string;
  status: string;
  decision: string | null;
  overturnedOutcome: string | null;
  rewardAmount: string | null;
  rewardPercent: string;
  disputeDeadline: string | null;
  claimedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  bet: {
    id: string;
    amount: string;
    platformFeePercent: string;
    game: { name: string };
    playerA: { displayName: string };
    playerB: { displayName: string } | null;
  };
}

export const ASSIGNMENT_STATUS: Record<string, { pill: PillStatus; label: string }> = {
  OPEN: { pill: 'waiting', label: 'Open' },
  ASSIGNED: { pill: 'waiting', label: 'Claimed' },
  READY: { pill: 'waiting', label: 'Ready' },
  IN_PROGRESS: { pill: 'live', label: 'In progress' },
  DECISION_SUBMITTED: { pill: 'waiting', label: 'Dispute window' },
  DISPUTED: { pill: 'disputed', label: 'Disputed' },
  COMPLETED: { pill: 'settled', label: 'Completed' },
  CANCELLED: { pill: 'expired', label: 'Cancelled' },
};

export function assignmentStatus(status: string) {
  return ASSIGNMENT_STATUS[status] ?? { pill: 'waiting' as const, label: status.replace(/_/g, ' ') };
}

export function outcomeLabel(outcome: string, assignment: Pick<HistoryAssignment, 'bet'>) {
  if (outcome === 'PLAYER_A_WIN') return `${assignment.bet.playerA.displayName} won`;
  if (outcome === 'PLAYER_B_WIN') return `${assignment.bet.playerB?.displayName ?? 'Player B'} won`;
  return 'Draw';
}

/** What the referee earned, or stands to earn while the match is unresolved. */
export function rewardLabel(assignment: HistoryAssignment) {
  if (assignment.rewardAmount !== null) return `$${Number(assignment.rewardAmount).toFixed(2)} earned`;
  if (assignment.status === 'CANCELLED') return 'No fee';
  const fee =
    Number(assignment.bet.amount) * 2 * Number(assignment.bet.platformFeePercent) * Number(assignment.rewardPercent);
  return `$${fee.toFixed(2)} fee pending`;
}

export function AssignmentHistoryList<T extends HistoryAssignment>({
  assignments,
  callLabel = 'Call',
  emptyText = 'No assignments yet.',
  renderExtra,
}: {
  assignments: T[];
  /** Prefix for the decision line, e.g. "Your call" on the referee's own page. */
  callLabel?: string;
  emptyText?: string;
  /** Extra content under a row, e.g. the admin notes/timeline/audit panel. */
  renderExtra?: (assignment: T) => ReactNode;
}) {
  if (assignments.length === 0) {
    return <p className="py-5 text-sm text-ps-muted">{emptyText}</p>;
  }

  return (
    <div className="divide-y divide-[var(--ps-border-light)] dark:divide-[var(--ps-border-dark)]">
      {assignments.map((assignment) => {
        const status = assignmentStatus(assignment.status);
        const when =
          assignment.completedAt ?? assignment.cancelledAt ?? assignment.claimedAt ?? assignment.createdAt;
        const disputeOpen = assignment.status === 'DECISION_SUBMITTED' && assignment.disputeDeadline !== null;
        return (
          <div key={assignment.id} className="py-3 text-sm first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <Swords className="mt-0.5 h-4 w-4 shrink-0 text-ps-lime" />
                <div className="min-w-0 space-y-1">
                  <Link
                    href={`/watch/${assignment.bet.id}`}
                    className="block truncate font-medium text-ps-text transition-colors hover:text-ps-lime dark:text-white"
                  >
                    {assignment.bet.playerA.displayName} vs {assignment.bet.playerB?.displayName ?? 'TBD'}
                  </Link>
                  <p className="truncate text-xs text-ps-muted dark:text-ps-muted-on-dark">
                    {assignment.bet.game.name} · ${(Number(assignment.bet.amount) * 2).toFixed(2)} pot ·{' '}
                    {formatDate(when)}
                  </p>
                  {assignment.decision && (
                    <p className="text-xs text-ps-text dark:text-ps-text-on-dark">
                      {callLabel}: {outcomeLabel(assignment.decision, assignment)}
                      {assignment.overturnedOutcome && (
                        <span className="text-ps-warning">
                          {' '}· overturned to {outcomeLabel(assignment.overturnedOutcome, assignment)}
                        </span>
                      )}
                    </p>
                  )}
                  {disputeOpen && (
                    <p className="text-xs text-ps-muted dark:text-ps-muted-on-dark">
                      Dispute window closes{' '}
                      {new Date(assignment.disputeDeadline!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <StatusPill status={status.pill} label={status.label} />
                <span className="text-xs font-mono tabular-nums text-ps-muted dark:text-ps-muted-on-dark">
                  {rewardLabel(assignment)}
                </span>
              </div>
            </div>
            {renderExtra && <div className="mt-2 pl-7">{renderExtra(assignment)}</div>}
          </div>
        );
      })}
    </div>
  );
}
