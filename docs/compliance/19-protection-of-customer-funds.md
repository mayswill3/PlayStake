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

PlayStake holds customer funds: money customers deposit by card, their winnings and refunds, and stakes held for matches in progress ("customer funds" in LCCP 4.1.1 includes cleared deposits, winnings left on deposit and unpaid bonuses). Each customer's balance is a ledger account in PlayStake's double-entry ledger (Document 09 §4); stakes move into a per-match ledger account when both players consent and leave it at settlement or refund. That is an internal record, not a separate bank account or a trust.

## 2. Segregation (LCCP 4.1.1) and our rating

LCCP 4.1.1 applies to PlayStake's remote licence: **customer funds must be held in a separate client bank account or accounts.** PlayStake therefore operates a designated customer-funds account:

| Item | Arrangement |
|---|---|
| Customer-funds account | **[BANK NAME]**, account name **"[COMPANY NAME] — Customer Funds Account"**, used only for customer money. [OPEN before launch] |
| Company account | **[BANK NAME]**, for PlayStake's own money: fees earned at settlement, costs, capital. |
| Money held with Stripe | Card deposits arrive in PlayStake's Stripe balance and withdrawals are paid from it. Stripe pays out to the **customer-funds account**. [CONFIRM with advisor how money in transit at Stripe is treated] |
| Daily reconciliation | Each working day finance compares the customer-funds figure (admin overview: *Customer funds held* = all player balances + all stakes held in matches; also logged daily by the ledger audit) with the customer-funds account plus the customer share of the Stripe balance. A shortfall is topped up from the company account the same day; a surplus (fees PlayStake has earned) is moved to the company account. Differences are investigated and recorded. |
| Records | Reconciliations kept for 6 years. |

**Rating.** With customer funds segregated but not held on trust, the rating is **"not protected – segregation of customer funds"**. Until the account above is open and funded, the platform states the true position, **"not protected – no segregation"**; the rating is switched with one setting (`FUNDS_PROTECTION_LEVEL=NOT_PROTECTED_SEGREGATION`) on the day segregation starts, which updates the deposit page, the reminder and the Terms, and asks every customer to acknowledge the new wording.

| Rating (LCCP 4.2.1) | Meaning | PlayStake |
|---|---|---|
| Not protected – no segregation | Customer funds held with company funds | Today, until the customer-funds account is live. **Not permitted for a remote licensee holding customer funds**, so this must change before launch |
| Not protected – segregation of customer funds | Customer funds in separate accounts; customers have no legal claim to them on insolvency | **Target at launch** |
| Medium protection | Separate accounts with legal arrangements giving customers priority, without independent audit | Possible later (§6) |
| High protection | Trust or similar, independently audited | Possible later (§6) |

## 3. What customers are told, and when

| When | What happens | Where in the platform |
|---|---|---|
| Always | The Terms state the rating, what it means, and how funds are held (Terms §08 "Protection of customer funds", `/terms#funds-protection`) | `src/app/terms/page.tsx` |
| Before the first deposit | The deposit page shows, in writing, the statement for the current rating — today *"We do not keep customer funds separate from company funds. This means that in the event of insolvency customer funds will not be protected."*; after segregation *"We hold customer funds separate from company funds, in a designated customer-funds bank account. These funds are not protected in the event of insolvency."* [CONFIRM wording with advisor] — and an explanation. The customer must tick to confirm they have read and understood it. Deposits are refused until they do. | `/wallet/deposit`; `POST /api/wallet/funds-protection`; deposit API refuses with `FUNDS_PROTECTION_REQUIRED` |
| Before gambling with deposited funds | Any customer who has deposited and has not acknowledged the current wording (for example, deposited before this was introduced, or after a change) can't stake until they acknowledge it. | `assertCanWager` → `assertFundsProtectionAcknowledgedIfDeposited` |
| Every deposit | The statement is repeated next to the deposit button. | `/wallet/deposit` |
| At least every six months | Because the rating is "not protected", the acknowledgement expires after six months. A reminder appears in the dashboard stating **the funds PlayStake holds for the customer** and the rating; the customer must acknowledge it before they can stake again. They can withdraw at any time. | `FundsProtectionReminder` in the dashboard; acknowledgement older than 182 days is treated as not given |
| After a change to the arrangement | Each rating has its own wording version; switching `FUNDS_PROTECTION_LEVEL` (or changing the wording) means every customer must acknowledge the new wording before their next deposit or stake. | `src/lib/compliance/funds-protection.ts` |

Each acknowledgement is recorded on the customer's account with the version of the wording and the time.

## 4. Controls on the funds themselves

- **Ledger.** Every movement is a balanced double-entry transfer; balances can't go below zero; entries are append-only (database trigger). The ledger audit runs daily and checks every account and transaction (Document 13).
- **Reconciliation.** Daily, as set out in §2.
- **Withdrawals.** Customers can withdraw their balance at any time, including while on a break or self-excluded (Policies 03, 04), subject to identity and AML checks (Policy 07).
- **No lending or use of customer funds** for company expenses beyond the fee PlayStake earns at settlement. [CONFIRM with finance and advisor]

## 5. Reporting

- The Commission is told of PlayStake's rating in the application and in quarterly regulatory returns. **Any change to the customer-funds arrangements is an "other reportable event"** and is notified (Document 14).
- A change to how customer funds are held is assessed under the change process before it happens, the Terms and this policy are updated, the wording version is bumped, and customers re-acknowledge it.
- Any material financial difficulty that could affect customer funds is a key event (Document 14 §6).

## 6. Steps to segregation, and higher ratings

1. Open the customer-funds account with [BANK NAME], named as above; ask the bank to acknowledge in writing that it holds customer money and has no right of set-off against company debts [CONFIRM with advisor whether to seek this].
2. Point Stripe payouts at the customer-funds account.
3. Transfer the current *Customer funds held* figure into it and record the first reconciliation.
4. Set `FUNDS_PROTECTION_LEVEL=NOT_PROTECTED_SEGREGATION` on the web and worker services; customers acknowledge the new wording.
5. Notify the Commission (other reportable event) and update the application.

Medium or high protection would need a trust or similar legal arrangement (and for high, independent audit), new wording, and the same switch. [DECIDE with advisor]

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 27 October 2026 | First draft; disclosure, acknowledgement and six-monthly reminder built |
| 0.2 | 27 October 2026 | LCCP 4.1.1 segregation required for a remote licensee: customer-funds account, daily reconciliation against the *Customer funds held* figure, switch to "not protected – segregation of customer funds" |
