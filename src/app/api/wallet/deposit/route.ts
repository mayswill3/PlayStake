import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/client";
import {
  TransactionType,
  TransactionStatus,
} from "../../../../../generated/prisma/client";
import { validateSession } from "../../../../lib/auth/session";
import { getSessionToken } from "../../../../lib/auth/helpers";
import { depositRateLimit } from "../../../../lib/middleware/rate-limit";
import { depositSchema } from "../../../../lib/validation/schemas";
import { validateBody } from "../../../../lib/middleware/validate";
import { centsToDollars, dollarsToCents } from "../../../../lib/utils/money";
import {
  errorResponse,
  AuthenticationError,
  ConflictError,
} from "../../../../lib/errors/index";
import {
  createPaymentIntent,
  getOrCreateCustomer,
} from "../../../../lib/payments/stripe";
import { assertTestPaymentsEnabled } from "../../../../lib/payments/policy";
import { assertKycVerified } from "../../../../lib/kyc/policy";

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const rateLimited = depositRateLimit(request);
    if (rateLimited) return rateLimited;

    const token = getSessionToken(request);
    if (!token) throw new AuthenticationError();

    const session = await validateSession(token);
    if (!session) throw new AuthenticationError("Invalid or expired session");

    // Fail closed: this integration is intentionally restricted to Stripe test mode.
    assertTestPaymentsEnabled();

    // No money enters the platform for an unverified identity.
    assertKycVerified(session.user);

    const body = await request.json();
    const input = validateBody(depositSchema, body);

    // Convert cents to dollars for database storage
    const amountDollars = centsToDollars(input.amount);

    // A retry can safely resume after a process interruption. Stripe receives
    // the same idempotency key, so it returns the original PaymentIntent.
    const existingTx = await prisma.transaction.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existingTx) {
      const existingMetadata = existingTx.metadata as Record<string, unknown> | null;
      if (
        existingTx.type !== TransactionType.DEPOSIT ||
        dollarsToCents(existingTx.amount) !== input.amount ||
        existingMetadata?.userId !== session.userId
      ) {
        throw new ConflictError(
          "Idempotency key already used with different parameters",
        );
      }
      if (
        existingTx.status === TransactionStatus.FAILED ||
        existingTx.status === TransactionStatus.REVERSED
      ) {
        throw new ConflictError(
          `Transaction has status ${existingTx.status}. Use a new idempotency key.`,
        );
      }
      const storedClientSecret =
        existingMetadata?.stripeClientSecret;
      if (typeof storedClientSecret === "string") {
        return NextResponse.json({
          transactionId: existingTx.id,
          stripeClientSecret: storedClientSecret,
        });
      }
    }

    // Get or create a Stripe customer for this user
    const stripeCustomerId = await getOrCreateCustomer(
      session.userId,
      session.user.email,
      session.user.displayName
    );

    // Create a PENDING deposit transaction first (before Stripe call)
    const transaction =
      existingTx ??
      (await prisma.transaction.create({
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
      }));

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
