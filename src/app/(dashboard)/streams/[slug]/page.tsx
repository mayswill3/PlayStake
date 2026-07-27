'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Radio, Users, ExternalLink, Swords, Gamepad2, Scale } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { FadeIn } from '@/components/ui/FadeIn';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { StatusPill } from '@/components/ui/playstake/StatusPill';
import { KickPlayer } from '@/components/ui/playstake/KickPlayer';
import { formatCents } from '@/lib/utils/format';

const STAKE_OPTIONS_CENTS = [100, 500, 1000, 2500];

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
  declaredGame: { gameType: string; name: string } | null;
  isSelf: boolean;
  canChallenge: boolean;
  streamVsStreamEligible: boolean;
}

interface ActiveBet {
  id: string;
  gameName: string;
  playerAName: string;
  playerBName: string | null;
  amount: number;
  status: string;
  createdAt: string;
  referee: { displayName: string; kickChannel: string | null; status: string } | null;
}

interface StreamData {
  streamer: Streamer;
  bets: ActiveBet[];
}

export default function StreamDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [data, setData] = useState<StreamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Challenge dialog state.
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [stakeCents, setStakeCents] = useState(STAKE_OPTIONS_CENTS[1]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function sendChallenge() {
    setSending(true);
    try {
      const res = await fetch(`/api/streamers/${slug}/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: stakeCents }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          res.status === 429
            ? 'Slow down — too many challenges. Try again shortly.'
            : body.error || 'Could not send the challenge.';
        toast('error', msg);
        return;
      }
      setSent(true);
      toast('success', 'Challenge sent! Waiting for them to accept.');
    } catch {
      toast('error', 'Something went wrong.');
    } finally {
      setSending(false);
    }
  }

  function openChallenge() {
    setSent(false);
    setStakeCents(STAKE_OPTIONS_CENTS[1]);
    setChallengeOpen(true);
  }

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

        {/* Declared game + challenge */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] bg-ps-paper-elevated dark:bg-ps-ink-2 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Gamepad2 size={16} className="shrink-0 text-ps-muted dark:text-ps-muted-on-dark" />
            {streamer.declaredGame ? (
              <p className="text-sm font-mono text-ps-text dark:text-ps-text-on-dark truncate">
                Playing <span className="font-semibold text-ps-lime">{streamer.declaredGame.name}</span>
              </p>
            ) : (
              <p className="text-sm font-mono text-ps-muted dark:text-ps-muted-on-dark truncate">
                No game declared
              </p>
            )}
          </div>
          {!streamer.isSelf && (
            <PSButton
              size="sm"
              icon={<Swords size={16} />}
              onClick={openChallenge}
              disabled={!streamer.canChallenge}
            >
              Challenge
            </PSButton>
          )}
        </div>
        {!streamer.isSelf && !streamer.canChallenge && (
          <p className="-mt-4 text-xs font-mono text-ps-muted dark:text-ps-muted-on-dark">
            {!streamer.isLive
              ? 'Challenges open when this streamer is live.'
              : !streamer.declaredGame
                ? 'This streamer hasn’t declared a game to challenge yet.'
                : 'Go live on Kick with the same declared game to challenge this player.'}
          </p>
        )}

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
                    {bet.referee && (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-mono text-ps-lime">
                        <Scale size={12} /> Referee {bet.referee.displayName}
                        {bet.referee.kickChannel ? ` · @${bet.referee.kickChannel}` : ''}
                      </p>
                    )}
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

        <Dialog
          open={challengeOpen}
          onClose={() => setChallengeOpen(false)}
          title={sent ? 'Challenge sent' : `Challenge ${name}`}
          actions={
            sent ? (
              <Button onClick={() => setChallengeOpen(false)}>Done</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setChallengeOpen(false)}>
                  Cancel
                </Button>
                <Button loading={sending} onClick={sendChallenge}>
                  Send Challenge
                </Button>
              </>
            )
          }
        >
          {sent ? (
            <p className="text-sm">
              Your {streamer.streamVsStreamEligible ? 'same-game live ' : ''}challenge for{' '}
              <span className="font-semibold text-ps-lime">{formatCents(stakeCents)}</span> is on its
              way. If {name} accepts, both of you lock the stake and the match begins.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm">
                Playing{' '}
                <span className="font-semibold text-ps-lime">
                  {streamer.declaredGame?.name}
                </span>
                . {streamer.streamVsStreamEligible
                  ? 'Both Kick channels must remain live on this game. Pick your stake; an approved referee is assigned before the result can settle.'
                  : 'Pick your stake — both players lock the same amount when the challenge is accepted.'}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {STAKE_OPTIONS_CENTS.map((cents) => {
                  const selected = stakeCents === cents;
                  return (
                    <button
                      key={cents}
                      type="button"
                      onClick={() => setStakeCents(cents)}
                      aria-pressed={selected}
                      className={`rounded-lg border py-2 text-sm font-semibold tabular-nums transition-colors ${
                        selected
                          ? 'border-ps-lime bg-ps-lime/10 text-ps-lime'
                          : 'border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] text-ps-muted dark:text-ps-muted-on-dark hover:border-ps-lime/40'
                      }`}
                    >
                      {formatCents(cents)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Dialog>
      </div>
    </FadeIn>
  );
}
