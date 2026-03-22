'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import {
  Crosshair,
  Shield,
  Skull,
  Timer,
  DollarSign,
  User,
  Zap,
  RotateCcw,
} from 'lucide-react';

type BetStatus =
  | 'IDLE'
  | 'PENDING_CONSENT'
  | 'OPEN'
  | 'MATCHED'
  | 'RESULT_REPORTED'
  | 'SETTLED';

type Outcome = 'WON' | 'LOST' | null;

interface Player {
  name: string;
  kills: number;
  deaths: number;
  assists: number;
}

const TEAM_ALPHA: Player[] = [
  { name: 'xNova', kills: 14, deaths: 5, assists: 3 },
  { name: 'PhantomAce', kills: 11, deaths: 7, assists: 6 },
  { name: 'GhostRider', kills: 9, deaths: 8, assists: 4 },
  { name: 'VortexKing', kills: 8, deaths: 6, assists: 7 },
  { name: 'IronSight', kills: 6, deaths: 9, assists: 2 },
];

const TEAM_BRAVO: Player[] = [
  { name: 'ShadowByte', kills: 12, deaths: 6, assists: 5 },
  { name: 'BlazeFury', kills: 10, deaths: 8, assists: 3 },
  { name: 'CrypticFox', kills: 8, deaths: 10, assists: 8 },
  { name: 'NightOwl', kills: 7, deaths: 11, assists: 4 },
  { name: 'StormPilot', kills: 5, deaths: 13, assists: 2 },
];

function teamScore(team: Player[]): number {
  return team.reduce((sum, p) => sum + p.kills, 0);
}

export default function FPSDemoPage() {
  const [betStatus, setBetStatus] = useState<BetStatus>('IDLE');
  const [outcome, setOutcome] = useState<Outcome>(null);

  const startWager = useCallback(() => {
    setBetStatus('PENDING_CONSENT');
    setOutcome(null);
  }, []);

  const advanceToOpen = useCallback(() => {
    setBetStatus('OPEN');
  }, []);

  const simulateWin = useCallback(() => {
    if (betStatus === 'OPEN') setBetStatus('MATCHED');
    else if (betStatus === 'MATCHED') {
      setBetStatus('RESULT_REPORTED');
      setOutcome('WON');
    } else if (betStatus === 'RESULT_REPORTED') {
      setBetStatus('SETTLED');
    }
  }, [betStatus]);

  const simulateLoss = useCallback(() => {
    if (betStatus === 'OPEN') setBetStatus('MATCHED');
    else if (betStatus === 'MATCHED') {
      setBetStatus('RESULT_REPORTED');
      setOutcome('LOST');
    } else if (betStatus === 'RESULT_REPORTED') {
      setBetStatus('SETTLED');
    }
  }, [betStatus]);

  const reset = useCallback(() => {
    setBetStatus('IDLE');
    setOutcome(null);
  }, []);

  const displayStatus =
    betStatus === 'SETTLED' && outcome ? outcome : betStatus === 'IDLE' ? 'PENDING' : betStatus;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-brand-400/10 text-brand-400">
          <Crosshair className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">
            Tactical Ops
          </h1>
          <p className="text-sm text-text-muted font-mono">
            Round 14 of 24 -- Ranked Match
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Scoreboard -- spans 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          {/* Timer bar */}
          <Card padding="sm" className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-text-secondary">
              <Timer className="h-4 w-4" />
              <span className="font-mono text-xs uppercase tracking-widest">
                Time Remaining
              </span>
            </div>
            <span className="font-mono text-xl font-semibold tabular-nums text-text-primary">
              5:00
            </span>
          </Card>

          {/* Score summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card padding="sm" className="text-center">
              <p className="font-display text-xs uppercase tracking-widest text-brand-400 mb-1">
                Alpha
              </p>
              <p className="font-mono text-3xl font-bold tabular-nums text-text-primary">
                {teamScore(TEAM_ALPHA)}
              </p>
            </Card>
            <Card padding="sm" className="flex items-center justify-center">
              <span className="font-display text-lg font-bold tracking-widest text-text-muted">
                VS
              </span>
            </Card>
            <Card padding="sm" className="text-center">
              <p className="font-display text-xs uppercase tracking-widest text-danger-400 mb-1">
                Bravo
              </p>
              <p className="font-mono text-3xl font-bold tabular-nums text-text-primary">
                {teamScore(TEAM_BRAVO)}
              </p>
            </Card>
          </div>

          {/* Team tables */}
          <div className="grid gap-4 md:grid-cols-2">
            <TeamTable
              label="Team Alpha"
              color="text-brand-400"
              players={TEAM_ALPHA}
            />
            <TeamTable
              label="Team Bravo"
              color="text-danger-400"
              players={TEAM_BRAVO}
            />
          </div>
        </div>

        {/* PlayStake Widget */}
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-text-primary">
                PlayStake Wager
              </h2>
              <StatusBadge status={displayStatus} />
            </div>

            {/* Bet details */}
            <div className="space-y-3 mb-6">
              <DetailRow
                icon={<DollarSign className="h-4 w-4" />}
                label="Wager"
                value="$25.00"
              />
              <DetailRow
                icon={<User className="h-4 w-4" />}
                label="Opponent"
                value="ShadowByte"
              />
              <DetailRow
                icon={<Zap className="h-4 w-4" />}
                label="Your Pick"
                value="Team Alpha"
              />
              {outcome && (
                <DetailRow
                  icon={<Shield className="h-4 w-4" />}
                  label="Payout"
                  value={outcome === 'WON' ? '+$22.50' : '-$25.00'}
                  valueClass={
                    outcome === 'WON' ? 'text-brand-400' : 'text-danger-400'
                  }
                />
              )}
            </div>

            {/* State machine progress */}
            <div className="mb-6">
              <p className="font-mono text-[11px] uppercase tracking-widest text-text-muted mb-2">
                Lifecycle
              </p>
              <div className="flex gap-1">
                {(
                  [
                    'PENDING_CONSENT',
                    'OPEN',
                    'MATCHED',
                    'RESULT_REPORTED',
                    'SETTLED',
                  ] as BetStatus[]
                ).map((step) => {
                  const steps: BetStatus[] = [
                    'PENDING_CONSENT',
                    'OPEN',
                    'MATCHED',
                    'RESULT_REPORTED',
                    'SETTLED',
                  ];
                  const currentIdx = steps.indexOf(betStatus);
                  const stepIdx = steps.indexOf(step);
                  const active = betStatus !== 'IDLE' && stepIdx <= currentIdx;
                  return (
                    <div
                      key={step}
                      className={`h-1.5 flex-1 rounded-sm transition-colors ${
                        active ? 'bg-brand-400' : 'bg-surface-700'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-2">
              {betStatus === 'IDLE' && (
                <Button className="w-full" onClick={startWager}>
                  Start Wager
                </Button>
              )}

              {betStatus === 'PENDING_CONSENT' && (
                <Button className="w-full" onClick={advanceToOpen}>
                  Accept & Open
                </Button>
              )}

              {(betStatus === 'OPEN' ||
                betStatus === 'MATCHED' ||
                betStatus === 'RESULT_REPORTED') && (
                <div className="grid grid-cols-2 gap-2">
                  <Button className="w-full" onClick={simulateWin}>
                    {betStatus === 'OPEN'
                      ? 'Find Match'
                      : betStatus === 'MATCHED'
                        ? 'Simulate Win'
                        : 'Settle'}
                  </Button>
                  <Button
                    variant="danger"
                    className="w-full"
                    onClick={simulateLoss}
                  >
                    {betStatus === 'OPEN'
                      ? 'Find Match'
                      : betStatus === 'MATCHED'
                        ? 'Simulate Loss'
                        : 'Settle'}
                  </Button>
                </div>
              )}

              {betStatus === 'SETTLED' && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={reset}
                >
                  <RotateCcw className="h-4 w-4" />
                  Play Again
                </Button>
              )}
            </div>
          </Card>

          {/* Mini event log */}
          <Card padding="sm">
            <p className="font-mono text-[11px] uppercase tracking-widest text-text-muted mb-2">
              Event Log
            </p>
            <div className="space-y-1 font-mono text-xs text-text-secondary">
              {betStatus !== 'IDLE' && (
                <p>
                  <span className="text-text-muted">[00:01]</span> Wager
                  created -- $25.00
                </p>
              )}
              {['OPEN', 'MATCHED', 'RESULT_REPORTED', 'SETTLED'].includes(
                betStatus,
              ) && (
                <p>
                  <span className="text-text-muted">[00:02]</span> Consent
                  accepted
                </p>
              )}
              {['MATCHED', 'RESULT_REPORTED', 'SETTLED'].includes(
                betStatus,
              ) && (
                <p>
                  <span className="text-text-muted">[00:04]</span> Opponent
                  matched: ShadowByte
                </p>
              )}
              {['RESULT_REPORTED', 'SETTLED'].includes(betStatus) && (
                <p>
                  <span className="text-text-muted">[05:00]</span> Result:{' '}
                  <span
                    className={
                      outcome === 'WON' ? 'text-brand-400' : 'text-danger-400'
                    }
                  >
                    {outcome === 'WON' ? 'Victory' : 'Defeat'}
                  </span>
                </p>
              )}
              {betStatus === 'SETTLED' && (
                <p>
                  <span className="text-text-muted">[05:01]</span> Payout{' '}
                  {outcome === 'WON' ? 'credited' : 'deducted'}
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

function TeamTable({
  label,
  color,
  players,
}: {
  label: string;
  color: string;
  players: Player[];
}) {
  return (
    <Card padding="none">
      <div className="px-4 py-3 border-b border-white/8">
        <h3 className={`font-display text-xs font-semibold uppercase tracking-widest ${color}`}>
          {label}
        </h3>
      </div>
      <div className="divide-y divide-white/5">
        {/* Header */}
        <div className="grid grid-cols-[1fr_3rem_3rem_3rem] gap-2 px-4 py-2 text-[11px] font-mono uppercase tracking-widest text-text-muted">
          <span>Player</span>
          <span className="text-right">
            <Skull className="inline h-3 w-3" />
          </span>
          <span className="text-right">
            <Shield className="inline h-3 w-3" />
          </span>
          <span className="text-right">A</span>
        </div>
        {players.map((p) => (
          <div
            key={p.name}
            className="grid grid-cols-[1fr_3rem_3rem_3rem] gap-2 px-4 py-2 text-sm"
          >
            <span className="font-mono text-text-primary truncate">
              {p.name}
            </span>
            <span className="font-mono tabular-nums text-right text-text-primary">
              {p.kills}
            </span>
            <span className="font-mono tabular-nums text-right text-text-secondary">
              {p.deaths}
            </span>
            <span className="font-mono tabular-nums text-right text-text-secondary">
              {p.assists}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DetailRow({
  icon,
  label,
  value,
  valueClass = 'text-text-primary',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-text-muted">
        {icon}
        <span className="font-mono text-xs uppercase tracking-widest">
          {label}
        </span>
      </div>
      <span className={`font-mono text-sm font-semibold tabular-nums ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}
