'use client';

import Link from 'next/link';
import { Clock3, Swords } from 'lucide-react';
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
/** How each sent challenge's outcome reads to the challenger. */
const OUTGOING_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Waiting for response',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  EXPIRED: 'No response — timed out',
  CANCELLED: 'Closed',
};

export default function ChallengesPage() {
  const {
    invites,
    outgoing,
    loading,
    busyId,
    busyOutgoingId,
    respond,
    cancelOutgoing,
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
            Stream matches are played under the{' '}
            <Link href="/match-rules" className="underline underline-offset-2">Match Rules</Link>.
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
                          {OUTGOING_STATUS_LABEL[challenge.status] ?? challenge.status.toLowerCase()}
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
