'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Dialog } from '@/components/ui/Dialog';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { FadeIn } from '@/components/ui/FadeIn';
import { useToast } from '@/components/ui/Toast';
import { DarkGlowCard } from '@/components/ui/playstake/DarkGlowCard';
import { StatusPill } from '@/components/ui/playstake/StatusPill';
import { StepIndicator } from '@/components/ui/playstake/StepIndicator';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { RematchCard, isRematchable } from '@/components/bets/RematchCard';
import {
  RefereeProtectionCard,
  type RefereeAssignmentView,
} from '@/components/referees/RefereeProtectionCard';
import { MatchChat } from '@/components/matches/MatchChat';
import { MatchStreams } from '@/components/matches/MatchStreams';
import { formatCents, formatDate } from '@/lib/utils/format';

interface KickInfo {
  channelSlug: string;
  isLive: boolean;
}

interface BetDetail {
  id: string;
  externalId: string | null;
  game: { id: string; name: string; logoUrl: string | null };
  playerA: { id: string; displayName: string; kick: KickInfo | null };
  playerB: { id: string; displayName: string; kick: KickInfo | null } | null;
  /** The other player, from the caller's point of view. Null until matched. */
  opponent: { id: string; displayName: string; kick: KickInfo | null } | null;
  amount: number;
  currency: string;
  status: string;
  outcome: string | null;
  platformFeeAmount: number | null;
  gameMetadata: Record<string, any> | null;
  resultPayload: Record<string, any> | null;
  createdAt: string;
  matchedAt: string | null;
  resultReportedAt: string | null;
  settledAt: string | null;
  matchType: string;
  refereeAssignment: RefereeAssignmentView | null;
}

const REFEREE_POLL_MS = 5_000;
/** Slower refresh once a referee has claimed — only live status and progress change. */
const REFEREE_ACTIVE_POLL_MS = 10_000;

type PillStatus = 'live' | 'waiting' | 'completed' | 'disputed' | 'settled' | 'expired';

function mapBetStatusToPill(status: string): PillStatus {
  switch (status) {
    case 'OPEN':
    case 'PENDING':
    case 'PENDING_CONSENT':
      return 'waiting';
    case 'MATCHED':
    case 'RESULT_REPORTED':
      return 'live';
    case 'SETTLED':
      return 'settled';
    case 'DISPUTED':
      return 'disputed';
    case 'CANCELLED':
    case 'VOIDED':
    case 'EXPIRED':
      return 'expired';
    default:
      return 'waiting';
  }
}

function getTimelineStep(bet: BetDetail): number {
  if (bet.settledAt) return 5; // past last step = all complete
  if (bet.resultReportedAt) return 4;
  if (bet.matchedAt) return 3;
  return 2; // created = step 1 complete, step 2 active
}

export default function BetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [bet, setBet] = useState<BetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeLoading, setDisputeLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/bets/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('Bet not found');
        return r.json();
      })
      .then(setBet)
      .catch(() => setError('Failed to load bet details.'))
      .finally(() => setLoading(false));
  }, [id]);

  // Keep the page live for the whole refereed match: the claim (or unclaimed
  // refund) while OPEN, then the referee's Kick live status and progress.
  const refereeStatus = bet?.refereeAssignment?.status;
  const refereeMatchActive =
    refereeStatus !== undefined && ['OPEN', 'ASSIGNED', 'READY', 'IN_PROGRESS'].includes(refereeStatus);
  const pollMs = refereeStatus === 'OPEN' ? REFEREE_POLL_MS : REFEREE_ACTIVE_POLL_MS;
  const betRef = useRef(bet);
  useEffect(() => {
    betRef.current = bet;
  }, [bet]);
  useEffect(() => {
    if (!refereeMatchActive) return;
    let active = true;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/bets/${id}`, { cache: 'no-store' });
        if (!response.ok || !active) return;
        const next: BetDetail = await response.json();
        if (!active) return;
        const previous = betRef.current;
        setBet(next);
        const referee = next.refereeAssignment?.referee;
        if (referee && !previous?.refereeAssignment?.referee) {
          toast('success', `${referee.displayName} claimed your match — you're protected.`);
        } else if (next.status === 'VOIDED' && previous?.status !== 'VOIDED') {
          toast('info', 'No referee claimed in time — both stakes were refunded.');
        }
      } catch {
        /* network blip — the next poll retries */
      }
    }, pollMs);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refereeMatchActive, pollMs, id, toast]);

  const refereeDeadlineOpen = !bet?.refereeAssignment?.disputeDeadline ||
    new Date(bet.refereeAssignment.disputeDeadline).getTime() > Date.now();
  const canDispute = bet && ['RESULT_REPORTED', 'SETTLED'].includes(bet.status) && refereeDeadlineOpen;

  async function handleDispute() {
    if (!disputeReason.trim()) return;
    setDisputeLoading(true);

    try {
      const res = await fetch(`/api/bets/${id}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: disputeReason }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast('error', data.error || 'Failed to file dispute.');
        setDisputeLoading(false);
        return;
      }

      toast('success', 'Dispute filed successfully. Our team will review it.');
      setDisputeOpen(false);
      setDisputeReason('');
      const updated = await fetch(`/api/bets/${id}`).then(r => r.json());
      setBet(updated);
    } catch {
      toast('error', 'Something went wrong.');
    } finally {
      setDisputeLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !bet) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <p className="text-ps-error font-mono">{error || 'Bet not found.'}</p>
          <PSButton variant="ghost" onClick={() => router.back()} className="mt-4">
            Go Back
          </PSButton>
        </Card>
      </div>
    );
  }

  const outcomeDisplay = getOutcomeDisplay(bet.outcome);
  // Stream matches carry the spectator chat, shown as a right-hand column.
  const hasChat = bet.matchType === 'STREAM_VS_STREAM';

  return (
    <FadeIn>
      <div className={`${hasChat ? 'max-w-6xl' : 'max-w-3xl'} mx-auto space-y-6`}>
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => router.back()}
              className="text-sm font-mono text-ps-muted dark:text-ps-muted-on-dark hover:text-ps-text dark:hover:text-ps-text-on-dark transition-colors mb-2"
            >
              &larr; Back to bets
            </button>
            <h1 className="text-2xl font-display font-bold text-ps-text dark:text-ps-text-on-dark">Bet Detail</h1>
          </div>
          <StatusPill status={mapBetStatusToPill(bet.status)} label={bet.status.replace(/_/g, ' ')} />
        </div>

        {/* On xl the chat is a sticky right-hand column spanning both left groups;
            below xl everything stacks, with the chat straight after the streams. */}
        <div className={`grid items-start gap-6 ${hasChat ? 'xl:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
          <div className="min-w-0 space-y-6 xl:col-start-1 xl:row-start-1">
            {/* Main info */}
            <DarkGlowCard>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-ps-muted-on-dark">Game</p>
                  <p className="text-ps-text-on-dark font-display font-medium">{bet.game.name}</p>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-ps-muted-on-dark">Stake</p>
                  <p className="text-ps-lime font-display font-semibold text-lg tabular-nums">{formatCents(bet.amount)}</p>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-ps-muted-on-dark">Player A</p>
                  <p className="font-mono text-ps-text-on-dark">{bet.playerA.displayName}</p>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-ps-muted-on-dark">Player B</p>
                  <p className="font-mono text-ps-text-on-dark">{bet.playerB?.displayName ?? 'Awaiting opponent'}</p>
                </div>
                {bet.outcome && (
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-wider text-ps-muted-on-dark">Outcome</p>
                    <p className={`font-display font-semibold ${outcomeDisplay.color}`}>{outcomeDisplay.label}</p>
                  </div>
                )}
                {bet.platformFeeAmount !== null && (
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-wider text-ps-muted-on-dark">Platform Fee</p>
                    <p className="font-mono tabular-nums text-ps-muted-on-dark">{formatCents(bet.platformFeeAmount)}</p>
                  </div>
                )}
              </div>

              {bet.externalId && (
                <div className="mt-4 pt-4 border-t border-[var(--ps-border-dark)]">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-ps-muted-on-dark">External Match ID</p>
                  <p className="text-ps-muted-on-dark text-sm font-mono">{bet.externalId}</p>
                </div>
              )}
            </DarkGlowCard>

            {bet.refereeAssignment && (
              <RefereeProtectionCard
                assignment={bet.refereeAssignment}
                gameName={bet.game.name}
                stakeCents={bet.amount}
              />
            )}

            {/* Kick streams — the players' feeds, plus the referee officiating on camera */}
            {(bet.playerA.kick || bet.playerB?.kick || bet.refereeAssignment?.referee?.kickChannel) && (
              <Card>
                <CardTitle className="mb-4">Watch on Kick</CardTitle>
                <MatchStreams
                  referee={
                    bet.refereeAssignment?.referee
                      ? {
                          name: bet.refereeAssignment.referee.displayName,
                          channelSlug: bet.refereeAssignment.referee.kickChannel,
                          isLive: bet.refereeAssignment.referee.kickLive,
                        }
                      : null
                  }
                  players={[bet.playerA, ...(bet.playerB ? [bet.playerB] : [])].map((player) => ({
                    name: player.displayName,
                    channelSlug: player.kick?.channelSlug ?? null,
                    isLive: player.kick?.isLive ?? false,
                  }))}
                />
              </Card>
            )}
          </div>

          {/* The spectator chat from /watch — read-only for the players. */}
          {hasChat && (
            <div className="xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:self-stretch">
              <MatchChat
                betId={bet.id}
                className="h-[420px] xl:sticky xl:top-20 xl:h-[calc(100vh-7rem)] xl:max-h-[720px]"
              />
            </div>
          )}

          <div className="min-w-0 space-y-6 xl:col-start-1 xl:row-start-2">
            {/* Timeline */}
            <Card>
              <CardTitle className="mb-4">Match Timeline</CardTitle>
              <StepIndicator
                steps={[
                  { label: 'Created' },
                  { label: 'Matched' },
                  { label: 'Result Reported' },
                  { label: 'Settled' },
                ]}
                currentStep={getTimelineStep(bet)}
                orientation="auto"
              />
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono text-ps-muted dark:text-ps-muted-on-dark">
                <span>{bet.createdAt ? formatDate(bet.createdAt) : '-'}</span>
                <span>{bet.matchedAt ? formatDate(bet.matchedAt) : '-'}</span>
                <span>{bet.resultReportedAt ? formatDate(bet.resultReportedAt) : '-'}</span>
                <span>{bet.settledAt ? formatDate(bet.settledAt) : '-'}</span>
              </div>
            </Card>

            {/* Rematch — the match is over, make the next one one click away */}
            {isRematchable(bet.status) && <RematchCard opponent={bet.opponent} />}

            {/* Game metadata */}
            {bet.gameMetadata && Object.keys(bet.gameMetadata).length > 0 && (
              <Card>
                <CardTitle className="mb-4">Game Details</CardTitle>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(bet.gameMetadata).map(([key, value]) => (
                    <div key={key}>
                      <p className="font-mono text-[11px] uppercase tracking-wider text-ps-muted dark:text-ps-muted-on-dark">{key}</p>
                      <p className="text-sm font-mono text-ps-text dark:text-ps-text-on-dark">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Result payload */}
            {bet.resultPayload && Object.keys(bet.resultPayload).length > 0 && (
              <Card>
                <CardTitle className="mb-4">Result Data</CardTitle>
                <CodeBlock code={JSON.stringify(bet.resultPayload, null, 2)} />
              </Card>
            )}

            {/* Actions */}
            {canDispute && (
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-display font-medium text-ps-text dark:text-ps-text-on-dark">Dispute this bet</p>
                    <p className="text-xs font-mono text-ps-muted dark:text-ps-muted-on-dark">
                      If you believe the result is incorrect, file before the displayed deadline. Settlement pauses immediately.
                    </p>
                  </div>
                  <PSButton variant="danger" size="sm" onClick={() => setDisputeOpen(true)}>
                    File Dispute
                  </PSButton>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Dispute dialog */}
        <Dialog
          open={disputeOpen}
          onClose={() => setDisputeOpen(false)}
          title="File a Dispute"
          actions={
            <>
              <Button variant="ghost" onClick={() => setDisputeOpen(false)}>Cancel</Button>
              <Button variant="danger" loading={disputeLoading} onClick={handleDispute}>Submit Dispute</Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm">
              Please describe why you believe the result is incorrect. Our team will review
              your dispute within 48 hours.
            </p>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Describe the issue..."
              rows={4}
              className="w-full rounded-[var(--ps-radius-md)] border border-[var(--ps-border-dark)] bg-ps-ink-2 text-ps-text-on-dark font-mono text-sm px-3 py-2 resize-none focus:border-ps-lime focus:ring-0 focus:outline-none"
              required
            />
          </div>
        </Dialog>
      </div>
    </FadeIn>
  );
}

function getOutcomeDisplay(outcome: string | null): { label: string; color: string } {
  switch (outcome) {
    case 'PLAYER_A_WIN':
      return { label: 'Player A Won', color: 'text-ps-lime' };
    case 'PLAYER_B_WIN':
      return { label: 'Player B Won', color: 'text-ps-lime' };
    case 'DRAW':
      return { label: 'Draw', color: 'text-ps-muted-on-dark' };
    default:
      return { label: 'Pending', color: 'text-ps-muted-on-dark' };
  }
}
