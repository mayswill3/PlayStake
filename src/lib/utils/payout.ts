// =============================================================================
// PlayStake — What a player gets back
// =============================================================================
// The same arithmetic settlement uses: the fee is a percentage of the whole
// pot, rounded half-up to the cent; the winner receives the rest; a draw
// splits the rest equally. Shown to players before they commit a stake.
// =============================================================================

export interface PayoutBreakdown {
  potCents: number;
  feeCents: number;
  /** What the winner receives in total (their own stake included). */
  winCents: number;
  /** What each player receives on a draw. */
  drawEachCents: number;
}

export function payoutBreakdown(stakeCents: number, feePercent: number): PayoutBreakdown {
  const potCents = stakeCents * 2;
  const feeCents = Math.round(potCents * feePercent);
  const winCents = potCents - feeCents;
  return { potCents, feeCents, winCents, drawEachCents: Math.floor(winCents / 2) };
}

/** "5%" or "2.5%". */
export function formatFeePercent(feePercent: number): string {
  return `${Number((feePercent * 100).toFixed(2))}%`;
}
