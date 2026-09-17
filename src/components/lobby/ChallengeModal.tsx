'use client';

import { useState } from 'react';
import { Clock, Scale, Swords } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { formatCents } from '@/lib/utils/format';
import { useSecondsLeft, type MyInvite } from './ChallengeItem';

/**
 * The ambient "you've been challenged" modal — large and centred so a real-money
 * invite can't be missed: who, the game, the stake and pot, a draining
 * countdown, and full-width Accept / Decline. Once the invite window closes it
 * switches to an expired state rather than leaving dead buttons.
 */
export function ChallengeModal({
  invite,
  busy,
  onRespond,
  onClose,
}: {
  invite: MyInvite | null;
  busy: boolean;
  onRespond: (lobbyEntryId: string, action: 'ACCEPT' | 'DECLINE') => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={invite !== null} onClose={onClose} size="lg">
      {invite && (
        <ChallengeBody key={invite.lobbyEntryId} invite={invite} busy={busy} onRespond={onRespond} onClose={onClose} />
      )}
    </Dialog>
  );
}

function ChallengeBody({
  invite,
  busy,
  onRespond,
  onClose,
}: {
  invite: MyInvite;
  busy: boolean;
  onRespond: (lobbyEntryId: string, action: 'ACCEPT' | 'DECLINE') => void;
  onClose: () => void;
}) {
  const secondsLeft = useSecondsLeft(invite.inviteExpiresAt);
  // The bar drains from however long was left when the modal appeared.
  const [initialSeconds] = useState(() => Math.max(secondsLeft, 1));
  const expired = secondsLeft <= 0;
  const runningLow = !expired && secondsLeft <= 15;
  const challenger = invite.from.displayName;

  return (
    <div className="font-sans text-ps-text dark:text-ps-text-on-dark">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ps-lime">
          <Swords size={14} aria-hidden="true" />
          New challenge
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
            expired
              ? 'bg-ps-paper text-ps-muted dark:bg-ps-ink-3 dark:text-ps-muted-on-dark'
              : runningLow
                ? 'bg-ps-warning/15 text-ps-warning'
                : 'bg-ps-lime/10 text-ps-lime'
          }`}
          aria-live="polite"
        >
          <Clock size={13} aria-hidden="true" />
          {expired ? 'Expired' : `${secondsLeft}s left`}
        </span>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <span
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ps-lime/15 font-display text-2xl font-bold text-ps-lime ring-2 ring-ps-lime/40"
          aria-hidden="true"
        >
          {challenger.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-2xl font-bold sm:text-3xl">{challenger}</p>
          <p className="text-sm text-ps-muted dark:text-ps-muted-on-dark">challenged you to a match</p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label="Game" value={invite.gameName} />
        <Tile label="Stake each" value={formatCents(invite.stakeAmount)} accent />
        <Tile label="Pot" value={formatCents(invite.stakeAmount * 2)} />
      </dl>

      {invite.requiresReferee && (
        <p className="mt-4 flex items-start gap-2 rounded-[var(--ps-radius-md)] bg-ps-lime/10 p-3 text-sm">
          <Scale size={16} className="mt-0.5 shrink-0 text-ps-lime" aria-hidden="true" />
          <span>
            <span className="font-semibold">Live vs live.</span> Your stake locks when you accept, and the match
            starts once an independent referee joins.
          </span>
        </p>
      )}

      {!expired && (
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-ps-lime/10" aria-hidden="true">
          <div
            className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${runningLow ? 'bg-ps-warning' : 'bg-ps-lime'}`}
            style={{ width: `${Math.min(1, secondsLeft / initialSeconds) * 100}%` }}
          />
        </div>
      )}

      {expired ? (
        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-ps-muted dark:text-ps-muted-on-dark">
            This challenge expired before it was answered.
          </p>
          <PSButton variant="secondary" size="md" onClick={onClose}>
            Close
          </PSButton>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3">
          <PSButton
            variant="secondary"
            size="lg"
            fullWidth
            disabled={busy}
            onClick={() => onRespond(invite.lobbyEntryId, 'DECLINE')}
          >
            Decline
          </PSButton>
          <PSButton
            variant="primary"
            size="lg"
            fullWidth
            loading={busy}
            icon={<Swords size={18} />}
            onClick={() => onRespond(invite.lobbyEntryId, 'ACCEPT')}
          >
            Accept
          </PSButton>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-[var(--ps-radius-md)] border border-[var(--ps-border-light)] bg-ps-paper p-3 dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-ps-muted dark:text-ps-muted-on-dark">{label}</dt>
      <dd
        className={`mt-1 truncate font-display font-semibold tabular-nums ${
          accent ? 'text-xl text-ps-lime' : 'text-lg text-ps-text dark:text-ps-text-on-dark'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
