# Document 12 — RTS Compliance Statement and Change Register

| | |
|---|---|
| **Operator** | [COMPANY NAME], trading as PlayStake |
| **Owner** | [COMPLIANCE LEAD NAME], Head of Compliance |
| **Version** | 0.1 — draft for licence application |
| **Review** | Monthly check of the Commission's RTS pages; full review annually |
| **Relates to** | Remote gambling and software technical standards (RTS); Documents 11, 13 |

> Draft prepared from the platform as built on 30 September 2026. RTS references are for orientation and must be confirmed against the Commission's current published text before submission. Items marked **confirm** depend on the Commission's view of which requirements apply to peer-to-peer play.

## 1. Purpose

This document states how PlayStake meets each RTS requirement that applies to it, and keeps a register of changes to the RTS so that none is missed. Testing of these controls is covered in Document 11; the RTS security requirements in Document 13.

## 2. How we track RTS changes

- The Head of Compliance checks the Commission's RTS pages, news and consultation responses **monthly** and records the check in §5, even when nothing has changed.
- Each change is entered in the register (§4) with its effective date, what it means for PlayStake, the work needed, an owner and a target date at least one month before it takes effect.
- Work is delivered through the change control in Document 11 §5 and the register is updated with the release and evidence.
- We also subscribe to the Commission's email updates and review industry updates from our compliance adviser.

## 3. Compliance statement

| Topic | RTS ref (confirm) | Applies? | How PlayStake meets it | Evidence |
|---|---|---|---|---|
| Rules, game descriptions and likelihood of winning | RTS 3 | Yes | Each game's guide page shows the standard settings, how the referee decides the result, draw and disconnect rules, stakes and payouts; the Match Rules apply to every match; the Fair Play page summarises both games | `src/lib/games/guides.ts`, `/games/ea-sports-fc-27`, `/games/tekken-8`, `/match-rules`, `/fair-play` |
| Fees and what a customer can win | RTS 3 / LCCP | Yes | Fee %, fee amount, win payout and draw return shown on the stake screen and every challenge before commitment, using the same arithmetic as settlement | `src/components/lobby/PayoutSummary.tsx`, `src/lib/utils/payout.ts` |
| Display of results and records | RTS 5 / 6 | Yes | Referee's result and written notes shown to both players; bet history and bet detail pages; append-only, hash-chained referee audit trail that can be verified for any match | `src/lib/referees/audit.ts` |
| Generation of random outcomes | RTS 7 | **No** (since 25 October 2026) | PlayStake has no game with a random outcome. Darts 301 and its random number generator were withdrawn on 25 October 2026. Results of refereed matches are decided by human referees, not by PlayStake software. | Document 11 §3.1; register §4 |
| Interrupted and abandoned gambling | RTS 10 | Yes | After a drop the referee decides from both streams whether to carry on, replay the affected part or award the match; a player not back within 10 minutes may lose the match. A match no referee takes within 10 minutes, or not finished within 2 hours of starting, is cancelled with both stakes returned in full. Our faults are reviewed and voided or corrected. Published on `/fair-play` and `/match-rules`. | `src/workers/bet-expiry.worker.ts`, `src/lib/referees/service.ts`; tests |
| Anti-collusion and cheating; recovered funds policy | RTS 11 | Yes | Results decided by independent referees, who can't officiate their own match or players they follow, are followed by or have a block with; hash-chained referee audit trail; anomaly and shared-identity detection; cheating, collusion and bots prohibited; published policy on suspending accounts, voiding matches, returning stakes to affected players and informing them | `/fair-play` §§5–6; Policy 01 |
| Financial limits | RTS 12 | Yes | See §3.1 | |
| Time: clock or elapsed time; reality checks | RTS 13 | Yes | The current time and the session's elapsed time are always on screen while signed in: in the header on larger screens, at the top of every page on phones. Optional reality checks at a customer-chosen interval show time, stakes and net result, across the dashboard. Matches are played in the customer's own game, outside PlayStake. [CONFIRM with advisor whether this placement is sufficient] | `SessionClock.tsx` (header and dashboard layout); `SessionReminder.tsx` |
| Breaks in play and self-exclusion | RTS 14 (updated 12 Jan 2026 — **review changes**) | Yes | Cool-off and self-exclusion breaks that can't be shortened; withdrawal still allowed; return from self-exclusion needs a request and a 24-hour cooling-off; GAMSTOP (planned) | Policies 03, 04 |
| Third-party software and bots | RTS 16 | Yes | Bots, scripts and software that plays for a player prohibited in terms, Match Rules and Fair Play; the referee watches both players' streams; detection by referee observation and pattern review | `/fair-play` §5, `/match-rules` |
| Auto-play, game speed, near-miss and similar slot/casino design rules | Various | **Confirm** — likely not applicable to peer-to-peer skill games | PlayStake runs no game of its own; no auto-play or spin-style features on the platform | — |
| Security requirements | RTS security section (ISO/IEC 27001:2022) | Yes | Document 13 | Document 13 |

### 3.1 RTS 12 financial limits

| Requirement | Effective | Status |
|---|---|---|
| Prompt to set a deposit limit at registration or before first deposit, with limit-setting presented as the default | 31 October 2025 | **Met.** First deposit is blocked until the customer sets a limit or actively declines; the answer is recorded. **Check** that setting a limit is the visually primary option in the prompt. |
| Remind customers at least every six months to review their limits | 31 October 2025 | **Met** (built 30 September 2026). Six-monthly reminder in the dashboard (`/play` was removed on 25 October 2026); answering, or changing a limit, restarts the period. |
| Increases to limits take effect only after a cooling-off period of at least 24 hours; decreases immediately | 31 October 2025 | **Met.** Increases and removals are staged for 24 hours. |
| Gross deposit limits must be offered as a minimum | **30 September 2026** (postponed from 30 June 2026) | **Met.** Limits count all deposits, pending and completed, without netting off withdrawals. |
| Only a gross deposit limit may be called a "deposit limit"; other limit types must be named accurately | 30 September 2026 | **Met.** The only financial limit offered is a gross deposit limit. |
| Where limits over several timeframes are set, the most restrictive applies | 30 September 2026 | **Met.** Every daily, weekly and monthly limit is checked on each deposit; the first one breached blocks it. |
| Definitions of stake, loss and net-deposit limits; equal prominence of limit types | 30 September 2026 | **Not applicable today** — no stake, loss or net-deposit limits are offered. If any is added, it must follow the definitions and be given equal prominence. |

## 4. RTS change register

| Date published | Change | Effective | Impact on PlayStake | Action | Owner | Status |
|---|---|---|---|---|---|---|
| 31 Oct 2025 | RTS index updated; RTS 12 financial limits changes (phase 1) | 31 Oct 2025 | First-deposit limit prompt, six-monthly review, 24-hour increase delay | Built; six-monthly reminder added 30 Sep 2026 | Head of Compliance | Done |
| [DATE] | RTS 12 phase 2: gross deposit limits, naming, most restrictive timeframe, definitions, equal prominence | Originally 30 Jun 2026, **postponed to 30 Sep 2026** | Deposit limits already gross and all timeframes enforced | Confirmed compliant 30 Sep 2026 (§3.1) | Head of Compliance | Done |
| 12 Jan 2026 | RTS 14 updated | [CONFIRM] | Breaks and self-exclusion tools | Review the updated text against Policies 03 and 04 and record the outcome | Head of Compliance | **Open** |
| 29 Jan 2026 | Consultation response on gaming machine technical standards (GMTS) | [N/A] | None: PlayStake offers no gaming machines. This was not an RTS change. | None | Head of Compliance | Closed |
| [DATE] | RTS security requirements move to ISO/IEC 27001:2022 control references | [CONFIRM] | Security control mapping | Document 13 maps to the 2022 controls | Head of Compliance | Done |
| 25 Oct 2026 | PlayStake product change (not an RTS change): on-site games (Tic-Tac-Toe, Darts 301) and their random number generator withdrawn; catalogue reduced to EA SPORTS FC 27 and Tekken 8, both refereed stream matches | 25 Oct 2026 | RTS 7 no longer applies; test-house RNG and game certification no longer needed; RTS 3, 5/6, 10, 11, 13 and 16 now met through game guides, Match Rules and refereeing; the on-screen clock moved from `/play` to the header and every dashboard page (RTS 13) | Compliance statement (§3) and Document 11 updated; clock re-homed 25 Oct 2026 | Head of Compliance | Closed |

## 5. Monthly check log

| Month | Checked by | RTS pages changed? | Register updated? |
|---|---|---|---|
| September 2026 | [NAME] | See register | Yes |

| Version | Date | Change |
|---|---|---|
| 0.1 | 30 September 2026 | First draft |
| 0.1 | 25 October 2026 | On-site games and their random number generator withdrawn; catalogue reduced to EA SPORTS FC 27 and Tekken 8; compliance statement and change register updated |
