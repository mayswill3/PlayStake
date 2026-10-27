// =============================================================================
// PlayStake — Protection of customer funds (LCCP 4.2.1)
// =============================================================================
// Customers must be told in writing how well their deposited funds are
// protected if PlayStake became insolvent, and must acknowledge it before they
// can gamble with deposited funds: on their first deposit, and on the first
// deposit after the terms change. Both "not protected" ratings also need a
// reminder at least every six months that states the funds held for the
// customer, acknowledged again before they can gamble. A current
// acknowledgement is also required before every deposit.
//
// LCCP 4.1.1 requires a remote licensee to hold customer funds in a separate
// client bank account. Until that account is open and funded the honest rating
// is "not protected – no segregation"; once it is, set
// FUNDS_PROTECTION_LEVEL=NOT_PROTECTED_SEGREGATION. Each level has its own
// wording version, so switching asks every customer to acknowledge the new
// arrangement. The Terms (/terms#funds-protection) read the same wording from
// here. Medium and high protection need legal arrangements and wording first.
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

interface LevelWording {
  label: string;
  version: string;
  statement: string;
  explainer: string;
  /** How PlayStake holds the money, for the Terms. */
  howHeld: string;
}

const WORDING: Partial<Record<FundsProtectionLevel, LevelWording>> = {
  NOT_PROTECTED_NO_SEGREGATION: {
    label: "not protected – no segregation",
    version: "2026-10-27-not-protected",
    statement:
      "We do not keep customer funds separate from company funds. This means that in the event of insolvency customer funds will not be protected.",
    explainer:
      'The UK Gambling Commission requires us to tell you how your funds are protected if PlayStake becomes insolvent. PlayStake\'s rating is "not protected – no segregation": your balance is held with PlayStake\'s own money, so if PlayStake became insolvent you might not get it back.',
    howHeld:
      "your balance is held with PlayStake's own money, in PlayStake's accounts with our payment provider and bank",
  },
  NOT_PROTECTED_SEGREGATION: {
    label: "not protected – segregation of customer funds",
    version: "2026-10-27-segregated",
    statement:
      "We hold customer funds separate from company funds, in a designated customer-funds bank account. These funds are not protected in the event of insolvency.",
    explainer:
      'The UK Gambling Commission requires us to tell you how your funds are protected if PlayStake becomes insolvent. PlayStake\'s rating is "not protected – segregation of customer funds": we keep your balance in a bank account used only for customer money, not for running the business, but that account is not held on trust for you, so if PlayStake became insolvent you might not get your money back.',
    howHeld:
      "your balance is kept in a bank account used only for customer money, separate from the money PlayStake uses to run its business, and reconciled every day. The account is not held on trust for customers",
  },
};

function configuredLevel(): FundsProtectionLevel {
  const raw = process.env.FUNDS_PROTECTION_LEVEL;
  if (raw && raw in WORDING) return raw as FundsProtectionLevel;
  if (raw) console.error(`[funds-protection] FUNDS_PROTECTION_LEVEL=${raw} has no approved wording; using no segregation`);
  return "NOT_PROTECTED_NO_SEGREGATION";
}

export const FUNDS_PROTECTION_LEVEL: FundsProtectionLevel = configuredLevel();
const wording = WORDING[FUNDS_PROTECTION_LEVEL]!;
export const FUNDS_PROTECTION_LEVEL_LABEL = wording.label;
export const FUNDS_PROTECTION_VERSION = wording.version;
/** "Not protected" ratings must be re-acknowledged at least every six months. */
export const FUNDS_PROTECTION_REMINDER_MS = 182 * 24 * 60 * 60 * 1000;
const REMINDER_REQUIRED = FUNDS_PROTECTION_LEVEL.startsWith("NOT_PROTECTED");

export const FUNDS_PROTECTION_STATEMENT = wording.statement;
export const FUNDS_PROTECTION_EXPLAINER = wording.explainer;
export const FUNDS_PROTECTION_HOW_HELD = wording.howHeld;

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
