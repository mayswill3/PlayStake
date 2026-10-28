# Document 21 — Reconciliation with Policy Set v0.2

| | |
|---|---|
| **Prepared for** | Charles Gordon (accountable sponsor) and William Mays (technical delivery) |
| **Version** | 0.1 — 28 October 2026 |
| **Compares** | *PlayStake compliance manual, Policy set v0.2, 27 October 2026* (Policies 00–16 and the implementation register; "the v0.2 set") with these documents (00–20) and the platform as built on 28 October 2026 |

> The v0.2 set was written from earlier copies of documents 00–16 and public website text. It says it did not inspect the platform code, and that "no document 17 was supplied". This document lists where the two sets agree, where they differ, and the platform evidence for items the v0.2 register marks as open, so that one consistent set goes to the Commission.

## 1. Which set is the master

**Recommendation:** use the v0.2 set as the master text for Policies 00–16, and add to it:

| v0.2 set | From these documents | Note |
|---|---|---|
| "Document 17 not supplied" | **17 — DPIA: identity verification (Didit)** | Add as 17 |
| — | **18 — DPIA: match recordings** | Add as 18. v0.2 Policy 13 and register T04 already require an impact assessment for recordings |
| Policy 16 (payment services and customer funds) | **19 — Protection of customer funds** | Fold 19's detail into v0.2 Policy 16 (segregation steps, daily reconciliation, disclosure flow), or keep it as an annex |
| — | **20 — UKGC application answers** | Re-point its "attach" column to v0.2 numbering once the set is final |
| — | **This document (21)** | Working note; not for submission |

The editable (Markdown) files of the v0.2 set mentioned in its handover ZIP were not available when this was prepared, so nothing in the v0.2 set has been edited.

## 2. Decisions: agreed and built

| Decision (v0.2) | Platform, 28 October 2026 | Evidence |
|---|---|---|
| **21+ only** | Built. Sign-up refuses under-21 dates of birth; verification and staff approval refuse anyone under 21 (under-18s are still closed as under-18); the eligibility gate re-checks the approved identity before every deposit and stake, so customers verified before the rule who are 18–20 are stopped (they can withdraw). Site, Terms, Match Rules, FAQ and emails say 21+. | `MINIMUM_AGE_YEARS = 21`; Policy 06; tests in `auth`, `kyc`, `didit`, `customer-interaction` suites |
| **England, Scotland and Wales only** | Residency built: the verified address must be country GB and not a Northern Ireland (BT) postcode, at verification (Didit and manual), at approval and before every deposit and stake. Residency comes from the proof of address, not the passport. **Not built: location at play time (IP geolocation)** — open, see §3. | `isGreatBritainAddress`; Policy 06; Document 08 |
| **5% of the combined pot** | Already the fee; shown before commitment | Document 12 |
| Genuine draw: 5% fee, remaining pot returned equally | Already how draws settle | Match Rules; game guides |
| **Financial vulnerability check at net deposits over £150 in a rolling 30 days** | Built 28 October 2026 as a staff-only signal (deposits minus withdrawals; not at exactly £150; once per 12 months; not shown to the customer). Staff carry out the check manually until a data provider is approved (register C06). | Policy 05 §3.2; `detectFinancialVulnerabilityCheck` |
| Separate client account; accurate protection disclosure; no unconfirmed rating published | Disclosure and acknowledgement built; site states the true current position ("not protected – no segregation"); switches to "segregation of customer funds" with one setting once the account is open | Policy 19; Document 20 |
| Escrow / protection claims removed (W03) | Done 27 October 2026 | Site |
| IBAS not presented as appointed; no assumed six-month limit (W05) | Done 28 October 2026: complaints page, Terms and Match Rules now say IBAS is being arranged | Site |
| Recordings: 30 days routine; disputes until resolution plus up to 12 months | Built exactly so | Document 18 |
| ISO/IEC 27001:2022 controls | Document 13 maps to 2022 | Document 13 |
| 15-minute post-result window | Built | Match Rules |

## 3. Where the two sets differ

| Topic | v0.2 set | Decision / platform | Action |
|---|---|---|---|
| **Tekken 8** | Outside the first launch; EA SPORTS FC only | **Kept.** Tekken 8 stays alongside EA SPORTS FC 27 (decision of 28 October 2026) | Charles: amend v0.2 Policies 00 and 12 and register T12, and include Tekken 8 in the game rulebook and scope approval (register M01, G02) |
| Location at play time | Geography enforced "on every server route" (C01) | Residency only; no IP geolocation | Decide on IP geolocation (MaxMind GeoLite2, or Cloudflare in front of the site) before launch |
| Stake increments and range | "Not confirmed" | £1–£500, any amount in pence | Charles to approve or change |
| Affordability marker | — | Separate affordability check at £2,000 gross deposits in 30 days, in addition to the £150 check | Confirm both thresholds with the advisor (Master Manual item 9) |
| Didit status | Supplier "still being finalised" | In use for verification; DPA not yet signed | Sign the DPA; describe Didit as "in use, contract pending" until then |
| Policy numbering | Customer funds inside Policy 16 | Separate Policy 19 | See §1 |

## 4. Platform facts for open v0.2 register items

| Register item | Fact (checked 28 October 2026) |
|---|---|
| **T01** infrastructure | Railway, all five services (web, worker, recorder, PostgreSQL, Redis) in **EU West, `europe-west4`, Amsterdam, Netherlands**. Recordings: Cloudflare R2, EU-jurisdiction bucket, private. Identity: Didit (EU, Spain). Errors: Sentry (EU, Germany). Email: Resend (region to confirm) and Google Workspace. **Backup location and restore test still to confirm.** |
| **T04** biometric and recording processing | DPIAs drafted: Document 17 (Didit), Document 18 (recordings). Sign-off outstanding. |
| **M03** evidence and provisional-result workflow | Referee result, 15-minute dispute window, independent dispute review (admin or approved reviewer, conflict-checked, one reviewer per dispute), recordings with SHA-256 sealed into the hash-chained referee audit trail. |
| **M05** protection disclosure | Built: written statement, acknowledgement before deposit and before staking deposited funds, six-monthly reminder with balance, re-acknowledgement on change. |
| **M07** daily reconciliation | "Customer funds held" (all player balances plus stakes in matches) on the admin overview and logged daily by the ledger audit. The bank and PSP side of the reconciliation is a finance process (Policy 19 §2). |
| **C06** financial vulnerability | Signal built at £150 net; data route not yet approved. |
| **C01** 21+ and GB | Built for age and residency; IP location not built. |
| **W02** 18+ beta wording | All public wording changed to 21+. |

## 5. Still open on our side

1. Didit workflow: raise its age rule from 18 to 21 in the Didit console (PlayStake already enforces 21 itself).
2. Customer-funds bank account (Policy 19 §6).
3. IP geolocation decision.
4. Railway backup location and restore test.

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 28 October 2026 | First version after comparing the v0.2 set with documents 00–20 and the platform |
