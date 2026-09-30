import { assertEligibleToGamble } from "../compliance/eligibility";
import { prisma } from "../db/client";
import { AppError } from "../errors";
import { getDepositLimits, getDepositUsage } from "./service";
import { DepositLimitError } from "./errors";

export { DepositLimitError, PlayBreakError } from "./errors";

/** The customer hasn't yet been offered a deposit limit before depositing. */
export class DepositLimitPromptError extends AppError {
  constructor() {
    super(
      "Before your first deposit, choose whether to set a deposit limit.",
      409,
      "DEPOSIT_LIMIT_PROMPT",
    );
    this.name = "DepositLimitPromptError";
  }
}

/**
 * Every customer is offered a deposit limit before they first deposit. They
 * can set one or decline, but they must answer; either answer is recorded.
 */
export async function assertDepositLimitPromptAnswered(userId: string): Promise<void> {
  const [settings, limits] = await Promise.all([
    prisma.responsiblePlaySettings.findUnique({
      where: { userId },
      select: { depositLimitPromptedAt: true },
    }),
    prisma.depositLimit.count({ where: { userId } }),
  ]);
  if (settings?.depositLimitPromptedAt || limits > 0) return;
  throw new DepositLimitPromptError();
}

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
