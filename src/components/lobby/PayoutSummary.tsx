'use client';

import { useMatchFee } from '@/hooks/useMatchFee';
import { formatCents } from '@/lib/utils/format';
import { formatFeePercent, payoutBreakdown } from '@/lib/utils/payout';

/**
 * What this stake pays, shown before a player commits: the fee, what a win
 * returns, and what a draw returns. Figures match settlement exactly.
 */
export function PayoutSummary({ gameType, stakeCents, className = '' }: {
  gameType: string;
  stakeCents: number;
  className?: string;
}) {
  const fee = useMatchFee(gameType);
  if (fee === null) return null;
  const { feeCents, winCents, drawEachCents } = payoutBreakdown(stakeCents, fee);

  return (
    <p className={`text-[11px] leading-relaxed text-fg-muted ${className}`}>
      {fee > 0 ? (
        <>
          PlayStake takes a {formatFeePercent(fee)} fee from the pot ({formatCents(feeCents)}). A win pays{' '}
          <span className="font-semibold text-fg">{formatCents(winCents)}</span>; a draw returns{' '}
          {formatCents(drawEachCents)} to each player.
        </>
      ) : (
        <>
          No fee on this game. A win pays <span className="font-semibold text-fg">{formatCents(winCents)}</span>; a
          draw returns each stake in full.
        </>
      )}
    </p>
  );
}
