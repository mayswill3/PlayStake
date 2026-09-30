# Document 11 — Testing Strategy

| | |
|---|---|
| **Operator** | [COMPANY NAME], trading as PlayStake |
| **Owner** | [ENGINEERING LEAD NAME], with sign-off by [COMPLIANCE LEAD NAME], Head of Compliance |
| **Version** | 0.1 — draft for licence application |
| **Review** | Annually; on any new game, change to random number generation, or change to the RTS or testing requirements (Document 12) |
| **Relates to** | Remote gambling and software technical standards (RTS), and the Commission's testing strategy requirements for compliance with the RTS; licence condition on gambling software; Documents 12, 13 |

> Draft prepared from the platform as built on 30 September 2026. `[BRACKETS]` must be completed before submission. RTS paragraph numbers are for orientation and must be confirmed against the current RTS (Document 12). The split between third-party and in-house testing below must be confirmed with the Commission (§3.3).

## 1. Purpose

This strategy explains how PlayStake makes sure its gambling system meets the RTS before release and stays compliant through every change: what is tested, by whom, when, how it is recorded and who signs it off.

## 2. What we offer, and what needs testing

| Product | Type | Random element | Outcome decided by |
|---|---|---|---|
| Tic-Tac-Toe | Peer-to-peer, pure skill | None | Server applies moves; first line of three wins |
| Higher / Lower | Peer-to-peer | Shuffled 52-card deck (server CSPRNG) | Server: one call against the next card |
| Darts 301 | Peer-to-peer, skill with chance | Scatter of each dart around the aim point (server CSPRNG, Gaussian) | Server: board scoring, 301 rules, three rounds |
| Live stream matches | Peer-to-peer, skill, external game | None in PlayStake | Independent human referee, with dispute window |

PlayStake does not offer house-banked games; players stake against each other and PlayStake takes a disclosed fee. All game logic and random number generation run on PlayStake's servers (Document 08 §3.1).

> **Note for the application:** Higher / Lower is almost entirely chance. Confirm with legal advisers and the Commission which licence activity covers it (betting intermediary or a casino/peer-to-peer licence), and whether its RNG and rules need third-party testing under that activity.

## 3. Approach

### 3.1 Third-party testing (approved test house)

We will engage a Commission-approved test house to test and certify, before real-money launch:

| Item | What the test house checks | RTS |
|---|---|---|
| Random number generation | `src/lib/games/rng.ts`: Node.js `crypto.randomInt` (OS CSPRNG); unbiased integer draws; the uniform-to-Gaussian conversion (Box–Muller) used for dart scatter; Fisher–Yates shuffle; no reuse or predictability; scaling free of modulo bias | RTS 7 (generation of random outcomes) |
| Higher / Lower rules and maths | Deck composition, deal, tie rule, winner determination match the published rules | RTS 3, 6, 7 |
| Darts rules and maths | Board geometry and scoring match the drawn board; scatter model; bust, checkout, three-round and draw rules match the published rules | RTS 3, 6, 7 |
| Game records | Each move, draw and result is logged immutably and can be replayed | RTS 7 |

Test houses on the Commission's approved list include BMM Testlabs, eCOGRA, Gaming Associates Europe, Gaming Laboratories International (GLI), Global Lab, NFA / Eclipse, Quinel and RiskCherry (check the Commission's current list before engaging). **Selected test house: [TEST HOUSE]. Engagement date: [DATE].** The test house certificate and report are kept with this strategy and supplied to the Commission on request.

### 3.2 In-house testing

PlayStake tests everything else itself, under this strategy, with results recorded:

| Area | How we test it | RTS |
|---|---|---|
| Customer information: rules, fees, payouts shown before commitment | Manual review against the game code at each release; screenshots kept | RTS 3 |
| Safer gambling tools: deposit limits (gross, most restrictive applies), 24-hour delay on increases, first-deposit prompt, six-monthly review, breaks, reality checks, clock/elapsed time | Automated integration tests; manual check each release | RTS 12, 13, 14 |
| Interrupted and abandoned games | Automated tests: void of unstarted matches, forfeit by the player to move, settlement of finished-but-unsettled matches | RTS 10 |
| Collusion, cheating, bots | Controls reviewed each release; server-side outcomes proven by tests that reject client-declared results | RTS 11, 16 |
| Ledger and escrow integrity | Automated tests of `transfer()`, escrow netting to zero, conservation; database triggers make entries append-only; daily production audit | Licence conditions on customer funds; RTS security requirements |
| Eligibility gate: KYC, GAMSTOP, breaks, account status | Automated tests | RTS 12, 14 |
| Security controls | Document 13; independent penetration test; annual security audit | RTS security requirements |

### 3.3 Points to confirm with the Commission

- Whether any RTS test requirement applies differently to peer-to-peer skill games where PlayStake is not a party to the bet.
- Whether a test house must also cover the platform functions listed in §3.2, or whether an in-house declaration is acceptable for them.

## 4. Automated testing on every change

- Every change goes through GitHub. CI runs lint, a type check, a dependency vulnerability audit (fails on critical findings), a malware scan and the full test suite against real PostgreSQL and Redis. A change can't be released unless CI passes.
- The suite (368 tests on 30 September 2026) includes, among others:
  - `tests/unit/ledger/` — double-entry transfers, escrow, audit invariants
  - `tests/unit/games/darts.test.ts` — board scoring matches the drawn board, bust, checkout, three-round result, draws
  - `tests/integration/game-integrity.test.ts` — deck never exposed, only the server decides, event log is complete and append-only, darts scoring, sweep forfeits and settles correctly
  - `tests/integration/demo-hardening.test.ts` — no player can forge a session or settle someone else's bet
  - `tests/integration/compliance-gates.test.ts`, `limit-review.test.ts`, `session-idle.test.ts`, and the responsible-play, KYC, AML and complaints suites

## 5. Change control

| Change class | Examples | Testing before release | Sign-off |
|---|---|---|---|
| **Major** | New game; any change to `rng.ts`, card or darts rules, board geometry, the scatter model; change to fee or settlement arithmetic | Full automated suite; test-house re-test and new certificate for game/RNG changes; update rules shown to customers | Engineering lead + Head of Compliance; test-house certificate on file |
| **Standard** | Changes to safer-gambling tools, limits, eligibility, payments, ledger | Full automated suite plus new tests for the change; manual check of customer-facing text | Engineering lead + Head of Compliance |
| **Minor** | Copy, styling, non-gambling pages | Full automated suite | Engineering lead |
| **Emergency** | Security fix | Full automated suite; retrospective review within 5 working days | Engineering lead; Head of Compliance informed same day |

Each release records: the commit, the CI run, the change class, any test-house reference, and sign-off. Game and RNG software versions are identified by the git commit of `src/lib/games/`.

## 6. Monitoring in production

- **Game fairness:** every draw is in `game_events`. A monthly statistical check (card frequency and dart-scatter distribution against expectation) is to be run and recorded. [TO BUILD — outstanding item.]
- **Ledger:** the ledger-audit worker verifies every account, every transaction and system-wide conservation daily and alerts on any failure.
- **Results:** the anomaly worker flags skewed win rates, single-winner patterns, fast settlements and volume spikes.

## 7. Annual security audit

The RTS security requirements call for an independent annual security audit against the ISO/IEC 27001:2022 controls listed in Document 13. For a new licensee the first audit is due within **six months of the licence being granted**, then each year. The auditor must be independent and suitably qualified (for example ISO/IEC 27001 Lead Auditor, CISA, CISM or CISSP). The report goes to the Commission at securityaudit@gamblingcommission.gov.uk. Auditor: [AUDITOR]. First audit due: [GRANT DATE + 6 MONTHS].

## 8. Records

Test-house certificates and reports, CI results, release sign-offs, the monthly fairness check, and security audit reports are kept for at least five years.

| Version | Date | Change |
|---|---|---|
| 0.1 | 30 September 2026 | First draft |
