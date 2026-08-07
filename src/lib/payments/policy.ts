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
