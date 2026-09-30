import { AppError } from '@/lib/errors';

export type PaymentMode = 'test' | 'disabled';

export function getPaymentMode(): PaymentMode {
  return process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')
    ? 'test'
    : 'disabled';
}

/**
 * PlayStake's current wager model is not approved for live Stripe processing.
 * Fail closed unless an explicit Stripe test key is in use.
 */
export function assertTestPaymentsEnabled() {
  if (getPaymentMode() !== 'test') {
    throw new AppError(
      'Payments are unavailable. PlayStake currently supports Stripe test mode only.',
      503,
      'PAYMENTS_DISABLED',
    );
  }
}

/**
 * The only payment method types PlayStake accepts.
 *
 * Every payment that involves a payment service must go through a payment
 * service provider authorised under the UK Payment Services Regulations 2017
 * (Gambling Commission requirement, in force 31 January 2024). Cards through
 * Stripe meet that; Apple Pay and Google Pay are cards and ride on the same
 * type. The list is fixed here, in code, so a method switched on in the
 * Stripe Dashboard (buy-now-pay-later, crypto, bank redirects) never reaches a
 * customer without review. Adding a type needs compliance sign-off and an
 * entry in the payment provider register (docs/compliance/16).
 */
export const APPROVED_PAYMENT_METHOD_TYPES = ['card'] as const;

export function usesOnlyApprovedPaymentMethods(types: readonly string[]): boolean {
  return (
    types.length > 0 &&
    types.every((type) =>
      (APPROVED_PAYMENT_METHOD_TYPES as readonly string[]).includes(type),
    )
  );
}

