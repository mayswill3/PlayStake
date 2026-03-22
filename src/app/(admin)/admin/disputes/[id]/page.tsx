'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { formatCents, formatDate } from '@/lib/utils/format';

interface DisputeDetail {
  id: string;
  status: string;
  reason: string;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
  bet: {
    id: string;
    amount: number;
    status: string;
    game: { name: string; slug: string };
    playerA: { id: string; displayName: string; email: string };
    playerB: { id: string; displayName: string; email: string } | null;
  };
  filedBy: { id: string; displayName: string; email: string };
  messages: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: { id: string; displayName: string; role: string };
  }>;
}

const RESOLUTION_OPTIONS = [
  { value: 'RESOLVED_PLAYER_A', label: 'Resolve for Player A' },
  { value: 'RESOLVED_PLAYER_B', label: 'Resolve for Player B' },
  { value: 'RESOLVED_DRAW', label: 'Resolve as Draw' },
  { value: 'RESOLVED_VOID', label: 'Void Bet' },
];

export default function AdminDisputeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState('');
  const [selectedOutcome, setSelectedOutcome] = useState('');

  useEffect(() => {
    fetch(`/api/admin/disputes/${params.id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load dispute');
        return r.json();
      })
      .then(setDispute)
      .catch(() => setDispute(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handleResolve() {
    if (!selectedOutcome || resolution.length < 5) {
      toast('error', 'Please select an outcome and provide a resolution (min 5 characters).');
      return;
    }

    setResolving(true);
    try {
      const res = await fetch(`/api/admin/disputes/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: selectedOutcome, resolution }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast('error', data.error || 'Failed to resolve dispute.');
      } else {
        toast('success', 'Dispute resolved successfully.');
        // Refresh
        const updated = await fetch(`/api/admin/disputes/${params.id}`).then((r) => r.json());
        setDispute(updated);
      }
    } catch {
      toast('error', 'Something went wrong.');
    } finally {
      setResolving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="p-4 rounded-sm bg-danger-500/10 border border-danger-500/25 text-danger-400 text-sm">
        Dispute not found.
      </div>
    );
  }

  const isOpen = dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-text-primary">Dispute Detail</h1>
          <p className="text-text-secondary font-mono text-sm mt-1">
            {dispute.bet.game.name} &middot; Filed {formatDate(dispute.createdAt)}
          </p>
        </div>
        <Button variant="ghost" onClick={() => router.push('/admin/disputes')}>
          Back to Disputes
        </Button>
      </div>

      {/* Dispute info */}
      <Card>
        <CardTitle>Dispute Information</CardTitle>
        <div className="mt-4 space-y-3">
          <DetailRow label="Status">
            <Badge
              variant={
                dispute.status === 'OPEN' ? 'warning' :
                dispute.status === 'UNDER_REVIEW' ? 'info' :
                dispute.status.startsWith('RESOLVED') ? 'success' : 'neutral'
              }
            >
              {dispute.status.replace(/_/g, ' ')}
            </Badge>
          </DetailRow>
          <DetailRow label="Filed By">{dispute.filedBy.displayName} ({dispute.filedBy.email})</DetailRow>
          <DetailRow label="Reason">
            <p className="text-sm text-text-primary whitespace-pre-wrap">{dispute.reason}</p>
          </DetailRow>
          {dispute.resolution && (
            <DetailRow label="Resolution">
              <p className="text-sm text-text-primary whitespace-pre-wrap">{dispute.resolution}</p>
            </DetailRow>
          )}
        </div>
      </Card>

      {/* Bet info */}
      <Card>
        <CardTitle>Bet Details</CardTitle>
        <div className="mt-4 space-y-3">
          <DetailRow label="Game">{dispute.bet.game.name}</DetailRow>
          <DetailRow label="Amount">{formatCents(Number(dispute.bet.amount))}</DetailRow>
          <DetailRow label="Bet Status">{dispute.bet.status}</DetailRow>
          <DetailRow label="Player A">{dispute.bet.playerA.displayName} ({dispute.bet.playerA.email})</DetailRow>
          <DetailRow label="Player B">
            {dispute.bet.playerB
              ? `${dispute.bet.playerB.displayName} (${dispute.bet.playerB.email})`
              : 'No opponent yet'}
          </DetailRow>
        </div>
      </Card>

      {/* Messages */}
      {dispute.messages.length > 0 && (
        <Card>
          <CardTitle>Messages</CardTitle>
          <div className="mt-4 space-y-4">
            {dispute.messages.map((msg) => (
              <div key={msg.id} className="p-3 rounded-sm bg-surface-800">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-text-primary">{msg.author.displayName}</span>
                  <Badge variant={msg.author.role === 'ADMIN' ? 'danger' : 'neutral'}>{msg.author.role}</Badge>
                  <span className="text-xs text-text-muted">{formatDate(msg.createdAt)}</span>
                </div>
                <p className="text-sm text-surface-300 whitespace-pre-wrap">{msg.body}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Resolution actions */}
      {isOpen && (
        <Card>
          <CardTitle>Resolve Dispute</CardTitle>
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {RESOLUTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedOutcome(opt.value)}
                  className={`
                    px-3 py-1.5 rounded-sm text-sm font-medium transition-colors
                    ${selectedOutcome === opt.value
                      ? 'bg-brand-400/15 text-brand-400 border border-brand-500/25'
                      : 'text-text-secondary hover:text-text-primary border border-surface-700 hover:border-surface-600'
                    }
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <textarea
              className="w-full p-3 rounded-sm bg-surface-800 border border-surface-700 text-text-primary text-sm placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-y min-h-[100px]"
              placeholder="Provide resolution details (min 5 characters)..."
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end">
              <Button loading={resolving} onClick={handleResolve} disabled={!selectedOutcome || resolution.length < 5}>
                Resolve Dispute
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-2 border-b border-white/8 last:border-0">
      <span className="text-sm text-text-secondary sm:w-32 shrink-0">{label}</span>
      <div className="text-sm text-text-primary">{children}</div>
    </div>
  );
}
