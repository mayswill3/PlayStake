'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Radio, Users, ExternalLink, Swords, Gamepad2, Scale } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { FadeIn } from '@/components/ui/FadeIn';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { StatusPill } from '@/components/ui/playstake/StatusPill';
import { KickPlayer } from '@/components/ui/playstake/KickPlayer';
import { GoLiveBanner } from '@/components/kick/GoLiveBanner';
import { useOnKickStatusChanged } from '@/components/kick/kick-status';
import { STREAM_GAME_CATALOGUE, type StreamGameType } from '@/lib/games/catalogue';
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
  selectedGameRequiresReferee: boolean;
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
  // Bumped when the viewer goes live / changes game, so challenge eligibility
  // (canChallenge) is re-checked straight away instead of on the next poll.
  const [refreshKey, setRefreshKey] = useState(0);
  useOnKickStatusChanged(useCallback(() => setRefreshKey((key) => key + 1), []));

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
  }, [slug, refreshKey]);

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
  // Refereed games need the challenger live on the same game — offer it in one click.
  const declaredMeta = streamer.declaredGame
    ? STREAM_GAME_CATALOGUE[streamer.declaredGame.gameType as StreamGameType]
    : undefined;
  const suggestedGame =
    !streamer.isSelf && streamer.declaredGame && declaredMeta?.mode === 'refereed'
      ? { gameType: streamer.declaredGame.gameType, name: streamer.declaredGame.name, streamerName: name }
      : null;

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
                : 'Go live on Kick and select the same game to challenge this player.'}
          </p>
        )}

        {/* Prominent Go Live — challenging a refereed game needs you live on it too. */}
        <GoLiveBanner suggestedGame={suggestedGame} />

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
          size="lg"
          title={sent ? 'Challenge sent' : `Challenge ${name}`}
          actions={
            sent ? (
              <PSButton onClick={() => setChallengeOpen(false)}>Done</PSButton>
            ) : (
              <>
                <PSButton variant="ghost" onClick={() => setChallengeOpen(false)}>
                  Cancel
                </PSButton>
                <PSButton loading={sending} icon={<Swords size={16} />} onClick={sendChallenge}>
                  Send {formatCents(stakeCents)} challenge
                </PSButton>
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
                . {streamer.streamVsStreamEligible || streamer.selectedGameRequiresReferee
                  ? 'Both Kick channels must remain live on this game. Pick your stake; an approved referee is assigned before the result can settle.'
                  : 'Pick your stake — both players lock the same amount when the challenge is accepted.'}
              </p>
              <p className="text-xs font-semibold uppercase tracking-wider">Your stake</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {STAKE_OPTIONS_CENTS.map((cents) => {
                  const selected = stakeCents === cents;
                  return (
                    <button
                      key={cents}
                      type="button"
                      onClick={() => setStakeCents(cents)}
                      aria-pressed={selected}
                      className={`rounded-lg border py-4 font-display text-lg font-semibold tabular-nums transition-colors ${
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
              <p className="flex items-center justify-between rounded-lg bg-ps-lime/10 px-4 py-3 text-sm">
                <span>Pot if {name} accepts</span>
                <span className="font-display text-lg font-semibold text-ps-lime tabular-nums">
                  {formatCents(stakeCents * 2)}
                </span>
              </p>
            </div>
          )}
        </Dialog>
      </div>
    </FadeIn>
  );
}
