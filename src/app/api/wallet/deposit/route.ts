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
import {
  createPaymentIntent,
  getOrCreateCustomer,
} from "../../../../lib/payments/stripe.js";

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
      // Retrieve the existing transaction to return the stored client secret
      const existingTx = await prisma.transaction.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      const storedClientSecret =
        (existingTx?.metadata as any)?.stripeClientSecret || null;

      return NextResponse.json({
        transactionId: idempotencyResult.response.transactionId,
        stripeClientSecret: storedClientSecret,
      });
    }

    // Convert cents to dollars for database storage
    const amountDollars = centsToDollars(input.amount);

    // Get or create a Stripe customer for this user
    const stripeCustomerId = await getOrCreateCustomer(
      session.userId,
      session.user.email,
      session.user.displayName
    );

    // Create a PENDING deposit transaction first (before Stripe call)
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

    // Create a Stripe PaymentIntent
    const paymentIntent = await createPaymentIntent(
      input.amount, // Stripe uses cents
      "usd",
      stripeCustomerId,
      {
        transactionId: transaction.id,
        userId: session.userId,
        idempotencyKey: input.idempotencyKey,
      },
      input.idempotencyKey
    );

    // Update the transaction with the Stripe PaymentIntent ID and client secret
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        stripePaymentId: paymentIntent.id,
        metadata: {
          userId: session.userId,
          amountCents: input.amount,
          stripeClientSecret: paymentIntent.client_secret,
        },
      },
    });

    return NextResponse.json({
      transactionId: transaction.id,
      stripeClientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
