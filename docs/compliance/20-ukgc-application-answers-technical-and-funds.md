# Document 20 — UKGC Application: Technical Pack and Customer Funds (answers for the form)

| | |
|---|---|
| **Prepared for** | [COMPLIANCE LEAD NAME] (Charles), completing the Gambling Commission operating licence application |
| **Version** | 0.1 — 27 October 2026 |
| **Use** | One answer per checklist item, ready to adapt into the form, with the document to attach. Facts were checked against the live platform on 27 October 2026. |

> Two points on the checklist itself, checked against the Commission's website on 27 October 2026:
> 1. **ISO/IEC 27001 version.** The checklist says the RTS security requirements align to ISO/IEC 27001:**2013**. They now follow the **2022** standard: audits against the 2013 controls ended on 31 October 2024, and every security audit since 1 November 2024 must use the updated RTS controls aligned to 2022. Document 13 maps to 2022, which is correct.
> 2. **RTS page date.** The RTS page currently shows **last updated 31 October 2025** (RTS 12). The RTS 12 changes originally due on 30 June 2026 were postponed to **30 September 2026**; PlayStake meets them (Document 12 §3.1).
> 3. **"Separate client bank account" is ticked, and it must be.** LCCP 4.1.1 requires a remote licensee holding customer funds to keep them in a separate client bank account. PlayStake is opening a designated customer-funds account and will reconcile it daily (Policy 19 §2); its rating will then be "not protected – segregation of customer funds". Until the account is live the site truthfully says "no segregation"; one setting switches it.

## A. Diagrams

| Checklist item | Answer for the form | Attach |
|---|---|---|
| **Operational model map** — location, provider and operator of all systems and activities; key equipment | PlayStake builds and operates its own software. All remote gambling equipment — the web service, worker service, recorder service, PostgreSQL database and Redis — runs on Railway in its EU West region (`europe-west4`, Amsterdam, Netherlands), operated by PlayStake. No equipment is in Great Britain. Payments: Stripe. Identity checks: Didit (EU). Match recordings: Cloudflare R2 (EU). Email: Resend and Google Workspace. Monitoring: Sentry (EU, Germany). Every activity, from registration to regulatory reporting, is mapped with its provider and operator. | Document 10 (PDF) |
| **System diagram / outsourcing map** — payment services, age/identity, geolocation, marketing, customer service, fraud detection, hosting/storage | Diagram of all PlayStake systems and every external supplier, with a table per function: payment services (Stripe), age and identity (Didit; in-house upload as fallback), **geolocation (none today — a declared gap with an action)**, marketing (none; Google Analytics only on public pages with consent), customer service (in-house on Google Workspace), fraud detection (in-house anomaly, shared-identity and AML monitoring; Stripe Radar to configure), hosting and storage (Railway; Cloudflare R2 for recordings), ADR (IBAS, to sign), self-exclusion (GAMSTOP, to join). | Document 08 (PDF, includes the diagram) |
| **End-to-end flow** — registration → gambling → payout, with remote equipment locations | A ten-step flow from registration, email verification, Didit identity check, funds-protection disclosure and deposit-limit prompt, card deposit, finding a match, consent and escrow, refereed play with recording, dispute review, settlement and withdrawal, with the controls and the system and location at each step, the money-flow diagram, and an equipment-location table. | Document 09 (PDF) |

## B. Testing and independent assurance

| Checklist item | Answer for the form | Attach |
|---|---|---|
| **UK: testing strategy** (third-party test house or in-house declaration) | PlayStake runs no games and no random number generation (withdrawn 25 October 2026); results of EA SPORTS FC 27 and Tekken 8 matches are decided by independent human referees. There is therefore no game, game rule set or RNG for a test house to certify. Platform functions (customer information, safer-gambling tools, interrupted matches, collusion controls, ledger integrity, eligibility, customer-funds disclosure, dispute review, recordings) are tested in-house: 384 automated tests run on every change in CI against real PostgreSQL and Redis, plus manual checks per release. We propose an **in-house declaration** for these functions and ask the Commission to confirm (Document 11 §3.3). Any future game or random element would be certified by an approved test house before release. | Document 11 (PDF) |
| **UK: track RTS updates** | Monthly check of the Commission's RTS pages, news and consultations, logged even when nothing changes; each change entered in a register with effective date, impact, action, owner and target date; delivered through change control. Last check 27 October 2026: RTS page last updated 31 October 2025; RTS 12 phase 2 effective 30 September 2026 and met; RTS 14 update (12 January 2026) under review. | Document 12 (PDF) |
| **UAE: GCGRA technical standards (GLI series)** | Planning draft: GCGRA standards are reported to build on GLI-19 (interactive gaming systems) and GLI-33 (event wagering systems); a gap analysis and certification plan are set out. To be confirmed directly with the GCGRA and UAE counsel. | Document 15 (PDF) |
| **UAE: approved test labs** | GLI and BMM (BMM North America, BMM Spain) are reported as approved; lab engagement is step 5 of the plan (months 6–9). To confirm with the GCGRA. | Document 15 |

## C. Information security

| Checklist item | Answer for the form | Attach |
|---|---|---|
| **UK: RTS security requirements / ISO 27001 baseline** | Information security policy mapped control by control to ISO/IEC 27001:2022 Annex A as used by the RTS security requirements, with status (in place / partial / planned), residual risks and a dated action list (penetration test, annual independent security audit within 6 months of grant, backups, key rotation, nonce-based CSP). Key safeguards: double-entry ledger with append-only entries and daily audit; staff two-factor sign-in; encrypted identity documents and tokens; card data handled only by Stripe; signed webhooks; append-only admin and referee audit trails; recordings sealed by SHA-256. | Document 13 (PDF) |
| **UK: incident response and key-event reporting** | Written procedure: reporting routes and automatic triggers (ledger-audit failure, worker heartbeat, Sentry, anomaly and AML alerts, supplier notices), triage by severity, response steps, customer and ICO notification, and key-event reporting to the Commission through eServices within five working days (LCCP 15.2.1), with playbooks and an incident register. | Document 14 (PDF) |

## D. Payments and protection of customer funds

| Checklist item | Answer for the form | Attach |
|---|---|---|
| **Customer funds segregation** | PlayStake holds customer funds and keeps them in a separate customer-funds bank account at [BANK NAME], used only for customer money; Stripe pays out to it. Each customer's balance and each match's stakes are tracked in a double-entry ledger, audited daily; finance reconciles the total (shown on the admin overview and logged daily) against the account every working day and tops up any shortfall the same day. [Account to open before submission] | Policy 19 §2 |
| **Written disclosure of the insolvency protection level, acknowledged before gambling; extra reminders if "not protected"** | Rating: **not protected – segregation of customer funds** (from the day the account is live; until then the site shows "no segregation"). The statement is shown in writing before the first deposit; the customer must tick to acknowledge it, and deposits are refused until they do. Anyone who has deposited cannot stake until they have acknowledged the current wording.  Every six months a reminder states the funds held for the customer and must be acknowledged before they can stake again. Any change to the arrangement requires a fresh acknowledgement. Each acknowledgement is recorded with the wording version and time. | Policy 19 §3; screenshots in `evidence/`: `funds-1-before-first-deposit.png`, `funds-3-six-monthly-reminder.png` (captured 27 October 2026) |
| **Terms explain funds protection** | Terms §08 "Protection of customer funds" (`playstake.org/terms#funds-protection`) states the rating, explains the four ratings, how PlayStake holds funds (from the same setting as the site, so they always match), the acknowledgement and six-monthly reminder, and links to the Commission's guidance. | Terms (PDF or link) |
| **Payments only through PSR payment service providers** | PlayStake does not provide payment services. Deposits (card, including Apple Pay and Google Pay) and withdrawals (payout to the customer's own bank account) go only through Stripe Payments UK Ltd, an FCA-authorised electronic money institution [FRN 900461 — confirm on the FCA register]. No cash, crypto, vouchers, third-party payments or direct transfers. Stripe is in test mode; live processing needs Stripe's written approval for gambling first. | Policy 16 (PDF) |

## E. Still to complete before submission

1. Company name, addresses, named people and the remaining `[BRACKETS]` across the documents.
2. Railway database backup location and a tested restore (Document 13 §6 item 1).
3. Resend sending region (Resend dashboard → Domains).
4. Open the customer-funds account and complete the steps in Policy 19 §6 (bank, Stripe payouts, first transfer and reconciliation, switch the rating, notify the Commission).
5. Confirm the segregated-rating wording and how money held at Stripe is treated, with your advisor.
6. Geolocation: decide on an IP-location check (Document 08 §6).
7. Sign the DPIAs (Documents 17, 18), IBAS agreement and GAMSTOP membership.
