'use client';

import { useEffect, useState } from 'react';
import { Swords } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCents } from '@/lib/utils/format';

export interface MyInvite {
  lobbyEntryId: string;
  gameType: string;
  gameName: string;
  stakeAmount: number;
  from: { userId: string; displayName: string };
  inviteExpiresAt: string;
  expiresAt: string;
  requiresReferee: boolean;
}

/** Seconds remaining until an ISO timestamp, floored at 0, ticking each second. */
function useSecondsLeft(iso: string): number {
  const compute = () => Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
  const [left, setLeft] = useState(compute);
  useEffect(() => {
    setLeft(compute());
    const id = setInterval(() => setLeft(compute()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]);
  return left;
}

interface ChallengeItemProps {
  invite: MyInvite;
  busy?: boolean;
  onRespond: (lobbyEntryId: string, action: 'ACCEPT' | 'DECLINE') => void;
}

/**
 * One incoming challenge: who, what game, how much, and how long left — plus
 * Accept / Decline. Shared by the ambient modal and the persistent inbox so
 * they behave identically. Buttons disable once the invite window elapses; the
 * poll will drop the entry shortly after.
 */
export function ChallengeItem({ invite, busy, onRespond }: ChallengeItemProps) {
  const secondsLeft = useSecondsLeft(invite.inviteExpiresAt);
  const expired = secondsLeft <= 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] dark:border-[var(--ps-border-dark)] bg-ps-paper-elevated dark:bg-ps-ink-2 p-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ps-lime/15 text-ps-lime">
          <Swords size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-display font-medium text-ps-text dark:text-ps-text-on-dark truncate">
            <span className="font-semibold">{invite.from.displayName}</span> challenged you
          </p>
          <p className="text-xs font-mono text-ps-muted dark:text-ps-muted-on-dark truncate">
            {invite.gameName} · <span className="text-ps-lime font-semibold">{formatCents(invite.stakeAmount)}</span>
            {' · '}
            {expired ? 'expired' : `${secondsLeft}s left`}
          </p>
          {invite.requiresReferee && (
            <p className="mt-1 text-[11px] font-semibold text-ps-lime">
              Live vs live · starts after an independent referee joins
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          onClick={() => onRespond(invite.lobbyEntryId, 'DECLINE')}
          disabled={busy || expired}
        >
          Decline
        </Button>
        <Button
          onClick={() => onRespond(invite.lobbyEntryId, 'ACCEPT')}
          loading={busy}
          disabled={busy || expired}
        >
          Accept
        </Button>
      </div>
    </div>
  );
}
