'use client';

import { Swords } from 'lucide-react';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { FadeIn } from '@/components/ui/FadeIn';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChallengeItem } from '@/components/lobby/ChallengeItem';
import { useChallenges } from '@/components/lobby/ChallengesProvider';

/**
 * Persistent challenge inbox — so a challenge missed while the toast was gone
 * isn't lost. Reads from the shared ChallengesProvider (which polls
 * /api/lobby/invites); Accept/Decline route through /api/lobby/respond.
 */
export default function ChallengesPage() {
  const { invites, loading, busyId, respond } = useChallenges();

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
      </div>
    </FadeIn>
  );
}
