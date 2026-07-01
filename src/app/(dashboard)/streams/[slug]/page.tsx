'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Radio, Users, ExternalLink } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { FadeIn } from '@/components/ui/FadeIn';
import { EmptyState } from '@/components/ui/EmptyState';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { StatusPill } from '@/components/ui/playstake/StatusPill';
import { KickPlayer } from '@/components/ui/playstake/KickPlayer';
import { formatCents } from '@/lib/utils/format';

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

interface Streamer {
  channelSlug: string;
  displayName: string | null;
  profilePicture: string | null;
  isLive: boolean;
  viewerCount: number | null;
  thumbnail: string | null;
  title: string | null;
}

interface ActiveBet {
  id: string;
  gameName: string;
  playerAName: string;
  playerBName: string | null;
  amount: number;
  status: string;
  createdAt: string;
}

interface StreamData {
  streamer: Streamer;
  bets: ActiveBet[];
}

export default function StreamDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [data, setData] = useState<StreamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    let active = true;
    const load = () =>
      fetch(`/api/streamers/${slug}`)
        .then(async (r) => {
          if (!r.ok) throw new Error('Streamer not found');
          return r.json();
        })
        .then((d) => active && setData(d))
        .catch(() => active && setError('Failed to load stream.'))
        .finally(() => active && setLoading(false));
    load();
    // Keep live status, viewer count, and active bets fresh.
    const id = setInterval(load, 45000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <p className="text-ps-error font-mono">{error || 'Streamer not found.'}</p>
          <PSButton variant="ghost" onClick={() => router.back()} className="mt-4">
            Go Back
          </PSButton>
        </Card>
      </div>
    );
  }

  const { streamer, bets } = data;
  const name = streamer.displayName || streamer.channelSlug;

  return (
    <FadeIn>
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          onClick={() => router.back()}
          className="text-sm font-mono text-ps-muted dark:text-ps-muted-on-dark hover:text-ps-text dark:hover:text-ps-text-on-dark transition-colors"
        >
          &larr; Back
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {streamer.profilePicture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={streamer.profilePicture} alt="" className="h-12 w-12 rounded-full object-cover shrink-0" />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ps-lime/15 text-ps-lime text-lg font-bold">
                {name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-display font-bold text-ps-text dark:text-ps-text-on-dark truncate">
                  {name}
                </h1>
                {streamer.isLive ? (
                  <StatusPill status="live" />
                ) : (
                  <span className="text-[10px] font-mono uppercase tracking-wider text-ps-muted dark:text-ps-muted-on-dark">
                    Offline
                  </span>
                )}
              </div>
              {streamer.title && (
                <p className="text-sm text-ps-muted dark:text-ps-muted-on-dark truncate">{streamer.title}</p>
              )}
              {streamer.viewerCount !== null && streamer.isLive && (
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-mono text-ps-muted dark:text-ps-muted-on-dark tabular-nums">
                  <Users size={12} /> {streamer.viewerCount.toLocaleString()} watching
                </p>
              )}
            </div>
          </div>
          <a
            href={`https://kick.com/${streamer.channelSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-mono text-ps-muted dark:text-ps-muted-on-dark hover:text-ps-text dark:hover:text-ps-text-on-dark transition-colors"
          >
            Open on Kick <ExternalLink size={14} />
          </a>
        </div>

        {/* Player */}
        <KickPlayer slug={streamer.channelSlug} />

        {/* Active bets */}
        <Card>
          <CardTitle className="mb-4">Live bets</CardTitle>
          {bets.length === 0 ? (
            <EmptyState
              icon={<Radio size={20} />}
              title="No active bets"
              description={`${name} has no open or in-progress bets right now.`}
            />
          ) : (
            <div className="divide-y divide-[var(--ps-border-light)] dark:divide-[var(--ps-border-dark)]">
              {bets.map((bet) => (
                <Link
                  key={bet.id}
                  href={`/bets/${bet.id}`}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-display font-medium text-ps-text dark:text-ps-text-on-dark truncate group-hover:text-ps-lime transition-colors">
                      {bet.gameName}
                    </p>
                    <p className="text-xs font-mono text-ps-muted dark:text-ps-muted-on-dark truncate">
                      {bet.playerAName} vs {bet.playerBName ?? 'Awaiting opponent'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-display font-semibold text-ps-lime tabular-nums">
                      {formatCents(bet.amount)}
                    </span>
                    <StatusPill status={mapBetStatusToPill(bet.status)} label={bet.status.replace(/_/g, ' ')} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </FadeIn>
  );
}
