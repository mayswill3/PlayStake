# Policy 16 — Payment Services and Payment Methods

| | |
|---|---|
| **Operator** | [COMPANY NAME], trading as PlayStake |
| **Owner** | [COMPLIANCE LEAD NAME], Head of Compliance |
| **Version** | 0.1 — draft for licence application |
| **Review** | Annually; before adding any payment method or provider; on any change to a provider's authorisation |
| **Relates to** | Gambling Commission requirement (in force 31 January 2024) that payments involving payment services are accepted only through a payment service provider as defined in the Payment Services Regulations 2017 (PSRs) — LCCP paragraph to be confirmed; LCCP 15.2.1 key events (change of key supplier); Documents 08, 13 |

> Draft prepared from the platform as built on 30 September 2026. `[BRACKETS]` must be completed, and each provider's authorisation checked on the FCA Financial Services Register, before submission.

## 1. Requirement

Where a payment to or from a customer involves a payment service, PlayStake may only accept or make it through a payment service provider (PSP) as defined in the PSRs: for example a bank, an authorised payment institution or an authorised electronic money institution. PlayStake does not provide payment services itself and does not accept payments in any other way.

## 2. How customers can pay us and be paid

| Direction | Method | Provider | How it works |
|---|---|---|---|
| Deposit | Card (including Apple Pay and Google Pay, which are card payments) | Stripe | Card details are entered in Stripe's own payment form; Stripe processes the payment and tells PlayStake by signed webhook |
| Withdrawal | Payout to the customer's own bank account | Stripe (Connect Express) | The customer completes Stripe's onboarding once; PlayStake instructs Stripe to pay out |

PlayStake does **not** accept cash, cheques, vouchers, cryptocurrency, direct bank transfers into its own account, payments from third parties, or any method not listed above.

## 3. Payment service provider register

| Provider | Role | Authorisation | Status |
|---|---|---|---|
| Stripe Payments UK Ltd | Card acquiring and payouts for UK customers | FCA-authorised electronic money institution, FRN [900461 — confirm on the FCA register] | Integrated; running in **test mode** |
| Stripe Payments Europe Ltd | Card acquiring for EEA customers, if ever served | Authorised by the Central Bank of Ireland | Not used for UK customers |
| [ANY FUTURE PSP] | | | |

**Stripe and gambling.** Stripe treats gambling as a restricted business that needs its prior written approval. Live processing must not start until Stripe has approved PlayStake's model in writing. If it does not, a PSP that supports licensed gambling must be appointed through §5 before launch.

## 4. How the platform enforces this

| Control | Where |
|---|---|
| The payment methods PlayStake accepts are fixed in code (`card` only). Deposits send this list to Stripe, so a method switched on in the Stripe Dashboard — buy-now-pay-later, crypto, bank redirects — can never be offered to a customer without a code change and review. | `APPROVED_PAYMENT_METHOD_TYPES`, `src/lib/payments/policy.ts`; `createPaymentIntent`, `src/lib/payments/stripe.ts` |
| A second check when a deposit is confirmed: if a payment used anything other than an approved method, it is **not** credited, the transaction is marked failed, and staff are alerted to refund it. | `handlePaymentIntentSucceeded`, `src/app/api/webhooks/stripe/route.ts` |
| Money can only enter a customer balance from the `STRIPE_SOURCE` system account after a signature-verified Stripe webhook, and only leave to `STRIPE_SINK` through a Stripe payout. There is no staff tool, script or other route that credits or debits a balance from outside. | `src/lib/ledger/transfer.ts` and its callers |
| Live payments are refused unless explicitly enabled; today only a Stripe test key is accepted. | `assertTestPaymentsEnabled`, `src/lib/payments/policy.ts` |
| Automated tests check the approved list and that deposits pin it. | `tests/unit/payments/payment-methods.test.ts` |

Moving stakes between customers' balances inside PlayStake (into escrow and out to the winner) is done on PlayStake's own ledger and involves no external payment.

## 5. Adding a payment method or provider

Nothing is added until every step is complete and recorded:

1. Confirm on the FCA register that the provider is a PSP under the PSRs for the service it will provide, and record the firm reference number and date checked.
2. Get the provider's written approval for licensed gambling.
3. Confirm the method is not a credit product (gambling on credit cards and similar credit is prohibited in Great Britain).
4. Assess AML and fraud risk (Policy 07) and how the payer's name will be matched to the verified customer.
5. Sign the contract and data processing agreement.
6. Add the method to `APPROVED_PAYMENT_METHOD_TYPES` through a Standard change (Document 11 §5), with tests.
7. Update this register and the outsourcing map (Document 08).
8. Consider whether it is a key event to notify (Document 14).

## 6. Ongoing checks

- **Annually**, and whenever we hear of a change, re-check each provider on the FCA register and record the result here.
- **Quarterly**, check the Stripe Dashboard's payment method settings match §2 (the code overrides them, but a mismatch shows someone tried to change them).
- If a provider loses its authorisation, stop taking payments through it at once and treat it as a Severity 2 incident (Document 14).

## 7. Open points

| # | Point | Owner |
|---|---|---|
| 1 | Obtain Stripe's written approval for gambling, or appoint a gambling-approved PSP | Head of Compliance |
| 2 | Confirm the Stripe entity and FRN on the FCA register | Head of Compliance |
| 3 | **Block credit cards.** The approved method is "card", which includes credit cards. Before launch, refuse credit-funded cards (for example a Stripe Radar rule blocking `card_funding = credit`, with a server-side check on the payment method's funding type) | Head of Compliance / engineering |
| 4 | Switch currency from USD to GBP for UK customers | Engineering |
| 5 | Take legal advice confirming that moving stakes between customer balances on PlayStake's own ledger is not itself a regulated payment service | Head of Compliance |

| Version | Date | Change |
|---|---|---|
| 0.1 | 30 September 2026 | First draft |
