import { NextRequest, NextResponse } from "next/server";
import { LedgerAccountType } from "../../../../../generated/prisma/client.js";
import { TransactionType } from "../../../../../generated/prisma/client.js";
import { validateSession } from "../../../../lib/auth/session.js";
import { getSessionToken } from "../../../../lib/auth/helpers.js";
import { withTransaction } from "../../../../lib/db/client.js";
import { getOrCreatePlayerAccount, getSystemAccount } from "../../../../lib/ledger/accounts.js";
import { transfer } from "../../../../lib/ledger/transfer.js";
import { withdrawSchema } from "../../../../lib/validation/schemas.js";
import { validateBody } from "../../../../lib/middleware/validate.js";
import { checkIdempotency } from "../../../../lib/middleware/idempotency.js";
import { centsToDollars, dollarsToCents } from "../../../../lib/utils/money.js";
import {
  errorResponse,
  AuthenticationError,
  AuthorizationError,
  AppError,
} from "../../../../lib/errors/index.js";

export async function POST(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    // Email must be verified for withdrawals
    if (!session.user.emailVerified) {
      throw new AuthorizationError(
        "Email must be verified before making withdrawals"
      );
    }

    const body = await request.json();
    const input = validateBody(withdrawSchema, body);

    // Check idempotency
    const idempotencyResult = await checkIdempotency(input.idempotencyKey, {
      amount: input.amount,
      type: "WITHDRAWAL",
    });

    if (idempotencyResult.exists && idempotencyResult.response) {
      return NextResponse.json({
        transactionId: idempotencyResult.response.transactionId,
        estimatedArrival: new Date(
          Date.now() + 3 * 24 * 60 * 60 * 1000
        ).toISOString(),
      });
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

    // TODO: Integrate Stripe Payout
    // In production:
    // 1. Create a Stripe Payout or Transfer to the user's connected account
    // 2. Store the payout ID in transaction.stripePaymentId
    // 3. If payout fails, create a reversal transaction to credit back

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
