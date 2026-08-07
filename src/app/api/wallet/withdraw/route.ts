import { NextRequest, NextResponse } from "next/server";
import { LedgerAccountType } from "../../../../../generated/prisma/client";
import { TransactionType } from "../../../../../generated/prisma/client";
import { validateSession } from "../../../../lib/auth/session";
import { getSessionToken } from "../../../../lib/auth/helpers";
import { prisma, withTransaction } from "../../../../lib/db/client";
import { getOrCreatePlayerAccount, getSystemAccount } from "../../../../lib/ledger/accounts";
import { transfer } from "../../../../lib/ledger/transfer";
import { withdrawSchema } from "../../../../lib/validation/schemas";
import { validateBody } from "../../../../lib/middleware/validate";
import { checkIdempotency } from "../../../../lib/middleware/idempotency";
import { centsToDollars, dollarsToCents } from "../../../../lib/utils/money";
import {
  errorResponse,
  AuthenticationError,
  AuthorizationError,
  AppError,
} from "../../../../lib/errors/index";
import {
  createConnectedAccountTransfer,
  syncConnectStatus,
} from "../../../../lib/payments/connect";
import { assertTestPaymentsEnabled } from "../../../../lib/payments/policy";

export async function POST(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    assertTestPaymentsEnabled();

    // Email must be verified for withdrawals
    if (!session.user.emailVerified) {
      throw new AuthorizationError(
        "Email must be verified before making withdrawals"
      );
    }

    const connectStatus = await syncConnectStatus(session.userId);
    if (
      !connectStatus.accountId ||
      !connectStatus.detailsSubmitted ||
      !connectStatus.payoutsEnabled
    ) {
      throw new AuthorizationError(
        "Complete Stripe test-mode withdrawal setup before withdrawing",
      );
    }

    const body = await request.json();
    const input = validateBody(withdrawSchema, body);

    // Check idempotency
    const idempotencyResult = await checkIdempotency(input.idempotencyKey, {
      amount: input.amount,
      type: "WITHDRAWAL",
      userId: session.userId,
    });

    if (idempotencyResult.exists && idempotencyResult.response) {
      const existing = await prisma.transaction.findUniqueOrThrow({
        where: { id: String(idempotencyResult.response.transactionId) },
        select: { stripePaymentId: true },
      });
      // If a process stopped after the ledger debit but before the external
      // transfer was recorded, continue below. Stripe's idempotency key makes
      // retrying the transfer safe.
      if (existing.stripePaymentId) {
        return NextResponse.json({
          transactionId: idempotencyResult.response.transactionId,
          estimatedArrival: new Date(
            Date.now() + 3 * 24 * 60 * 60 * 1000
          ).toISOString(),
        });
      }
    }

    const amountDollars = centsToDollars(input.amount);

    // Execute withdrawal via ledger transfer (debit player, credit STRIPE_SINK)
    const result = await withTransaction(async (tx) => {
      const playerAccount = await getOrCreatePlayerAccount(tx, session.userId);

      // Check balance
      const balanceCents = dollarsToCents(playerAccount.balance);
      if (balanceCents < input.amount) {
        throw new AppError(
          `Insufficient balance. Available: ${balanceCents} cents, requested: ${input.amount} cents`,
          400,
          "INSUFFICIENT_FUNDS"
        );
      }

      const stripeSink = await getSystemAccount(
        tx,
        LedgerAccountType.STRIPE_SINK
      );

      return transfer(tx, {
        fromAccountId: playerAccount.id,
        toAccountId: stripeSink.id,
        amount: amountDollars,
        transactionType: TransactionType.WITHDRAWAL,
        description: "Withdrawal to Stripe",
        idempotencyKey: input.idempotencyKey,
        metadata: {
          userId: session.userId,
          amountCents: input.amount,
        },
      });
    });

    // Transfer test funds to the user's verified connected account. Stripe then
    // controls the connected account's payout schedule and bank destination.
    try {
      const stripeTransfer = await createConnectedAccountTransfer({
        amount: input.amount,
        destination: connectStatus.accountId,
        userId: session.userId,
        transactionId: result.transaction.id,
        idempotencyKey: input.idempotencyKey,
      });

      await prisma.transaction.update({
        where: { id: result.transaction.id },
        data: {
          stripePaymentId: stripeTransfer.id,
          metadata: {
            userId: session.userId,
            amountCents: input.amount,
            stripeConnectAccountId: connectStatus.accountId,
            stripeTransferId: stripeTransfer.id,
            paymentMode: "test",
          },
        },
      });
    } catch (stripeError) {
      // Stripe payout failed -- reverse the ledger transaction
      console.error(
        `[Withdraw] Stripe Connect transfer failed for transaction ${result.transaction.id}:`,
        stripeError
      );

      await withTransaction(async (tx) => {
        const playerAccount = await getOrCreatePlayerAccount(
          tx,
          session.userId
        );
        const stripeSink = await getSystemAccount(
          tx,
          LedgerAccountType.STRIPE_SINK
        );

        // Reverse: credit player back, debit STRIPE_SINK
        await transfer(tx, {
          fromAccountId: stripeSink.id,
          toAccountId: playerAccount.id,
          amount: amountDollars,
          transactionType: TransactionType.ADJUSTMENT,
          description: "Withdrawal reversal: Stripe transfer creation failed",
          idempotencyKey: `reversal_${input.idempotencyKey}`,
          metadata: {
            userId: session.userId,
            originalTransactionId: result.transaction.id,
            reason:
              stripeError instanceof Error
                ? stripeError.message
                : "Unknown Stripe error",
          },
        });

        // Mark the original transaction as FAILED
        await tx.transaction.update({
          where: { id: result.transaction.id },
          data: {
            status: "FAILED",
            failureReason:
              stripeError instanceof Error
                ? stripeError.message
                : "Stripe transfer creation failed",
          },
        });
      });

      throw new AppError(
        "Withdrawal failed. Your balance has been restored. Please try again later.",
        502,
        "PAYOUT_FAILED"
      );
    }

    const estimatedArrival = new Date(
      Date.now() + 3 * 24 * 60 * 60 * 1000
    ).toISOString();

    return NextResponse.json({
      transactionId: result.transaction.id,
      estimatedArrival,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
