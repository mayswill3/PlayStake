'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Dialog } from '@/components/ui/Dialog';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { FadeIn } from '@/components/ui/FadeIn';
import { useToast } from '@/components/ui/Toast';
import { formatCents, formatDate } from '@/lib/utils/format';

interface BetDetail {
  id: string;
  externalId: string | null;
  game: { id: string; name: string; logoUrl: string | null };
  playerA: { id: string; displayName: string };
  playerB: { id: string; displayName: string } | null;
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
          <p className="text-danger-400 font-mono">{error || 'Bet not found.'}</p>
          <Button variant="ghost" onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
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
              className="text-sm font-mono text-text-secondary hover:text-text-primary transition-colors mb-2"
            >
              &larr; Back to bets
            </button>
            <h1 className="text-2xl font-display font-bold text-text-primary">Bet Detail</h1>
          </div>
          <StatusBadge status={bet.status} />
        </div>

        {/* Main info */}
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-text-muted">Game</p>
              <p className="text-text-primary font-display font-medium">{bet.game.name}</p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-text-muted">Stake</p>
              <p className="text-text-primary font-display font-semibold text-lg tabular-nums">{formatCents(bet.amount)}</p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-text-muted">Player A</p>
              <p className="font-mono text-surface-200">{bet.playerA.displayName}</p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-text-muted">Player B</p>
              <p className="font-mono text-surface-200">{bet.playerB?.displayName ?? 'Awaiting opponent'}</p>
            </div>
            {bet.outcome && (
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-text-muted">Outcome</p>
                <p className={`font-display font-semibold ${outcomeDisplay.color}`}>{outcomeDisplay.label}</p>
              </div>
            )}
            {bet.platformFeeAmount !== null && (
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-text-muted">Platform Fee</p>
                <p className="font-mono tabular-nums text-text-secondary">{formatCents(bet.platformFeeAmount)}</p>
              </div>
            )}
          </div>

          {bet.externalId && (
            <div className="mt-4 pt-4 border-t border-white/8">
              <p className="font-mono text-[11px] uppercase tracking-wider text-text-muted">External Match ID</p>
              <p className="text-text-secondary text-sm font-mono">{bet.externalId}</p>
            </div>
          )}
        </Card>

        {/* Timeline */}
        <Card>
          <CardTitle className="mb-4">Timeline</CardTitle>
          <div className="space-y-4">
            <TimelineEntry label="Created" date={bet.createdAt} active />
            <TimelineEntry label="Matched" date={bet.matchedAt} active={!!bet.matchedAt} />
            <TimelineEntry label="Result Reported" date={bet.resultReportedAt} active={!!bet.resultReportedAt} />
            <TimelineEntry label="Settled" date={bet.settledAt} active={!!bet.settledAt} />
          </div>
        </Card>

        {/* Game metadata */}
        {bet.gameMetadata && Object.keys(bet.gameMetadata).length > 0 && (
          <Card>
            <CardTitle className="mb-4">Game Details</CardTitle>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(bet.gameMetadata).map(([key, value]) => (
                <div key={key}>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-text-muted">{key}</p>
                  <p className="text-sm font-mono text-surface-200">{String(value)}</p>
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
                <p className="text-sm font-display font-medium text-surface-200">Dispute this bet</p>
                <p className="text-xs font-mono text-text-muted">If you believe the result is incorrect, you can file a dispute.</p>
              </div>
              <Button variant="danger" size="sm" onClick={() => setDisputeOpen(true)}>
                File Dispute
              </Button>
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
              className="w-full rounded-sm border border-surface-700 bg-surface-800 text-surface-200 font-mono text-sm px-3 py-2 resize-none focus:border-brand-400 focus:ring-0 focus:outline-none"
              required
            />
          </div>
        </Dialog>
      </div>
    </FadeIn>
  );
}

function TimelineEntry({ label, date, active }: { label: string; date: string | null; active: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
        active
          ? 'bg-brand-400 shadow-[0_0_8px_rgba(0,255,135,0.4)]'
          : 'bg-surface-700'
      }`} />
      <div>
        <p className={`text-sm font-mono ${active ? 'text-surface-200' : 'text-text-muted'}`}>{label}</p>
        {date && (
          <p className="text-xs font-mono text-text-secondary">{formatDate(date)}</p>
        )}
      </div>
    </div>
  );
}

function getOutcomeDisplay(outcome: string | null): { label: string; color: string } {
  switch (outcome) {
    case 'PLAYER_A_WIN':
      return { label: 'Player A Won', color: 'text-brand-400' };
    case 'PLAYER_B_WIN':
      return { label: 'Player B Won', color: 'text-brand-400' };
    case 'DRAW':
      return { label: 'Draw', color: 'text-surface-300' };
    default:
      return { label: 'Pending', color: 'text-text-muted' };
  }
}
