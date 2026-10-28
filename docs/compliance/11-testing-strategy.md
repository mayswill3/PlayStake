# Document 11 — Testing Strategy

| | |
|---|---|
| **Operator** | [COMPANY NAME], trading as PlayStake |
| **Owner** | [ENGINEERING LEAD NAME], with sign-off by [COMPLIANCE LEAD NAME], Head of Compliance |
| **Version** | 0.1 — draft for licence application |
| **Review** | Annually; on any new game or match format, any change to how results are decided, or change to the RTS or testing requirements (Document 12) |
| **Relates to** | Remote gambling and software technical standards (RTS), and the Commission's testing strategy requirements for compliance with the RTS; licence condition on gambling software; Documents 12, 13 |

> Draft prepared from the platform as built on 30 September 2026. `[BRACKETS]` must be completed before submission. RTS paragraph numbers are for orientation and must be confirmed against the current RTS (Document 12). The split between third-party and in-house testing below must be confirmed with the Commission (§3.3).

## 1. Purpose

This strategy explains how PlayStake makes sure its gambling system meets the RTS before release and stays compliant through every change: what is tested, by whom, when, how it is recorded and who signs it off.

## 2. What we offer, and what needs testing

| Product | Type | Random element | Outcome decided by |
|---|---|---|---|
| EA SPORTS FC 27 (refereed stream match) | Peer-to-peer, skill, external game | None in PlayStake | Independent human referee watching both players' Kick streams; win for either player or a draw; 15-minute dispute window |
| Tekken 8 (refereed stream match) | Peer-to-peer, skill, external game | None in PlayStake | Independent human referee watching both players' Kick streams; win for either player or a draw; 15-minute dispute window |

PlayStake does not offer house-banked games; players stake against each other (£1 to £500) and PlayStake takes a disclosed fee of 5% of the pot, of which the referee receives 10%. PlayStake runs no game logic and no random number generation. The games are third-party titles that players run on their own devices (Document 08 §3.1).

> **Note for the application:** PlayStake's own on-site games, Tic-Tac-Toe and Darts 301, were withdrawn on 25 October 2026, together with their server-side game engines and the random number generator used for dart scatter. The other console titles previously listed were withdrawn at the same time. The game-session and game-event records of the withdrawn games are kept, append-only; no new ones are created.

> **Note for the application:** Higher / Lower, a card game that was almost entirely chance, was withdrawn on 30 September 2026 so that everything offered fits a betting intermediary licence. Its past match records are kept; no new match can be started.

## 3. Approach

### 3.1 Third-party testing (approved test house)

Until 25 October 2026 this section planned test-house certification of PlayStake's random number generator and Darts rules (RTS 7). Those games and the random number generator were withdrawn on that date, so there is no PlayStake game, game rule set or random number generator for a test house to certify.

Results are now decided by independent human referees. The integrity of results rests on referee independence, the hash-chained referee audit trail, dispute review and anomaly and collusion monitoring (Policy 01 §3.3), which are tested in-house (§3.2).

If PlayStake ever adds a game it runs itself, or any random element, a Commission-approved test house will test and certify it before release (§5). Whether the Commission expects any third-party testing of the platform functions in §3.2 is a point to confirm (§3.3). [CONFIRM with advisor]

### 3.2 In-house testing

PlayStake tests everything else itself, under this strategy, with results recorded:

| Area | How we test it | RTS |
|---|---|---|
| Customer information: rules, fees, payouts shown before commitment | Manual review of the game guides (`/games/ea-sports-fc-27`, `/games/tekken-8`), Match Rules and Fair Play pages against the code at each release; screenshots kept | RTS 3 |
| Safer gambling tools: deposit limits (gross, most restrictive applies), 24-hour delay on increases, first-deposit prompt, six-monthly review, breaks, reality checks, clock/elapsed time | Automated integration tests; manual check each release | RTS 12, 13, 14 |
| Interrupted and abandoned matches | Automated tests: a match no referee claims within 10 minutes is cancelled and refunded; a stalled claim is released; a match running past 2 hours is cancelled and refunded; settlement of finished-but-unsettled matches | RTS 10 |
| Collusion, cheating, bots | Controls reviewed each release; tests prove that a referee can't claim a match with a player they follow, are followed by or have a block with, that the referee audit chain detects altered, deleted or reordered events, and that a player can't stake against themselves | RTS 11, 16 |
| Ledger and escrow integrity | Automated tests of `transfer()`, escrow netting to zero, conservation; database triggers make entries append-only; daily production audit | Licence conditions on customer funds; RTS security requirements |
| Eligibility gate: KYC, 21+ and Great Britain residency (including customers verified before those rules), GAMSTOP, breaks, account status | Automated tests | RTS 12, 14 |
| Financial vulnerability check: net deposits over £150 in 30 days, boundary at exactly £150, withdrawals netted, once per 12 months, staff-only | Automated tests | LCCP / Policy 05 |
| Customer funds disclosure: rating shown in writing; acknowledgement before deposit and before staking deposited funds; six-monthly reminder with balance; re-acknowledgement after a change | Automated integration tests; manual check of wording against Policy 19 each release | LCCP 4.2.1 |
| Independent dispute review: reviewer conflicts, one reviewer per dispute, overturn tracking | Automated integration tests | RTS 11 |
| Match recordings: recording page access, sealing into the audit trail, retention, who may watch | Automated integration tests; end-to-end recording test against live Kick streams before release (done 26 October 2026) | RTS 5/6, 11 |
| Security controls | Document 13; independent penetration test; annual security audit | RTS security requirements |

### 3.3 Points to confirm with the Commission

- Whether any RTS test requirement applies differently to peer-to-peer skill games where PlayStake is not a party to the bet.
- Whether a test house must also cover the platform functions listed in §3.2, or whether an in-house declaration is acceptable for them.

## 4. Automated testing on every change

- Every change goes through GitHub. CI runs lint, a type check, a dependency vulnerability audit (fails on critical findings), a malware scan and the full test suite against real PostgreSQL and Redis. A change can't be released unless CI passes.
- The suite (394 tests on 28 October 2026) includes, among others:
  - `tests/unit/ledger/` — double-entry transfers, escrow, audit invariants
  - `tests/integration/referee-lifecycle.test.ts` — one referee per match, conflict checks on follows and blocks, start only when live on Kick, cancellation sweeps for unclaimed and overlong matches
  - `tests/integration/referee-operations.test.ts`, `referee-code.test.ts`, `tests/unit/referees/audit.test.ts` — overturn tracking, Code of Conduct acceptance, hash-chained audit trail
  - `tests/integration/self-bet.test.ts`, `dual-source-result.test.ts` — no self-play; mismatched results open a dispute
  - `tests/integration/dispute-review.test.ts` — only an admin or approved reviewer with no link to the players decides a dispute; one reviewer at a time
  - `tests/integration/match-recording.test.ts` — recorder access tokens, sealing, 30-day and 12-month retention, holds during disputes, playback only for reviewers, viewing logged
  - `tests/integration/customer-interaction.test.ts` — includes the funds-protection disclosure, acknowledgement gates and six-monthly reminder
  - `tests/integration/compliance-gates.test.ts`, `limit-review.test.ts`, `session-idle.test.ts`, and the responsible-play, KYC, AML and complaints suites

## 5. Change control

| Change class | Examples | Testing before release | Sign-off |
|---|---|---|---|
| **Major** | New game or match format; change to the standard settings or how results are decided; change to referee conflict checks, the referee audit trail or dispute handling; change to fee or settlement arithmetic | Full automated suite; update the game guides, Match Rules and Fair Play pages shown to customers; test-house testing before release if the change adds a PlayStake-run game or any random element (§3.1) | Engineering lead + Head of Compliance |
| **Standard** | Changes to safer-gambling tools, limits, eligibility, payments, ledger | Full automated suite plus new tests for the change; manual check of customer-facing text | Engineering lead + Head of Compliance |
| **Minor** | Copy, styling, non-gambling pages | Full automated suite | Engineering lead |
| **Emergency** | Security fix | Full automated suite; retrospective review within 5 working days | Engineering lead; Head of Compliance informed same day |

Each release records: the commit, the CI run, the change class, any test-house reference, and sign-off. Game catalogue and referee software versions are identified by the git commit of `src/lib/games/` and `src/lib/referees/`.

## 6. Monitoring in production

- **Result integrity:** every referee action is in the hash-chained referee audit trail, which can be verified for any match. Overturned referee decisions are tracked per referee and reviewed. (The monthly dart-scatter check planned here is no longer needed: Darts was withdrawn on 25 October 2026.)
- **Ledger:** the ledger-audit worker verifies every account, every transaction and system-wide conservation daily and alerts on any failure.
- **Results:** the anomaly worker flags skewed win rates, single-winner patterns, fast settlements and volume spikes.

## 7. Annual security audit

The RTS security requirements call for an independent annual security audit against the ISO/IEC 27001:2022 controls listed in Document 13. For a new licensee the first audit is due within **six months of the licence being granted**, then each year. The auditor must be independent and suitably qualified (for example ISO/IEC 27001 Lead Auditor, CISA, CISM or CISSP). The report goes to the Commission at securityaudit@gamblingcommission.gov.uk. Auditor: [AUDITOR]. First audit due: [GRANT DATE + 6 MONTHS].

## 8. Records

Any test-house reports, CI results, release sign-offs and security audit reports are kept for at least five years.

| Version | Date | Change |
|---|---|---|
| 0.1 | 30 September 2026 | First draft |
| 0.1 | 25 October 2026 | On-site games (Tic-Tac-Toe, Darts 301) and their random number generator withdrawn; catalogue reduced to EA SPORTS FC 27 and Tekken 8, both refereed stream matches; test-house scope, change control and monitoring updated to match |
