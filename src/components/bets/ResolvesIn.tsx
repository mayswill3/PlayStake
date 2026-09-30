'use client';

import { Lock } from 'lucide-react';
import { useCountdown } from '@/hooks/useCountdown';

/**
 * Live countdown to escrow release for a finished bet (`resolvesAt` from the
 * bets API), shown under its status wherever bets are listed.
 */
export function ResolvesIn({ at, className = '' }: { at: string; className?: string }) {
  const { label, isExpired } = useCountdown(at);
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-ps-muted dark:text-ps-muted-on-dark ${className}`}
      role="timer"
    >
      <Lock size={11} className="shrink-0 text-ps-lime" aria-hidden="true" />
      {isExpired ? (
        'Releasing escrow…'
      ) : (
        <>
          Resolves in{' '}
          <span className="font-mono font-semibold tabular-nums text-ps-text dark:text-ps-text-on-dark">{label}</span>
        </>
      )}
    </span>
  );
}
