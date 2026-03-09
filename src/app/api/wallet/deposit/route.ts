import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/client.js";
import {
  TransactionType,
  TransactionStatus,
} from "../../../../../generated/prisma/client.js";
import { validateSession } from "../../../../lib/auth/session.js";
import { getSessionToken } from "../../../../lib/auth/helpers.js";
import { depositRateLimit } from "../../../../lib/middleware/rate-limit.js";
import { depositSchema } from "../../../../lib/validation/schemas.js";
import { validateBody } from "../../../../lib/middleware/validate.js";
import { checkIdempotency } from "../../../../lib/middleware/idempotency.js";
import { centsToDollars } from "../../../../lib/utils/money.js";
import { errorResponse, AuthenticationError } from "../../../../lib/errors/index.js";

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const rateLimited = depositRateLimit(request);
    if (rateLimited) return rateLimited;

    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    const body = await request.json();
    const input = validateBody(depositSchema, body);

    // Check idempotency
    const idempotencyResult = await checkIdempotency(input.idempotencyKey, {
      amount: input.amount,
      type: "DEPOSIT",
    });

    if (idempotencyResult.exists && idempotencyResult.response) {
      return NextResponse.json({
        transactionId: idempotencyResult.response.transactionId,
        stripeClientSecret: "pi_existing_deposit_secret", // Would come from stored metadata
      });
    }

    // Convert cents to dollars for database storage
    const amountDollars = centsToDollars(input.amount);

    // Create a PENDING deposit transaction
    // The actual balance credit happens when the Stripe webhook confirms payment_intent.succeeded
    const transaction = await prisma.transaction.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.PENDING,
        amount: amountDollars,
        currency: "USD",
        description: "Deposit via Stripe",
        metadata: {
          userId: session.userId,
          amountCents: input.amount,
        },
      },
    });

    // TODO: Integrate Stripe Payment Intent creation
    // In production:
    // 1. Create or retrieve Stripe customer for the user
    // 2. Create a PaymentIntent with the amount
    // 3. Store the paymentIntent.id as transaction.stripePaymentId
    // 4. Return the client_secret from the PaymentIntent
    //
    // const paymentIntent = await stripe.paymentIntents.create({
    //   amount: input.amount,
    //   currency: 'usd',
    //   customer: user.stripeCustomerId,
    //   metadata: { transactionId: transaction.id, userId: session.userId },
    //   idempotency_key: input.idempotencyKey,
    // });
    //
    // await prisma.transaction.update({
    //   where: { id: transaction.id },
    //   data: { stripePaymentId: paymentIntent.id },
    // });

    const mockClientSecret = `pi_mock_${transaction.id}_secret_${Date.now()}`;

    return NextResponse.json({
      transactionId: transaction.id,
      stripeClientSecret: mockClientSecret,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
