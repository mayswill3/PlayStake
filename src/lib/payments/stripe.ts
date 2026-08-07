import Stripe from "stripe";
import { prisma } from "../db/client";

// ---------------------------------------------------------------------------
// Singleton Stripe instance
// ---------------------------------------------------------------------------

let _stripe: Stripe | undefined;

function getStripe(): Stripe {
  if (!_stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    _stripe = new Stripe(secretKey, {
      apiVersion: "2026-02-25.clover",
      typescript: true,
    });
  }
  return _stripe;
}

export const stripe = getStripe();

// ---------------------------------------------------------------------------
// Payment Intent (deposits)
// ---------------------------------------------------------------------------

/**
 * Create a Stripe PaymentIntent for a deposit.
 *
 * @param amount       Amount in cents (smallest currency unit).
 * @param currency     Three-letter ISO currency code (e.g. "usd").
 * @param customerId   Stripe Customer ID.
 * @param metadata     Arbitrary key-value metadata attached to the PI.
 * @param idempotencyKey  Stripe idempotency key to prevent double charges.
 */
export async function createPaymentIntent(
  amount: number,
  currency: string,
  customerId: string,
  metadata: Record<string, string>,
  idempotencyKey: string
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create(
    {
      amount,
      currency: currency.toLowerCase(),
      customer: customerId,
      metadata,
      automatic_payment_methods: { enabled: true },
    },
    { idempotencyKey }
  );
}

// ---------------------------------------------------------------------------
// Customer management
// ---------------------------------------------------------------------------

/**
 * Create a new Stripe Customer.
 */
export async function createCustomer(
  email: string,
  name: string
): Promise<Stripe.Customer> {
  return stripe.customers.create({ email, name });
}

/**
 * Get or create a Stripe Customer for a PlayStake user.
 *
 * If the user already has a `stripeCustomerId` stored in the database,
 * returns it directly. Otherwise creates a new Stripe Customer, persists
 * the ID, and returns it.
 */
export async function getOrCreateCustomer(
  userId: string,
  email: string,
  name: string
): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await createCustomer(email, name);

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Verify and construct a Stripe webhook event from the raw request body
 * and the `stripe-signature` header value.
 *
 * @param body       Raw request body as a string (NOT parsed JSON).
 * @param signature  Value of the `stripe-signature` header.
 * @returns Verified Stripe Event.
 * @throws Stripe.errors.StripeSignatureVerificationError on invalid signature.
 */
export function constructWebhookEvent(
  body: string,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET environment variable is not set");
  }
  return stripe.webhooks.constructEvent(body, signature, webhookSecret);
}
