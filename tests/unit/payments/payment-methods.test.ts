import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture what createPaymentIntent sends to Stripe.
const create = vi.fn(async (params: unknown) => ({ id: "pi_test", ...(params as object) }));
vi.mock("stripe", () => ({
  default: class {
    paymentIntents = { create };
  },
}));

import {
  APPROVED_PAYMENT_METHOD_TYPES,
  usesOnlyApprovedPaymentMethods,
} from "../../../src/lib/payments/policy";

describe("approved payment methods", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy";
    create.mockClear();
  });

  it("accepts only cards", () => {
    expect(APPROVED_PAYMENT_METHOD_TYPES).toEqual(["card"]);
    expect(usesOnlyApprovedPaymentMethods(["card"])).toBe(true);
  });

  it("rejects anything else, or nothing at all", () => {
    expect(usesOnlyApprovedPaymentMethods(["card", "klarna"])).toBe(false);
    expect(usesOnlyApprovedPaymentMethods(["crypto"])).toBe(false);
    expect(usesOnlyApprovedPaymentMethods([])).toBe(false);
  });

  it("deposits pin the payment methods instead of leaving them to the Stripe Dashboard", async () => {
    const { createPaymentIntent } = await import("../../../src/lib/payments/stripe");
    await createPaymentIntent(1000, "USD", "cus_1", {}, "idem_1");

    const params = create.mock.calls[0][0] as Record<string, unknown>;
    expect(params.payment_method_types).toEqual(["card"]);
    expect(params).not.toHaveProperty("automatic_payment_methods");
  });
});
