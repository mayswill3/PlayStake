'use client';

import { useEffect, useRef } from 'react';
import { Check, X, Target } from 'lucide-react';
import { useCountdown } from '@/hooks/useCountdown';
import { Spinner } from '@/components/ui/Spinner';

interface InviteReceivedProps {
  fromName: string;
  fromInitials: string;
  stakeCents: number;
  gameName: string;
  inviteExpiresAt: string;
  onAccept: () => void;
  onDecline: () => void;
  isResponding?: boolean;
}

function formatUsd(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function InviteReceived({
  fromName,
  fromInitials,
  stakeCents,
  gameName,
  inviteExpiresAt,
  onAccept,
  onDecline,
  isResponding,
}: InviteReceivedProps) {
  const { label, secondsLeft, isExpired } = useCountdown(inviteExpiresAt);
  const acceptRef = useRef<HTMLButtonElement>(null);

  // Focus the primary action when the invite arrives
  useEffect(() => {
    acceptRef.current?.focus();
  }, []);

  const total = stakeCents * 2;
  const urgent = secondsLeft <= 15;

  return (
    <div className="rounded-xl border-2 border-brand-600/40 bg-brand-600/5 p-4 shadow-[0_0_0_1px_rgba(34,197,94,0.1)] animate-[fadeIn_0.2s_ease-out]">
      <div className="flex items-center gap-2 mb-4">
        <Target size={16} className="text-brand-600 dark:text-brand-400" />
        <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">
          Match invite received
        </p>
      </div>

      {/* Inviter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600/10 text-brand-600 dark:text-brand-400 text-xs font-bold">
          {fromInitials}
        </div>
        <div>
          <p className="text-sm font-semibold text-fg">
            {fromName} <span className="font-normal text-fg-secondary">wants to play you</span>
          </p>
        </div>
      </div>

      {/* Match details */}
      <dl className="space-y-1.5 rounded-lg bg-card border border-themed px-3 py-2.5 mb-4 text-xs font-mono">
        <div className="flex items-center justify-between">
          <dt className="text-fg-muted">Game</dt>
          <dd className="text-fg font-semibold">{gameName}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-fg-muted">Stake</dt>
          <dd className="text-fg font-semibold tabular-nums">${formatUsd(stakeCents)} each</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-fg-muted">Total pot</dt>
          <dd className="text-brand-600 dark:text-brand-400 font-bold tabular-nums">
            ${formatUsd(total)}
          </dd>
        </div>
      </dl>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          ref={acceptRef}
          type="button"
          onClick={onAccept}
          disabled={isResponding || isExpired}
          className="
            inline-flex items-center justify-center gap-1.5
            rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white
            hover:bg-brand-700 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-brand-600/50
          "
        >
          {isResponding ? (
            <Spinner size="sm" />
          ) : (
            <>
              <Check size={14} strokeWidth={3} />
              Accept
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onDecline}
          disabled={isResponding || isExpired}
          className="
            inline-flex items-center justify-center gap-1.5
            rounded-lg border border-themed bg-card px-3 py-2.5 text-sm font-semibold text-fg-secondary
            hover:bg-elevated hover:text-fg transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          <X size={14} strokeWidth={3} />
          Decline
        </button>
      </div>

      <p
        className={`text-[11px] font-mono text-center mt-3 tabular-nums ${
          urgent ? 'text-danger-400' : 'text-fg-muted'
        }`}
        aria-live="polite"
      >
        {isExpired ? 'Invite expired' : <>Invite expires in {label}</>}
      </p>
    </div>
  );
}
