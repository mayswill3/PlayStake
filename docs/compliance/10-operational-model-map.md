# Document 10 — Operational Model Map

| | |
|---|---|
| **Operator** | [COMPANY NAME], trading as PlayStake |
| **Owner** | [COMPLIANCE LEAD NAME], Head of Compliance |
| **Version** | 0.1 — draft for licence application |
| **Review** | On any change of supplier, location, staff role or activity; at least annually |
| **Relates to** | Remote operating licence application: operational model (location, provider and operator of all systems and activities, including key equipment); Documents 08, 09 |

> Draft prepared from the platform as built on 30 September 2026. `[BRACKETS]` must be completed before submission.

## 1. Purpose

For every system and every business activity, this map states where it happens, who provides it and who operates it. "Provider" is whoever supplies the system or service. "Operator" is whoever runs it and makes the decisions. Document 08 has the system diagram and the full outsourcing detail.

## 2. Operating model in one paragraph

PlayStake is operated by [COMPANY NAME] from [OPERATING ADDRESS]. The company builds and runs its own gambling software. The software runs on cloud infrastructure rented from Railway in its EU West region (`europe-west4`, Amsterdam, Netherlands); PlayStake staff deploy and administer it. Payments are processed by Stripe. All customer-facing decisions — verification, limits, interactions, complaints, disputes, suspensions, AML — are made by PlayStake staff through the PlayStake admin console. At launch one person, [COMPLIANCE LEAD NAME], holds the compliance, MLRO and operations roles (Master Manual §3).

## 3. Key equipment

| Equipment | Purpose | Provider | Operator | Location |
|---|---|---|---|---|
| Web service (Next.js, Node 20) | Website, customer and staff interfaces, API, referee console, payment webhooks. No game logic or random number generation (on-site games withdrawn 25 October 2026) | Railway (infrastructure); PlayStake (software) | PlayStake | EU West, `europe-west4` (Netherlands) |
| Worker service (BullMQ) | Settlement, expiry and no-show handling, dispute escalation, harm and anomaly detection, AML scans, ledger audit, email and webhook delivery, session cleanup | Railway; PlayStake | PlayStake | EU West, `europe-west4` (Netherlands) |
| PostgreSQL 16 | System of record: accounts, ledger, bets, referee audit trail, encrypted identity documents, compliance and audit records; historical game records of the withdrawn on-site games (append-only, no new rows) | Railway | PlayStake | EU West, `europe-west4` (Netherlands) |
| Database backups | Recovery of the system of record | Railway | PlayStake | [BACKUP LOCATION] — confirm backups are enabled and tested (Document 13) |
| Redis 7 | Job queues, real-time lobby events, worker heartbeat | Railway | PlayStake | EU West, `europe-west4` (Netherlands) |
| Recorder service (Chrome, ffmpeg) | Records every refereed match: both players' and the referee's streams with sound and match clock, sealed into the audit trail | Railway; PlayStake | PlayStake | EU West, `europe-west4` (Netherlands) |
| Match-recording storage | Private store of sealed recordings, deleted on schedule | Cloudflare (R2) | PlayStake | EU jurisdiction |
| Domain and DNS (playstake.org) | Customer access | Namecheap | PlayStake | Global DNS |
| Source code repository and CI | Change control, automated tests, dependency audit, malware scan | GitHub | PlayStake | GitHub (US) |
| Staff devices | Administration | [COMPANY / STAFF] | PlayStake staff | [STAFF LOCATIONS] |

## 4. Activities

| Activity | Where it is done | Provider | Operator | Notes |
|---|---|---|---|---|
| Customer registration | Web service | PlayStake | PlayStake | Optional Google sign-in (Google) |
| Age and identity verification | Didit hosted check; web service; admin console | Didit (electronic checks); PlayStake | PlayStake (decisions); staff review borderline cases and the upload fallback | Didit in the EU (Spain); DPIA Document 17 |
| GAMSTOP checks | Web service → GAMSTOP | GAMSTOP | PlayStake | Planned |
| Sanctions and PEP screening | Admin console (manual); planned supplier | [SCREENING PROVIDER] | PlayStake (MLRO) | Manual check against OFSI list until contracted |
| Deposits | Stripe (card capture); web service (ledger) | Stripe | PlayStake | Stripe in test mode until launch |
| Withdrawals | Web service (ledger); Stripe Connect (payout) | Stripe | PlayStake | |
| Challenges and match management | Web service, Redis | PlayStake | PlayStake | |
| Game play | Players' own consoles or PCs; third-party games (EA SPORTS FC 27, Tekken 8) | Game publishers | Players | PlayStake runs no games and no random number generation since 25 October 2026 |
| Stream-match refereeing | Referee console; Kick video | PlayStake (software); Kick (video) | Independent referees engaged by PlayStake | Referees vetted and audited (Policy 01) |
| Match recording | Recorder service; Cloudflare R2 | PlayStake; Cloudflare | PlayStake | Every refereed match; DPIA Document 18 |
| Result verification and disputes | Web service, worker; admin console; reviewer pages | PlayStake | Admins, or referees approved as independent dispute reviewers | Reviewer can't be a player, the match referee, or linked to a player by a follow or block |
| Customer funds protection disclosure | Web service | PlayStake | PlayStake | Customer funds in a separate customer-funds account, reconciled daily; rating "not protected – segregation of customer funds" once the account is live ("no segregation" until then); acknowledged before deposit and six-monthly (Policy 19) |
| Settlement and payouts to balances | Worker service / web service | PlayStake | PlayStake | |
| Safer gambling: limits, breaks, reminders, interactions | Web service, worker; admin console | PlayStake | PlayStake staff | Policies 03–05 |
| AML monitoring and case management | Worker; admin console | PlayStake | MLRO | Policy 07 |
| Fraud and anomaly detection | Worker; admin console | PlayStake (Stripe Radar planned) | PlayStake staff | Policy 01 |
| Customer service | Email (support@playstake.org) | Google Workspace | PlayStake staff | |
| Complaints | Website form; admin console | PlayStake | Complaints manager | Policy 02 |
| ADR | IBAS | IBAS | IBAS | To sign |
| Transactional email | Worker outbox → Resend, from support@playstake.org | Resend | PlayStake | |
| Marketing | Not carried out | — | — | No affiliates or ads |
| Website analytics | Google Analytics 4 | Google | PlayStake | Public pages only, after consent |
| Error monitoring and alerting | Sentry; admin email alerts | Sentry | PlayStake | |
| Ledger audit and reconciliation | Worker (daily 03:00 UTC) | PlayStake | PlayStake | |
| Software development and release | GitHub → Railway deploy | GitHub, Railway | PlayStake | Tested in CI before release (Document 11) |
| Security testing | [PEN TEST PROVIDER]; annual security audit | [AUDITOR] | PlayStake | Not yet commissioned (Document 13) |
| Regulatory reporting | Email / eServices | — | Head of Compliance | Document 14 |

## 5. Changes

A change to any location, provider or operator in this map is assessed before it happens. Changes to where remote gambling equipment is located, and to key suppliers, are reported to the Commission as key events where LCCP 15.2.1 requires (Document 14).

| Version | Date | Change |
|---|---|---|
| 0.1 | 30 September 2026 | First draft |
| 0.2 | 27 October 2026 | Region recorded; recorder service and R2; Didit; independent dispute review; funds-protection disclosure; analytics and Google Workspace |
