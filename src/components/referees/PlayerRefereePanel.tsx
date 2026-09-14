'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Scale, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/playstake/StatusPill';

interface PlayerAssignment {
  id: string;
  status: string;
  disputeDeadline: string | null;
  bet: { id: string; game: { name: string } };
  refereeProfile: null | {
    user: {
      displayName: string;
      kickAccount: { channelSlug: string | null } | null;
    };
  };
}

/** The player's most recent active (not completed/cancelled) referee assignment. */
function usePlayerRefereeAssignment(): PlayerAssignment | null {
  const [assignment, setAssignment] = useState<PlayerAssignment | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const response = await fetch('/api/referees/assignments?scope=player', { cache: 'no-store' });
      if (!response.ok || !active) return;
      const data = await response.json();
      setAssignment(data.assignments?.[0] ?? null);
    }
    void load();
    const timer = window.setInterval(() => void load(), 8_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return assignment;
}

export function PlayerRefereePanel() {
  const assignment = usePlayerRefereeAssignment();

  if (!assignment) return null;
  const referee = assignment.refereeProfile?.user;

  return (
    <Card className="mb-8 border-ps-lime/30">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-ps-lime/10 p-3 text-ps-lime"><Scale className="h-5 w-5" /></div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display font-semibold text-ps-text dark:text-white">
                {referee ? `Referee: ${referee.displayName}` : 'Waiting for a referee'}
              </p>
              <StatusPill
                status={referee ? 'live' : 'waiting'}
                label={assignment.status.replace(/_/g, ' ')}
              />
            </div>
            <p className="mt-1 text-sm text-ps-muted dark:text-ps-muted-on-dark">
              {assignment.bet.game.name} · funds stay in escrow through the dispute window
              {referee?.kickAccount?.channelSlug ? ` · Kick: ${referee.kickAccount.channelSlug}` : ''}
            </p>
          </div>
        </div>
        <Link
          href={`/bets/${assignment.bet.id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-ps-lime hover:underline"
        >
          <ShieldCheck className="h-4 w-4" /> View protected match
        </Link>
      </div>
    </Card>
  );
}

/**
 * Compact sidebar version of the panel, so a player waiting on (or working
 * with) a referee sees it from any dashboard page — not just /play.
 */
export function PlayerRefereeSidebarCard({ onNavigate }: { onNavigate?: () => void }) {
  const assignment = usePlayerRefereeAssignment();

  if (!assignment) return null;
  const referee = assignment.refereeProfile?.user;

  return (
    <Link
      href={`/bets/${assignment.bet.id}`}
      onClick={onNavigate}
      aria-label={`${referee ? `Referee: ${referee.displayName}` : 'Waiting for a referee'} — view protected match`}
      className="group mx-3 mt-3 block shrink-0 rounded-[var(--ps-radius-lg)] border border-ps-lime/30 bg-ps-paper-elevated p-3 transition-colors hover:border-ps-lime/60 dark:bg-ps-ink-2"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--ps-radius-md)] bg-ps-lime/10 text-ps-lime">
          <Scale size={15} strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-ps-text dark:text-ps-text-on-dark">
            {referee ? `Referee: ${referee.displayName}` : 'Waiting for a referee'}
          </p>
          <p className="truncate text-[11px] text-ps-muted dark:text-ps-muted-on-dark">
            {assignment.bet.game.name}
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${
            referee ? 'text-ps-lime' : 'text-ps-warning'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${referee ? 'bg-ps-lime' : 'bg-ps-warning animate-pulse'}`}
          />
          {assignment.status.replace(/_/g, ' ')}
        </span>
        <span className="inline-flex items-center text-[11px] font-semibold text-ps-lime group-hover:underline">
          View match <ChevronRight size={12} />
        </span>
      </div>
    </Link>
  );
}
