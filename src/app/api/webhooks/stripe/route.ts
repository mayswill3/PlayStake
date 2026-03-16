import { NextRequest, NextResponse } from "next/server";
import { Decimal } from "@prisma/client/runtime/client";
import {
  TransactionType,
  TransactionStatus,
  LedgerAccountType,
} from "../../../../../generated/prisma/client";
import { prisma, withTransaction } from "../../../../lib/db/client";
import { constructWebhookEvent } from "../../../../lib/payments/stripe";
import {
  getOrCreatePlayerAccount,
  getSystemAccount,
} from "../../../../lib/ledger/accounts";
import { transfer } from "../../../../lib/ledger/transfer";
import type Stripe from "stripe";

// ---------------------------------------------------------------------------
// Stripe Webhook Handler
// ---------------------------------------------------------------------------
// This endpoint MUST:
//   1. Read the raw body (not parsed JSON) for signature verification.
//   2. Be publicly accessible (no session auth) but protected by signature.
//   3. Always return 200 to Stripe to prevent unnecessary retries.
//      Processing errors are logged but not surfaced to Stripe.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let stripeEvent: Stripe.Event;

  // -----------------------------------------------------------------------
  // 1. Read raw body and verify Stripe signature
  // -----------------------------------------------------------------------
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    stripeEvent = constructWebhookEvent(body, signature);
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  // -----------------------------------------------------------------------
  // 2. Idempotency: check if this event has already been processed
  // -----------------------------------------------------------------------
  try {
    const existingEvent = await prisma.stripeEvent.findUnique({
      where: { stripeEventId: stripeEvent.id },
    });

    if (existingEvent) {
      // Already seen this event -- return 200 immediately
      return NextResponse.json({ received: true });
    }

    // Insert the event record with processed=false
    await prisma.stripeEvent.create({
      data: {
        stripeEventId: stripeEvent.id,
        eventType: stripeEvent.type,
        payload: stripeEvent.data as any,
        processed: false,
      },
    });
  } catch (err) {
    // Unique constraint violation means another request beat us -- that is fine
    if (
      err instanceof Error &&
      "code" in err &&
      (err as any).code === "P2002"
    ) {
      return NextResponse.json({ received: true });
    }
    console.error("[Stripe Webhook] Failed to record event:", err);
    return NextResponse.json({ received: true });
  }

  // -----------------------------------------------------------------------
  // 3. Process the event
  // -----------------------------------------------------------------------
  try {
    switch (stripeEvent.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(
          stripeEvent.data.object as Stripe.PaymentIntent
        );
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(
          stripeEvent.data.object as Stripe.PaymentIntent
        );
        break;

      case "payout.paid":
        await handlePayoutPaid(stripeEvent.data.object as Stripe.Payout);
        break;

      case "payout.failed":
        await handlePayoutFailed(stripeEvent.data.object as Stripe.Payout);
        break;

      default:
        // Unhandled event type -- log and move on
        console.log(
          `[Stripe Webhook] Unhandled event type: ${stripeEvent.type}`
        );
    }

    // Mark event as processed
    await prisma.stripeEvent.update({
      where: { stripeEventId: stripeEvent.id },
      data: { processed: true, processedAt: new Date() },
    });
  } catch (err) {
    // Log the error but still return 200 to Stripe so it does not retry
    console.error(
      `[Stripe Webhook] Error processing ${stripeEvent.type} (${stripeEvent.id}):`,
      err
    );
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

/**
 * payment_intent.succeeded
 *
 * Find the matching PENDING DEPOSIT Transaction by stripePaymentId.
 * Inside a DB transaction: mark COMPLETED, create ledger entries
 * (debit STRIPE_SOURCE, credit PLAYER_BALANCE), update balances.
 */
async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const transaction = await prisma.transaction.findFirst({
    where: {
      stripePaymentId: paymentIntent.id,
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.PENDING,
    },
  });

  if (!transaction) {
    console.warn(
      `[Stripe Webhook] No matching PENDING DEPOSIT for PaymentIntent ${paymentIntent.id}`
    );
    return;
  }

  const userId = (transaction.metadata as any)?.userId as string | undefined;
  if (!userId) {
    console.error(
      `[Stripe Webhook] Transaction ${transaction.id} has no userId in metadata`
    );
    return;
  }

  await withTransaction(async (tx) => {
    // Get accounts
    const playerAccount = await getOrCreatePlayerAccount(tx, userId);
    const stripeSource = await getSystemAccount(
      tx,
      LedgerAccountType.STRIPE_SOURCE
    );

    // Create the ledger transfer: STRIPE_SOURCE -> PLAYER_BALANCE
    const idempotencyKey = `deposit_credit_${transaction.id}`;
    await transfer(tx, {
      fromAccountId: stripeSource.id,
      toAccountId: playerAccount.id,
      amount: transaction.amount,
      transactionType: TransactionType.DEPOSIT,
      description: `Deposit credited from Stripe PaymentIntent ${paymentIntent.id}`,
      idempotencyKey,
      metadata: {
        stripePaymentIntentId: paymentIntent.id,
        originalTransactionId: transaction.id,
      },
    });

    // Mark the original PENDING transaction as COMPLETED
    await tx.transaction.update({
      where: { id: transaction.id },
      data: {
        status: TransactionStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  });

  console.log(
    `[Stripe Webhook] Deposit completed for Transaction ${transaction.id}`
  );
}

/**
 * payment_intent.payment_failed
 *
 * Mark the matching DEPOSIT Transaction as FAILED with the failure reason.
 */
async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const transaction = await prisma.transaction.findFirst({
    where: {
      stripePaymentId: paymentIntent.id,
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.PENDING,
    },
  });

  if (!transaction) {
    console.warn(
      `[Stripe Webhook] No matching PENDING DEPOSIT for failed PaymentIntent ${paymentIntent.id}`
    );
    return;
  }

  const failureMessage =
    paymentIntent.last_payment_error?.message || "Payment failed";

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      status: TransactionStatus.FAILED,
      failureReason: failureMessage,
    },
  });

  console.log(
    `[Stripe Webhook] Deposit FAILED for Transaction ${transaction.id}: ${failureMessage}`
  );
}

/**
 * payout.paid
 *
 * Mark the matching WITHDRAWAL Transaction as COMPLETED.
 */
async function handlePayoutPaid(payout: Stripe.Payout): Promise<void> {
  const transaction = await prisma.transaction.findFirst({
    where: {
      stripePaymentId: payout.id,
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.PENDING,
    },
  });

  if (!transaction) {
    console.warn(
      `[Stripe Webhook] No matching PENDING WITHDRAWAL for Payout ${payout.id}`
    );
    return;
  }

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      status: TransactionStatus.COMPLETED,
      completedAt: new Date(),
    },
  });

  console.log(
    `[Stripe Webhook] Withdrawal completed for Transaction ${transaction.id}`
  );
}

/**
 * payout.failed
 *
 * Mark the WITHDRAWAL Transaction as FAILED and create a reversal
 * ledger transfer (debit STRIPE_SINK, credit PLAYER_BALANCE) to
 * give the player their money back.
 */
async function handlePayoutFailed(payout: Stripe.Payout): Promise<void> {
  const transaction = await prisma.transaction.findFirst({
    where: {
      stripePaymentId: payout.id,
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.PENDING,
    },
  });

  if (!transaction) {
    console.warn(
      `[Stripe Webhook] No matching PENDING WITHDRAWAL for failed Payout ${payout.id}`
    );
    return;
  }

  const userId = (transaction.metadata as any)?.userId as string | undefined;
  if (!userId) {
    console.error(
      `[Stripe Webhook] Transaction ${transaction.id} has no userId in metadata`
    );
    return;
  }

  const failureMessage =
    payout.failure_message || "Payout failed";

  await withTransaction(async (tx) => {
    // Mark the original withdrawal as FAILED
    await tx.transaction.update({
      where: { id: transaction.id },
      data: {
        status: TransactionStatus.FAILED,
        failureReason: failureMessage,
      },
    });

    // Reversal: credit the player's balance back
    const playerAccount = await getOrCreatePlayerAccount(tx, userId);
    const stripeSink = await getSystemAccount(
      tx,
      LedgerAccountType.STRIPE_SINK
    );

    await transfer(tx, {
      fromAccountId: stripeSink.id,
      toAccountId: playerAccount.id,
      amount: transaction.amount,
      transactionType: TransactionType.ADJUSTMENT,
      description: `Withdrawal reversal: Payout ${payout.id} failed`,
      idempotencyKey: `withdrawal_reversal_${transaction.id}`,
      metadata: {
        stripePayoutId: payout.id,
        originalTransactionId: transaction.id,
        reason: failureMessage,
      },
    });
  });

  console.log(
    `[Stripe Webhook] Withdrawal FAILED and reversed for Transaction ${transaction.id}: ${failureMessage}`
  );
}
