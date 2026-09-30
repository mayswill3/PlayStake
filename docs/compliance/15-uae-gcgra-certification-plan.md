# Document 15 — UAE (GCGRA) Technical Standards and Certification Plan

| | |
|---|---|
| **Operator** | [COMPANY NAME], trading as PlayStake |
| **Owner** | [COMPLIANCE LEAD NAME], Head of Compliance, with [ENGINEERING LEAD NAME] |
| **Version** | 0.1 — planning draft |
| **Review** | Before any UAE engagement; on any GCGRA publication |
| **Relates to** | UAE General Commercial Gaming Regulatory Authority (GCGRA) requirements; GLI standards series; Documents 11, 12, 13 |

> **Planning draft, not verified against primary sources.** The GCGRA website could not be accessed when this was prepared. Everything below about GCGRA requirements, licence categories, approved standards and approved laboratories comes from public secondary reporting and must be confirmed directly with the GCGRA and UAE legal counsel before any decision is taken. Gambling is otherwise prohibited in the UAE; nothing may be offered to UAE residents until PlayStake (or a partner) is licensed by the GCGRA.

## 1. Purpose

To set out what PlayStake would need to do to have its gambling system assessed and certified for the UAE market, reusing as much as possible of the UK work in Documents 11–13.

## 2. What we understand today (to confirm)

| Topic | Current understanding | Source status |
|---|---|---|
| Regulator | GCGRA, a federal authority set up in 2023 to license and regulate commercial gaming in the UAE | Secondary reporting |
| Online gambling | The GCGRA licenses internet gaming and sports wagering; the first such licence was reported in November 2025 (Play 971) | Secondary reporting |
| Peer-to-peer skill wagering | **Unknown** whether a licence category exists for a platform like PlayStake, or whether it must operate through, or supply, an existing licensee | To ask GCGRA |
| Technical standards | GCGRA technical standards are reported to be based on the GLI standards series, in particular **GLI-19** (Interactive Gaming Systems) and **GLI-33** (Event Wagering Systems), with GCGRA-specific requirements on top | Secondary reporting |
| Independent test laboratories | Reported as Gaming Laboratories International (GLI) and BMM Testlabs (BMM North America and BMM Spain) | Secondary reporting |
| Data location, currency, identity | Not yet known. Likely requirements to check: hosting or data residency in the UAE, AED accounts, UAE identity verification (e.g. Emirates ID / UAE Pass), UAE-only geolocation | To ask GCGRA |

## 3. Which standards are likely to apply

| Standard | Why it may apply | Main areas it covers |
|---|---|---|
| **GLI-19** Interactive Gaming Systems | PlayStake is an online platform with player accounts, a wallet and server-side games | Player account management, KYC and geolocation, wallet and financial transactions, responsible gaming tools, game fairness and RNG, game recall and interrupted games, logging and reporting, security and change management |
| **GLI-33** Event Wagering Systems | Stream matches are wagers on the outcome of an external event (a live game), settled on a referee's result | Wager acceptance, event and result management, settlement, voids and cancellations |
| GLI RNG requirements (within GLI-19) | Higher / Lower and Darts use server-side random draws | RNG source, scaling, seeding, statistical testing |
| **GCGRA-specific requirements** | Local rules on responsible gaming, AML, data and reporting | [TO OBTAIN] |

## 4. Plan

| Phase | What | Output | Indicative timing |
|---|---|---|---|
| **1. Confirm the route** | Legal counsel in the UAE; formal enquiry to the GCGRA on whether and how peer-to-peer skill wagering can be licensed; whether PlayStake would apply itself or supply a licensee (B2B) | Written answer and chosen route | Month 1–2 |
| **2. Obtain the rules** | Get the GCGRA technical standards, licensing rules and any lab-submission guidance; confirm which GLI standards and versions apply | Requirements library | Month 2 |
| **3. Gap assessment** | Map each requirement to the platform, reusing the UK RTS statement (Document 12), testing strategy (Document 11) and ISO 27001 mapping (Document 13). Early candidates: UAE geolocation; UAE identity checks; AED currency; data residency; GCGRA reporting feeds; game recall display; any limits or tools the GCGRA mandates | Gap register with owners | Month 3 |
| **4. Build** | Close the gaps as a UAE configuration of the same platform, behind jurisdiction settings, through the change control in Document 11 §5 | Release candidate | Months 4–6 |
| **5. Lab engagement** | Engage GLI or BMM (as approved by the GCGRA). Pre-submission meeting; submit source code, documentation and a test environment; RNG and game certification; platform (GLI-19 / GLI-33) testing | Lab report and certificate | Months 6–9 |
| **6. Licence submission** | Submit certificates with the licence application or the partner's change notification | Approval | After phase 5 |
| **7. Ongoing** | Re-certification for changes as the GCGRA requires; keep one change register covering UK and UAE; annual security audit covering both | Maintained certification | Continuous |

## 5. What carries over from the UK work

- **Server-authoritative games and CSPRNG** (`src/lib/games/`), with an append-only event log for game recall — the core of GLI-19 game and RNG testing.
- **Double-entry ledger and per-bet escrow**, append-only, audited daily — the core of wallet and financial transaction requirements.
- **Safer gambling tools** (deposit limits, breaks, reality checks, clock, interactions) and the single eligibility gate.
- **Security controls** mapped to ISO/IEC 27001:2022 (Document 13), and the incident process (Document 14).
- **Test evidence:** the automated test suite and the UK test-house report. Ask the lab whether any UK certification work can be reused, for example for the RNG, to shorten the UAE assessment.

## 6. Decisions and risks

| Item | Note |
|---|---|
| Licence route | The biggest uncertainty; everything else depends on it |
| Data residency | If UAE hosting is required, PlayStake needs a second deployment in a UAE region, not just configuration. This changes Documents 08–10. |
| Choice of lab | Choosing the same lab for the UK and UAE (GLI or BMM are on both lists) may reduce cost and time |
| Higher / Lower | Near-pure chance; may be treated as casino gaming in the UAE and need a different licence category or removal |

## 7. Next actions

1. Instruct UAE counsel and send the GCGRA enquiry. Owner: Head of Compliance.
2. Ask GLI and BMM for a scoping call covering both UK RTS testing and UAE certification. Owner: Head of Compliance.
3. Obtain the current GLI-19 and GLI-33 standards and start the gap register. Owner: Engineering.

| Version | Date | Change |
|---|---|---|
| 0.1 | 30 September 2026 | First draft |
