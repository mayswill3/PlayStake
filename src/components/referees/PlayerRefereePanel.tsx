'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Scale, ShieldCheck } from 'lucide-react';
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

export function PlayerRefereePanel() {
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
