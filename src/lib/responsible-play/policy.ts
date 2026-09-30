import { assertEligibleToGamble } from "../compliance/eligibility";
import { getDepositLimits, getDepositUsage } from "./service";
import { DepositLimitError } from "./errors";

export { DepositLimitError, PlayBreakError } from "./errors";

/**
 * Block wagering unless the customer may gamble: active account, verified
 * age and identity, not on GAMSTOP, no break (see compliance/eligibility).
 *
 * Applied at every point a stake can be committed — joining a lobby, sending
 * or accepting an invite, issuing a challenge, and for the opponent when a
 * match is accepted — so the user is stopped before they are drawn into a
 * match.
 */
export async function assertCanWager(
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  await assertEligibleToGamble(userId, now);
}

/**
 * Block a deposit the customer may not make: anything assertCanWager refuses,
 * or a deposit a self-set limit would exceed.
 *
 * Checked against every configured period, tightest first, so the message
 * names the limit the user actually hit.
 */
export async function assertCanDeposit(
  userId: string,
  amountCents: number,
  now: Date = new Date(),
): Promise<void> {
  await assertEligibleToGamble(userId, now);

  const [limits, usage] = await Promise.all([
    getDepositLimits(userId, now),
    getDepositUsage(userId, now),
  ]);

  for (const limit of limits) {
    const used = usage[limit.period] ?? 0;
    const remaining = Math.max(0, limit.amountCents - used);
    if (used + amountCents > limit.amountCents) {
      throw new DepositLimitError(limit.period, limit.amountCents, remaining);
    }
  }
}
