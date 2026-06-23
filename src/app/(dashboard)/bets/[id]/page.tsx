'use client';

import { useState, useEffect } from 'react';
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
}

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

  const canDispute = bet && ['RESULT_REPORTED', 'SETTLED'].includes(bet.status);

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

  return (
    <FadeIn>
      <div className="max-w-3xl mx-auto space-y-6">
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

        {/* Kick streams — watch participants' live streams during the bet */}
        <KickStreamsSection
          players={[
            { name: bet.playerA.displayName, kick: bet.playerA.kick },
            ...(bet.playerB
              ? [{ name: bet.playerB.displayName, kick: bet.playerB.kick }]
              : []),
          ]}
        />

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
                <p className="text-xs font-mono text-ps-muted dark:text-ps-muted-on-dark">If you believe the result is incorrect, you can file a dispute.</p>
              </div>
              <PSButton variant="danger" size="sm" onClick={() => setDisputeOpen(true)}>
                File Dispute
              </PSButton>
            </div>
          </Card>
        )}

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

function KickStreamsSection({
  players,
}: {
  players: { name: string; kick: KickInfo | null }[];
}) {
  const streamers = players.filter(
    (p): p is { name: string; kick: KickInfo } => p.kick !== null,
  );
  if (streamers.length === 0) return null;

  return (
    <Card>
      <CardTitle className="mb-4">Watch on Kick</CardTitle>
      <div className={`grid grid-cols-1 gap-4 ${streamers.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {streamers.map((p) => (
          <div key={p.kick.channelSlug}>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-display font-medium text-ps-text dark:text-ps-text-on-dark truncate">
                {p.name}
              </p>
              {p.kick.isLive ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ps-error/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ps-error">
                  <span className="h-1.5 w-1.5 rounded-full bg-ps-error animate-pulse" />
                  Live
                </span>
              ) : (
                <span className="text-[10px] font-mono uppercase tracking-wider text-ps-muted dark:text-ps-muted-on-dark">
                  Offline
                </span>
              )}
            </div>
            <div className="overflow-hidden rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] bg-black">
              <iframe
                src={`https://player.kick.com/${p.kick.channelSlug}`}
                title={`${p.kick.channelSlug} on Kick`}
                className="w-full aspect-video"
                allowFullScreen
                allow="autoplay; fullscreen; picture-in-picture"
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
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
