'use client';

import { Clock3, Gamepad2, Swords } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { FadeIn } from '@/components/ui/FadeIn';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChallengeItem } from '@/components/lobby/ChallengeItem';
import { useChallenges } from '@/components/lobby/ChallengesProvider';
import { formatCents } from '@/lib/utils/format';

/**
 * Persistent challenge inbox — so a challenge missed while the toast was gone
 * isn't lost. Reads from the shared ChallengesProvider (which polls
 * /api/lobby/invites); Accept/Decline route through /api/lobby/respond.
 */
export default function ChallengesPage() {
  const {
    invites,
    matches,
    outgoing,
    loading,
    busyId,
    busyOutgoingId,
    respond,
    cancelOutgoing,
    resumeMatch,
  } = useChallenges();

  return (
    <FadeIn>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-display font-bold text-ps-text dark:text-ps-text-on-dark">
          Challenges
        </h1>

        <Card>
          <CardTitle>Incoming challenges</CardTitle>
          <CardDescription>
            Wagers viewers have sent you while you&apos;re live. Accept to lock the stake and start the match.
          </CardDescription>

          <div className="mt-4">
            {loading && invites.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <Spinner size="lg" />
              </div>
            ) : invites.length === 0 ? (
              <EmptyState
                icon={<Swords size={20} />}
                title="No challenges right now"
                description="When a viewer challenges you on your stream, it shows up here."
              />
            ) : (
              <div className="space-y-3">
                {invites.map((invite) => (
                  <ChallengeItem
                    key={invite.lobbyEntryId}
                    invite={invite}
                    busy={busyId === invite.lobbyEntryId}
                    onRespond={respond}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>

        {matches.length > 0 && (
          <Card>
            <CardTitle>Matches ready</CardTitle>
            <CardDescription>
              Accepted challenges stay here until you enter or finish the match.
            </CardDescription>
            <div className="mt-4 space-y-3">
              {matches.map((match) => {
                const opponent =
                  match.myRole === 'A' ? match.playerBName : match.playerAName;
                return (
                  <div
                    key={match.betId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--ps-radius-md)] border border-brand-400/30 bg-brand-400/5 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-400/15 text-brand-400">
                        <Gamepad2 size={18} />
                      </span>
                      <div>
                        <p className="font-display text-sm font-semibold text-fg">
                          {match.gameName} with {opponent}
                        </p>
                        <p className="text-xs text-fg-secondary">
                          {formatCents(match.stakeAmount)} stake locked
                        </p>
                      </div>
                    </div>
                    <Button onClick={() => resumeMatch(match)}>Resume match</Button>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <Card>
          <CardTitle>Sent challenges</CardTitle>
          <CardDescription>
            Track invitations you&apos;ve sent and cancel one while it is still pending.
          </CardDescription>
          <div className="mt-4">
            {loading && outgoing.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <Spinner size="lg" />
              </div>
            ) : outgoing.length === 0 ? (
              <EmptyState
                icon={<Clock3 size={20} />}
                title="No sent challenges"
                description="Challenge a live player and its status will appear here."
              />
            ) : (
              <div className="space-y-3">
                {outgoing.map((challenge) => (
                  <div
                    key={challenge.challengeId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--ps-radius-md)] border border-themed bg-card p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-semibold text-fg">
                        {challenge.streamer.displayName} · {challenge.gameName}
                      </p>
                      <p className="mt-1 text-xs text-fg-secondary">
                        {formatCents(challenge.stakeAmount)} ·{' '}
                        <span
                          className={
                            challenge.status === 'ACCEPTED'
                              ? 'text-brand-400'
                              : challenge.status === 'PENDING'
                                ? 'text-accent-400'
                                : ''
                          }
                        >
                          {challenge.status === 'PENDING'
                            ? 'Waiting for response'
                            : challenge.status.toLowerCase()}
                        </span>
                      </p>
                    </div>
                    {challenge.status === 'PENDING' && (
                      <Button
                        variant="ghost"
                        loading={busyOutgoingId === challenge.challengeId}
                        onClick={() => cancelOutgoing(challenge.challengeId)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </FadeIn>
  );
}
