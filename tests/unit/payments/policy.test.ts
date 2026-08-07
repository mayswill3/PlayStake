import { afterEach, describe, expect, it } from 'vitest';
import {
  assertTestPaymentsEnabled,
  getPaymentMode,
} from '@/lib/payments/policy';

describe('payment policy', () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  });

  it('permits Stripe test mode', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_example';
    expect(getPaymentMode()).toBe('test');
    expect(() => assertTestPaymentsEnabled()).not.toThrow();
  });

  it('fails closed for a live Stripe key', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_example';
    expect(getPaymentMode()).toBe('disabled');
    expect(() => assertTestPaymentsEnabled()).toThrow(/test mode only/i);
  });

  it('fails closed when Stripe is not configured', () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(getPaymentMode()).toBe('disabled');
    expect(() => assertTestPaymentsEnabled()).toThrow();
  });
});
