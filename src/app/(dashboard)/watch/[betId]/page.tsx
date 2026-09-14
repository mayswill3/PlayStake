'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Lock, Scale, ShieldCheck, Trophy, Video } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { FadeIn } from '@/components/ui/FadeIn';
import { Spinner } from '@/components/ui/Spinner';
import { DarkGlowCard } from '@/components/ui/playstake/DarkGlowCard';
import { MatchChat } from '@/components/matches/MatchChat';
import { MatchStreams } from '@/components/matches/MatchStreams';
import {
  ACTIVE_PHASES,
  LiveMatchCard,
  ParticipantAvatar,
  PhaseBadge,
  useLiveMatches,
  type SpectatorMatch,
  type SpectatorParticipant,
} from '@/components/matches/live-matches';
import { formatCents } from '@/lib/utils/format';

const POLL_MS = 10_000;

export default function WatchMatchPage() {
  const { betId } = useParams<{ betId: string }>();
  const [match, setMatch] = useState<SpectatorMatch | null>(null);
  const [notFound, setNotFound] = useState(false);

  const active = match ? ACTIVE_PHASES.includes(match.phase) : true;
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/matches/${betId}`, { cache: 'no-store' });
        if (cancelled) return;
        if (response.status === 404) {
          setNotFound(true);
          return;
        }
        if (response.ok) setMatch((await response.json()).match);
      } catch {
        /* network blip — the next poll retries */
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [betId, active]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardTitle>Match not found</CardTitle>
          <p className="mt-2 text-sm text-ps-muted dark:text-ps-muted-on-dark">
            This match doesn&apos;t exist or isn&apos;t open to spectators.
          </p>
          <Link href="/watch" className="mt-4 inline-block text-sm font-semibold text-ps-lime hover:underline">
            &larr; Live matches
          </Link>
        </Card>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <FadeIn>
      <div className="mx-auto max-w-7xl space-y-6">
        <Link
          href="/watch"
          className="inline-block text-sm font-mono text-ps-muted transition-colors hover:text-ps-text dark:text-ps-muted-on-dark dark:hover:text-ps-text-on-dark"
        >
          &larr; Live matches
        </Link>

        <Scoreboard match={match} />
        <ResultBanner match={match} />

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="min-w-0">
            <div className="mb-5 flex items-center justify-between gap-3">
              <CardTitle>Watch on Kick</CardTitle>
              {match.phase === 'FINDING_REFEREE' && (
                <span className="text-xs text-ps-muted dark:text-ps-muted-on-dark">
                  The referee cam appears here once a referee claims the match
                </span>
              )}
            </div>
            <MatchStreams
              referee={match.referee ? toStream(match.referee) : null}
              players={[match.playerA, ...(match.playerB ? [match.playerB] : [])].map(toStream)}
            />
          </Card>
          {/* Beside the streams on wide screens (pinned while scrolling), below them otherwise. */}
          <MatchChat
            betId={match.betId}
            className="h-[520px] xl:sticky xl:top-20 xl:h-[calc(100vh-7rem)] xl:max-h-[780px]"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Assurance icon={<Lock className="h-4 w-4" />} title="Stakes in escrow">
            Both stakes are locked the moment the match is accepted.
          </Assurance>
          <Assurance icon={<Video className="h-4 w-4" />} title="Referee on camera">
            An independent referee officiates live on Kick.
          </Assurance>
          <Assurance icon={<ShieldCheck className="h-4 w-4" />} title="15-minute dispute window">
            The result stands only after the window closes.
          </Assurance>
        </div>

        <MoreLiveMatches currentBetId={match.betId} />
      </div>
    </FadeIn>
  );
}

function toStream(participant: SpectatorParticipant) {
  return {
    name: participant.displayName,
    channelSlug: participant.channelSlug,
    isLive: participant.isLive,
  };
}

function Scoreboard({ match }: { match: SpectatorMatch }) {
  return (
    <DarkGlowCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <PhaseBadge phase={match.phase} />
          <span className="text-xs font-semibold uppercase tracking-widest text-ps-muted-on-dark">{match.gameName}</span>
        </div>
        <span className="font-display text-lg font-semibold tabular-nums text-ps-lime">
          {formatCents(match.potCents)} pot
        </span>
      </div>

      <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
        <PlayerSide participant={match.playerA} align="left" />
        <span className="font-display text-xl font-bold text-ps-muted-on-dark sm:text-3xl">VS</span>
        {match.playerB ? (
          <PlayerSide participant={match.playerB} align="right" />
        ) : (
          <span className="text-right text-sm text-ps-muted-on-dark">Awaiting opponent</span>
        )}
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 border-t border-[var(--ps-border-dark)] pt-4 text-sm text-ps-muted-on-dark">
        <Scale className="h-4 w-4 text-ps-lime" aria-hidden="true" />
        {match.referee ? (
          <span>
            Refereed by <span className="font-semibold text-ps-text-on-dark">{match.referee.displayName}</span>
            {match.referee.isLive && <span className="ml-2 text-xs font-bold uppercase text-ps-error">● Live</span>}
          </span>
        ) : (
          <span>Finding an independent referee…</span>
        )}
      </div>
    </DarkGlowCard>
  );
}

function PlayerSide({ participant, align }: { participant: SpectatorParticipant; align: 'left' | 'right' }) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <ParticipantAvatar participant={participant} size="lg" />
      <div className="min-w-0">
        <p className="truncate font-display text-lg font-semibold text-ps-text-on-dark sm:text-2xl">{participant.displayName}</p>
        <p className={`text-xs font-bold uppercase tracking-wider ${participant.isLive ? 'text-ps-error' : 'text-ps-muted-on-dark'}`}>
          {participant.isLive ? '● Live' : 'Offline'}
        </p>
      </div>
    </div>
  );
}

function ResultBanner({ match }: { match: SpectatorMatch }) {
  if (match.phase === 'VOIDED') {
    return (
      <Card className="text-center">
        <p className="font-display font-semibold text-ps-text dark:text-ps-text-on-dark">This match was voided</p>
        <p className="mt-1 text-sm text-ps-muted dark:text-ps-muted-on-dark">Both stakes were refunded.</p>
      </Card>
    );
  }
  if (match.phase !== 'FINISHED') return null;
  const winner =
    match.outcome === 'PLAYER_A_WIN'
      ? match.playerA.displayName
      : match.outcome === 'PLAYER_B_WIN'
        ? match.playerB?.displayName
        : null;
  return (
    <Card className="border-ps-lime/40 text-center">
      <Trophy className="mx-auto h-8 w-8 text-ps-lime" aria-hidden="true" />
      <p className="mt-2 font-display text-xl font-bold text-ps-text dark:text-ps-text-on-dark">
        {winner ? `${winner} won` : 'Draw'}
      </p>
      <p className="mt-1 text-sm text-ps-muted dark:text-ps-muted-on-dark">Result confirmed by the referee and settled.</p>
    </Card>
  );
}

function Assurance({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--ps-radius-lg)] border border-[var(--ps-border-light)] bg-ps-paper-elevated p-4 dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2">
      <p className="flex items-center gap-2 text-sm font-semibold text-ps-text dark:text-ps-text-on-dark">
        <span className="text-ps-lime">{icon}</span>
        {title}
      </p>
      <p className="mt-1 text-xs text-ps-muted dark:text-ps-muted-on-dark">{children}</p>
    </div>
  );
}

function MoreLiveMatches({ currentBetId }: { currentBetId: string }) {
  const { matches, refreshKey } = useLiveMatches();
  const others = (matches ?? []).filter((match) => match.betId !== currentBetId).slice(0, 3);
  if (others.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-semibold text-ps-text dark:text-ps-text-on-dark">More live matches</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {others.map((match) => (
          <LiveMatchCard key={match.betId} match={match} refreshKey={refreshKey} />
        ))}
      </div>
    </section>
  );
}
