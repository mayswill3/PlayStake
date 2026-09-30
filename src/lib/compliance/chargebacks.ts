// =============================================================================
// PlayStake — Chargebacks
// =============================================================================
// A customer disputing a deposit with their card issuer is both a fraud and a
// money-laundering signal (deposit, play or withdraw, then claw the deposit
// back). The account is suspended — no staking or withdrawing — and an AML
// case goes to the MLRO. Called from the Stripe webhook.
// =============================================================================

import { AccountStatus, AmlCaseType, TransactionType } from "../../../generated/prisma/client";
import { prisma } from "../db/client";
import { raiseAmlCase } from "./aml";

export interface ChargebackInput {
  disputeId: string;
  paymentIntentId: string;
  amountCents: number;
  reason: string;
}

/** Returns the affected user id, or null if the payment matches no deposit. */
export async function recordChargeback(input: ChargebackInput): Promise<string | null> {
  const deposit = await prisma.transaction.findFirst({
    where: { stripePaymentId: input.paymentIntentId, type: TransactionType.DEPOSIT },
    select: { id: true, metadata: true },
  });
  const userId = (deposit?.metadata as { userId?: unknown } | null)?.userId;
  if (!deposit || typeof userId !== "string") return null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      accountStatus: AccountStatus.SUSPENDED,
      accountStatusReason: `Chargeback ${input.disputeId} on a deposit (${input.reason}). Suspended pending review.`,
      accountStatusChangedAt: new Date(),
    },
  });
  await raiseAmlCase({
    userId,
    type: AmlCaseType.CHARGEBACK,
    severity: "high",
    details: {
      stripeDisputeId: input.disputeId,
      paymentIntentId: input.paymentIntentId,
      transactionId: deposit.id,
      disputedAmountCents: input.amountCents,
      reason: input.reason,
    },
  });
  return userId;
}
