// =============================================================================
// PlayStake — Protection of customer funds (LCCP 4.2.1)
// =============================================================================
// Customers must be told in writing how well their deposited funds are
// protected if PlayStake became insolvent, and must acknowledge it before they
// can gamble with deposited funds: on their first deposit, and on the first
// deposit after the terms change. PlayStake's rating is "not protected – no
// segregation" (funds are held with company money), so LCCP 4.2.1 also needs a
// reminder at least every six months that states the funds held for the
// customer, acknowledged again before they can gamble. We go slightly further:
// the acknowledgement is required before every deposit while it's current, and
// the deposit page repeats the statement each time.
//
// Changing the level (e.g. to a segregated client account or a trust) means
// changing the wording and bumping FUNDS_PROTECTION_VERSION, so every
// customer acknowledges the new arrangement. Keep /terms#funds-protection and
// Policy 19 in step.
// =============================================================================

import { prisma } from "../db/client";
import { AppError } from "../errors";
import { TransactionStatus, TransactionType } from "../../../generated/prisma/client";

/** The four ratings LCCP 4.2.1 allows. */
export type FundsProtectionLevel =
  | "NOT_PROTECTED_NO_SEGREGATION"
  | "NOT_PROTECTED_SEGREGATION"
  | "MEDIUM"
  | "HIGH";

export const FUNDS_PROTECTION_LEVEL: FundsProtectionLevel = "NOT_PROTECTED_NO_SEGREGATION";
export const FUNDS_PROTECTION_LEVEL_LABEL = "not protected – no segregation";
export const FUNDS_PROTECTION_VERSION = "2026-10-27-not-protected";
/** "Not protected" ratings must be re-acknowledged at least every six months. */
export const FUNDS_PROTECTION_REMINDER_MS = 182 * 24 * 60 * 60 * 1000;
const REMINDER_REQUIRED = FUNDS_PROTECTION_LEVEL.startsWith("NOT_PROTECTED");

/** The Commission's wording for the "not protected" rating. */
export const FUNDS_PROTECTION_STATEMENT =
  "We do not keep customer funds separate from company funds. This means that in the event of insolvency customer funds will not be protected.";

export const FUNDS_PROTECTION_EXPLAINER =
  "The UK Gambling Commission requires us to tell you how your funds are protected if PlayStake becomes insolvent. PlayStake's rating is \"not protected – no segregation\": your balance is held with PlayStake's own money, so if PlayStake became insolvent you might not get it back.";

export class FundsProtectionRequiredError extends AppError {
  constructor() {
    super(
      "Before you deposit or play with deposited funds, please read and confirm how your funds are protected. You can do this on the Deposit page.",
      409,
      "FUNDS_PROTECTION_REQUIRED",
    );
    this.name = "FundsProtectionRequiredError";
  }
}

type AckFields = { fundsProtectionVersion: string | null; fundsProtectionAcknowledgedAt: Date | null };
const ACK_SELECT = { fundsProtectionVersion: true, fundsProtectionAcknowledgedAt: true } as const;

/**
 * Current = the present wording was acknowledged and, for a "not protected"
 * rating, within the last six months.
 */
export function hasAcknowledgedFundsProtection(user: AckFields, now: Date = new Date()): boolean {
  if (user.fundsProtectionVersion !== FUNDS_PROTECTION_VERSION || !user.fundsProtectionAcknowledgedAt) return false;
  return !REMINDER_REQUIRED || now.getTime() - user.fundsProtectionAcknowledgedAt.getTime() < FUNDS_PROTECTION_REMINDER_MS;
}

/** Why the customer is being asked: never asked, the terms changed, or the six-monthly reminder. */
export function fundsProtectionReason(user: AckFields, now: Date = new Date()): "first" | "changed" | "six_monthly" | null {
  if (hasAcknowledgedFundsProtection(user, now)) return null;
  if (!user.fundsProtectionAcknowledgedAt) return "first";
  return user.fundsProtectionVersion === FUNDS_PROTECTION_VERSION ? "six_monthly" : "changed";
}

export async function hasDeposited(userId: string): Promise<boolean> {
  const deposits = await prisma.transaction.count({
    where: {
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.COMPLETED,
      metadata: { path: ["userId"], equals: userId },
    },
  });
  return deposits > 0;
}

export async function acknowledgeFundsProtection(userId: string, now: Date = new Date()) {
  return prisma.user.update({
    where: { id: userId },
    data: { fundsProtectionVersion: FUNDS_PROTECTION_VERSION, fundsProtectionAcknowledgedAt: now },
    select: { fundsProtectionVersion: true, fundsProtectionAcknowledgedAt: true },
  });
}

/** Required before every deposit. */
export async function assertFundsProtectionAcknowledged(userId: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: ACK_SELECT });
  if (!hasAcknowledgedFundsProtection(user)) throw new FundsProtectionRequiredError();
}

/**
 * Required before a stake, for anyone who has deposited: they may not gamble
 * with deposited funds until they have acknowledged the current disclosure
 * (e.g. customers who deposited before it was introduced, after a change, or
 * when the six-monthly reminder is due).
 */
export async function assertFundsProtectionAcknowledgedIfDeposited(userId: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: ACK_SELECT });
  if (hasAcknowledgedFundsProtection(user)) return;
  if (await hasDeposited(userId)) throw new FundsProtectionRequiredError();
}
