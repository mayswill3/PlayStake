# Policy 19 — Protection of Customer Funds

| | |
|---|---|
| **Operator** | [COMPANY NAME], trading as PlayStake |
| **Owner** | [COMPLIANCE LEAD NAME], Head of Compliance; [FINANCE LEAD] |
| **Version** | 0.1 — draft for licence application |
| **Review** | Annually; before any change to how customer funds are held; whenever a new bank, payment provider or trust arrangement is introduced |
| **Relates to** | LCCP licence condition 4.1.1 (segregation of customer funds) and 4.2.1 (disclosure to customers); Gambling Commission guidance *Customer funds: segregation, disclosure to customers and reporting requirements*; Terms §08 "Protection of customer funds"; Policies 07, 16; Documents 09, 12 |

> Draft prepared on 27 October 2026 from the platform as built. `[BRACKETS]` must be completed, ideally with advice, before submission.

## 1. What PlayStake holds

PlayStake holds customer funds: money customers deposit by card, their winnings and refunds, and stakes held for matches in progress. Each customer's balance is a ledger account in PlayStake's double-entry ledger (Document 09 §4). Stakes move into a per-match escrow ledger account when both players consent and leave it at settlement or refund; escrow is an internal ledger record, not a separate bank account or a trust.

The money itself is held in PlayStake's account with its payment provider (Stripe, Policy 16) and in PlayStake's business bank account [BANK NAME], together with the company's own money.

## 2. Our rating

PlayStake's rating under LCCP 4.2.1 is **"not protected – no segregation"**.

| Rating (LCCP 4.2.1) | Meaning | PlayStake |
|---|---|---|
| Not protected – no segregation | Customer funds are held with company funds | **Yes, today** |
| Not protected – segregation of customer funds | Customer funds are in separate accounts, but customers have no legal claim to them on insolvency | Possible next step (§6) |
| Medium protection | Separate accounts with legal arrangements that give customers priority, without independent audit | — |
| High protection | Trust or similar arrangement, independently audited, giving customers ownership of their funds on insolvency | — |

## 3. What customers are told, and when

| When | What happens | Where in the platform |
|---|---|---|
| Always | The Terms state the rating, what it means, and how funds are held (Terms §08 "Protection of customer funds", `/terms#funds-protection`) | `src/app/terms/page.tsx` |
| Before the first deposit | The deposit page shows, in writing, the Commission's wording for the rating — *"We do not keep customer funds separate from company funds. This means that in the event of insolvency customer funds will not be protected."* — and an explanation. The customer must tick to confirm they have read and understood it. Deposits are refused until they do. | `/wallet/deposit`; `POST /api/wallet/funds-protection`; deposit API refuses with `FUNDS_PROTECTION_REQUIRED` |
| Before gambling with deposited funds | Any customer who has deposited and has not acknowledged the current wording (for example, deposited before this was introduced, or after a change) can't stake until they acknowledge it. | `assertCanWager` → `assertFundsProtectionAcknowledgedIfDeposited` |
| Every deposit | The statement is repeated next to the deposit button. | `/wallet/deposit` |
| At least every six months | Because the rating is "not protected", the acknowledgement expires after six months. A reminder appears in the dashboard stating **the funds PlayStake holds for the customer** and the rating; the customer must acknowledge it before they can stake again. They can withdraw at any time. | `FundsProtectionReminder` in the dashboard; acknowledgement older than 182 days is treated as not given |
| After a change to the arrangement | Changing the rating or wording bumps `FUNDS_PROTECTION_VERSION`; every customer must acknowledge the new wording before their next deposit or stake. | `src/lib/compliance/funds-protection.ts` |

Each acknowledgement is recorded on the customer's account with the version of the wording and the time.

## 4. Controls on the funds themselves

- **Ledger.** Every movement is a balanced double-entry transfer; balances can't go below zero; entries are append-only (database trigger). The ledger audit runs daily and checks every account and transaction (Document 13).
- **Reconciliation.** [FINANCE LEAD] reconciles the total of customer balances and escrow in the ledger against the money held with Stripe and [BANK NAME] **[DAILY / WEEKLY]**, and investigates any difference. Records are kept for 6 years. [CONFIRM frequency]
- **Withdrawals.** Customers can withdraw their balance at any time, including while on a break or self-excluded (Policies 03, 04), subject to identity and AML checks (Policy 07).
- **No lending or use of customer funds** for company expenses beyond the fee PlayStake earns at settlement. [CONFIRM with finance and advisor]

## 5. Reporting

- The Commission is told of PlayStake's rating in the application and in regulatory returns, and of any change to it.
- A change to how customer funds are held is assessed under the change process before it happens, the Terms and this policy are updated, the wording version is bumped, and customers re-acknowledge it.
- Any material financial difficulty that could affect customer funds is a key event (Document 14 §6).

## 6. Moving to a higher rating

To move to "not protected – segregation of customer funds" or higher, PlayStake would open a designated customer-funds bank account, sweep customer balances into it daily, and (for medium or high) put legal and audit arrangements in place, then update the Terms, this policy, `FUNDS_PROTECTION_LEVEL` and the wording version. [DECIDE with advisor whether to do this before launch]

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 27 October 2026 | First draft; disclosure, acknowledgement and six-monthly reminder built |
