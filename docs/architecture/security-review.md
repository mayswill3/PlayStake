# PlayStake Security Architecture Review

**Reviewer**: Security Engineer
**Date**: 2026-03-09
**Scope**: Full architecture review of escrow logic, payout triggers, developer API attack surface, widget authentication, and general financial security.
**Approach**: Adversarial threat modeling. Every finding assumes a motivated attacker with knowledge of the system design.

---

## Executive Summary

The PlayStake architecture demonstrates solid foundational security: double-entry ledger with invariant checks, atomic balance operations via `SELECT ... FOR UPDATE`, idempotency on all mutating endpoints, HMAC-signed webhooks, and hashed storage for all secrets. However, several **Critical** and **High** severity vulnerabilities exist primarily in the game developer trust model, the escrow-to-settlement pipeline, and the widget authentication boundary. These must be addressed before handling real money.

### Finding Summary

| Severity | Count |
|----------|-------|
| Critical | 6     |
| High     | 9     |
| Medium   | 10    |
| Low      | 5     |

---

## 1. Escrow Logic Vulnerabilities

### 1.1 CRITICAL: No Cross-Bet Balance Reservation Causes Over-Commitment

**Severity**: Critical

**Attack scenario**:
1. Player A has a balance of $50.
2. A malicious game server (or two colluding game servers) simultaneously sends two `POST /api/v1/bets` requests, each for $50, with different idempotency keys.
3. Both requests read Player A's balance as $50 (if the balance check and debit are not truly serialized across requests).
4. Both pass the `balance >= amount` check.
5. Player A now has -$50 balance and $100 in escrow across two bets.

**Current mitigation**: The architecture specifies `UPDATE ... WHERE balance >= $amount` which acquires a row-level lock. This is correct IF and ONLY IF both operations target the same `ledger_accounts` row and are in separate transactions that serialize properly.

**Residual risk**: The architecture says Prisma `$transaction` is used, but does not specify the isolation level. Prisma's default interactive transactions use `READ COMMITTED` isolation. Under `READ COMMITTED`, two concurrent `UPDATE ... WHERE balance >= $amount` statements on the same row will correctly serialize because the second UPDATE will block until the first commits. **This specific attack is mitigated by PostgreSQL row-level locking semantics.** However, if any code path reads the balance in a separate query before the atomic UPDATE (e.g., a pre-validation check), a TOCTOU race exists.

**Recommended fix**:
- Explicitly document and enforce that balance checks MUST only happen via the atomic `UPDATE ... WHERE balance >= $amount` pattern. Never use a separate `SELECT` to pre-check balance before debiting.
- Set Prisma transaction isolation level to `SERIALIZABLE` for all ledger operations, or at minimum document that `READ COMMITTED` is sufficient due to the row-lock pattern.
- Add a database-level `CHECK (balance >= 0)` constraint on `ledger_accounts.balance` as a defense-in-depth measure. If any code path bypasses the atomic update, the constraint catches it.

```sql
ALTER TABLE ledger_accounts ADD CONSTRAINT chk_balance_non_negative CHECK (balance >= 0);
```

### 1.2 HIGH: Escrow Release Without Valid Bet State Transition

**Severity**: High

**Attack scenario**:
1. Settlement processor picks up a bet in `RESULT_REPORTED` status.
2. Between the processor's initial query and acquiring the advisory lock, an admin voids the bet via the admin panel.
3. The admin void creates refund transactions, zeroing the escrow.
4. The settlement processor acquires the lock, re-reads the bet (now `VOIDED`), but if the re-read check is improperly implemented (only checks for `RESULT_REPORTED` but not escrow balance), it attempts to release from a zero-balance escrow.
5. Best case: the transaction fails. Worst case: negative escrow balance, breaking the conservation-of-money invariant.

**Current mitigation**: Step 2 of the settlement processor says "Verify bet is still in RESULT_REPORTED status (re-read inside transaction)." This is correct if implemented faithfully. The escrow balance = 0 invariant check at step 5f is also a good backstop.

**Recommended fix**:
- The advisory lock acquisition and status re-read MUST happen inside the same database transaction. The sequence must be: BEGIN -> acquire advisory lock -> SELECT bet FOR UPDATE -> verify status = RESULT_REPORTED -> proceed or abort -> COMMIT.
- Add an explicit escrow balance pre-check before any debit: `SELECT balance FROM ledger_accounts WHERE bet_id = $betId AND account_type = 'ESCROW' FOR UPDATE`. Verify balance equals expected `amount * 2` before proceeding.
- Add a database constraint or trigger that prevents `ledger_accounts.balance` from going negative for ESCROW accounts.

### 1.3 HIGH: Crash During Settlement Leaves Bet in Inconsistent State

**Severity**: High

**Attack scenario**:
1. Settlement processor begins a database transaction for bet settlement.
2. It successfully creates the `PLATFORM_FEE` transaction (debit escrow, credit platform revenue).
3. The process crashes (OOM, deployment restart, node failure) before creating the `BET_ESCROW_RELEASE` transaction.
4. The database transaction rolls back (assuming PostgreSQL transaction semantics).
5. The bet remains in `RESULT_REPORTED` state. The settlement processor will retry on the next cycle.

**Current mitigation**: If all operations are inside a single database transaction, the crash causes a full rollback. The advisory lock is released when the connection drops. The deterministic idempotency key (`settle_{betId}_{step}`) prevents double-settlement on retry.

**Residual risk**: The architecture mentions steps 5a through 5f happening "in a single database transaction," but then step 6 fires a webhook AFTER the transaction. If the transaction commits but the process crashes before the webhook fires, the bet is settled but the developer never receives `BET_SETTLED`. This is a data consistency issue, not a financial one, but it can cause the game server to think the bet is still pending.

**Recommended fix**:
- Webhook dispatch must be enqueued as a job (in the same database transaction if using pg-boss, or immediately after commit if using BullMQ) rather than fired inline. This ensures eventual delivery even after a crash.
- Add a reconciliation job that checks for bets in `SETTLED` status without a corresponding `DELIVERED` webhook delivery log, and re-enqueues the webhook.

### 1.4 MEDIUM: Ledger Entry Manipulation via Admin ADJUSTMENT Transactions

**Severity**: Medium

**Attack scenario**:
1. A compromised or malicious admin uses the `ADJUSTMENT` transaction type to credit arbitrary amounts to their own (or an accomplice's) player balance.
2. The double-entry ledger technically stays balanced if they debit a system account (e.g., `PLATFORM_REVENUE`) and credit `PLAYER_BALANCE`.
3. The daily ledger integrity checker verifies that entries sum to zero per transaction, so the manipulation passes the audit.

**Current mitigation**: The `ADJUSTMENT` type exists with a `description` field for the reason, but there is no documented approval workflow, no dual-authorization requirement, and no separate audit log for admin actions.

**Recommended fix**:
- Require dual-admin authorization for any ADJUSTMENT transaction above a threshold (e.g., $100).
- All ADJUSTMENT transactions should be logged to a separate, append-only audit table that captures the admin user ID, IP address, justification, and timestamp.
- ADJUSTMENT transactions should be flagged and reviewed in the daily ledger integrity check, not just treated as normal entries.
- Consider rate-limiting ADJUSTMENT creation (e.g., max 5 per day per admin).
- The `resolvedById` pattern used in disputes should be extended: a second admin must approve before the ledger entry is executed.

### 1.5 MEDIUM: No Upper Bound on Per-Player Escrow Exposure

**Severity**: Medium

**Attack scenario**:
1. A player deposits $1,000 and creates 100 bets of $10 each across multiple games.
2. All bets are in `OPEN` status, tying up the full balance in escrow.
3. If many of these bets are matched simultaneously, the player's exposure is maximized.
4. While not directly exploitable for theft, this creates a griefing vector: a player can lock up funds in bets they never intend to play, then dispute all of them to overwhelm admin review.

**Current mitigation**: Bets have `expiresAt` which auto-cancels unmatched bets. Individual games have `minBetAmount` and `maxBetAmount`. However, there is no limit on the total number of concurrent open bets per player or total escrowed amount.

**Recommended fix**:
- Implement a per-player maximum concurrent open bet count (e.g., 10).
- Implement a per-player maximum total escrowed amount (e.g., 80% of their deposited total).
- These limits prevent both griefing and protect players from overcommitting.

---

## 2. Payout Trigger Security

### 2.1 CRITICAL: Game Developer Can Unilaterally Determine Payout Recipients

**Severity**: Critical

**Attack scenario**:
1. A malicious or compromised game developer reports `PLAYER_A_WIN` via `POST /api/v1/bets/:betId/result`.
2. PlayStake trusts this result and pays out to Player A after the 2-minute confirmation window.
3. The actual game result was a Player B win, or the game never happened at all.
4. The developer colludes with Player A to split the stolen funds.

**Current mitigation**: The 2-minute dispute window allows players to dispute before settlement. However, this assumes the losing player is aware of the incorrect result within 2 minutes and is actively monitoring the PlayStake platform.

**Why this is Critical**: The entire security model for payouts rests on trusting the game developer's reported result. There is no independent verification of game outcomes. A compromised API key or a rogue developer employee can steal every dollar in escrow for active bets.

**Recommended fix**:
- **Dual-source result verification**: Require both the game server AND the losing player (or client-side SDK) to confirm the result. Settlement only proceeds when both sources agree, or after a longer confirmation window (e.g., 15 minutes) with no dispute.
- **Result signing**: The game server should sign results with a key-pair (not just the API key). Store the public key during game registration. Verify the signature on result submission.
- **Statistical anomaly detection**: Track win rates per game developer. Alert on developers whose games produce statistically unlikely outcomes (e.g., one player winning 95% of bets).
- **Escrow caps per developer**: Limit the total amount of funds in escrow for any single developer's games. This bounds the blast radius of a compromised developer.
- **Delayed settlement for high-value bets**: Bets above a threshold (e.g., $100) should have a longer confirmation window (e.g., 1 hour) to allow player review.

### 2.2 CRITICAL: No Verification That API Key Owns the Game Associated With a Bet

**Severity**: Critical

**Attack scenario**:
1. Developer A registers Game A. Developer B registers Game B.
2. A bet is created for Game A and is in `MATCHED` status.
3. Developer B calls `POST /api/v1/bets/:betId/result` with their own API key.
4. If the endpoint only checks `result:report` permission but does not verify that the API key belongs to the developer who owns the game associated with the bet, Developer B can report false results for Game A's bets.

**Current mitigation**: The API endpoint documentation says "Required permission: result:report" but does NOT mention validating that the API key's developer profile owns the game. The `ApiKey` model links to `DeveloperProfile`, and `Game` links to `DeveloperProfile`, so the data model supports this check, but it is not documented as an enforced validation.

**Recommended fix**:
- On EVERY developer API endpoint that operates on a bet or game, enforce: `apiKey.developerProfileId === game.developerProfileId`. This must be a hard requirement, not optional.
- Write integration tests that specifically attempt cross-developer result reporting and verify it fails with 403.
- Consider scoping API keys to specific games (add a `gameId` column to `ApiKey`) for an additional layer of isolation.

### 2.3 HIGH: Double Payout via Race Between Settlement and Dispute Resolution

**Severity**: High

**Attack scenario**:
1. A bet is in `RESULT_REPORTED` status.
2. The 2-minute confirmation window passes with no dispute.
3. The settlement processor picks up the bet and begins its transaction.
4. Simultaneously, a player files a dispute at the exact same moment (the 24-hour dispute window is separate from the 2-minute settlement window).
5. If the dispute creation does not acquire a lock on the bet row, the settlement proceeds. The dispute is then filed on an already-settled bet.
6. An admin resolves the dispute in favor of the other player, triggering a second payout from... where? The escrow is already zero.

**Current mitigation**: The settlement processor query includes `NOT EXISTS (SELECT 1 FROM disputes WHERE betId = bets.id AND status = 'OPEN')`. This prevents settlement if a dispute already exists. However, the dispute filing endpoint allows disputes on `SETTLED` bets (documented: "If already SETTLED, payout may be reversed pending review").

**Recommended fix**:
- Dispute filing on a `SETTLED` bet must NOT trigger automatic reversal. It should flag the bet for manual admin review only.
- Dispute resolution on a settled bet should create new transactions (debit winner's balance, credit loser's balance) rather than attempting to release from the (now-zero) escrow. This requires the winner to have sufficient balance.
- If the winner has already withdrawn the funds, the platform must absorb the loss or have a reserve fund. Document this risk and create a `PLATFORM_RESERVE` ledger account.
- Add `SELECT ... FOR UPDATE` on the bet row in BOTH the settlement processor AND the dispute filing endpoint to serialize these operations.

### 2.4 HIGH: Platform Fee Can Be Manipulated via Game Configuration Changes

**Severity**: High

**Attack scenario**:
1. Developer registers a game with `platformFeePercent = 5%`.
2. A bet is created, and `platformFeePercent` is snapshotted on the bet at creation time (good).
3. However, the developer can update their game's `platformFeePercent` via `PATCH /api/developer/games/:id`.
4. If the settlement processor reads the fee from the game config instead of the bet's snapshotted value, the developer could set the fee to 0% before settlement to maximize player payouts (and their rev-share comes from platform revenue, so this hurts PlayStake).

**Current mitigation**: The `Bet` model has `platformFeePercent` which is described as "snapshot from game config at creation time." The settlement processor documentation in C1 references `platformFeePercent` but does not explicitly state whether it reads from the bet or the game.

**Recommended fix**:
- Enforce in code that the settlement processor ONLY reads `platformFeePercent` from the `Bet` row, NEVER from the `Game` row.
- Add a database trigger or application-level validation that prevents `platformFeePercent` on a Bet from being updated after creation.
- Consider making `platformFeePercent` on the Bet an immutable field (remove it from any update operations in the Prisma client).

### 2.5 MEDIUM: Idempotency Key Collision for Settlement Steps

**Severity**: Medium

**Attack scenario**:
1. Settlement uses deterministic idempotency keys: `settle_{betId}_fee`, `settle_{betId}_release`.
2. These keys are predictable. If an attacker can somehow inject a transaction with key `settle_{betId}_fee` before the settlement processor runs (e.g., via a timing attack or SQL injection elsewhere), the settlement processor will skip the fee step, thinking it already completed.

**Current mitigation**: The settlement processor is an internal-only background job with no HTTP exposure. The idempotency key format uses `{betId}` which is a UUID, making prediction difficult without knowledge of the bet ID.

**Recommended fix**:
- Add a random nonce to settlement idempotency keys: `settle_{betId}_{nonce}_{step}`, where the nonce is generated when the settlement begins and used consistently across all steps within the same settlement attempt.
- Alternatively, since all settlement steps happen in a single transaction, idempotency at the step level may be unnecessary. A single idempotency key `settle_{betId}` for the entire atomic operation is simpler and less error-prone.

### 2.6 MEDIUM: TOCTOU in Withdrawal Balance Check

**Severity**: Medium

**Attack scenario**:
1. Player has $100 balance and one bet in `RESULT_REPORTED` (about to settle, making them the winner of $95 more).
2. Player requests withdrawal of $100.
3. The withdrawal endpoint checks `balance >= amount` and proceeds.
4. Simultaneously, a bet escrow debit happens for a bet the player accepted.
5. If the withdrawal and escrow debit are not serialized, both could read $100 and both succeed.

**Current mitigation**: Both operations use `UPDATE ... WHERE balance >= $amount` on the same `PLAYER_BALANCE` row. PostgreSQL row-level locking serializes these correctly.

**Residual risk**: If ANY code path performs the balance check as a separate SELECT before the UPDATE (perhaps for a user-friendly error message with the current balance), the TOCTOU gap exists.

**Recommended fix**:
- Audit all code paths that touch `PLAYER_BALANCE` to confirm they use the atomic UPDATE pattern without any preceding SELECT for the balance.
- The 402 error response currently includes `available: 1500` -- this means the code likely does a SELECT to get the current balance for the error message. This SELECT must happen AFTER the UPDATE fails (i.e., when UPDATE returns zero rows), not before.

---

## 3. Game Developer API Attack Surface

### 3.1 CRITICAL: Malicious Game Developer Can Report False Results to Steal Funds

This is documented in detail in Section 2.1 above. Additional attack vectors specific to the developer API:

**Attack scenario (expanded)**:
1. Developer creates a game, gets it approved.
2. Developer uses the widget auth flow to create bets between real players.
3. Developer reports results that always favor a specific player (their accomplice).
4. The accomplice withdraws winnings. Developer receives rev-share on the volume.
5. Combined theft rate: the accomplice wins all bets, developer gets rev-share on all volume.

**Additional recommended fix**:
- Implement a mandatory hold period on developer rev-share payouts (e.g., 30 days) to allow for dispute resolution and anomaly detection before funds leave the platform.
- Require game developers to post a security bond that can be seized if fraud is detected.

### 3.2 CRITICAL: Developer Can Create Bets on Behalf of Players Without Consent

**Severity**: Critical

**Attack scenario**:
1. `POST /api/v1/bets` accepts `playerAId` directly in the request body.
2. The game server (authenticated with API key) can specify any player's ID.
3. There is no documented verification that Player A has consented to this specific bet.
4. A malicious developer can create a bet for Player A ($1000), then accept it as Player B (an accomplice), report Player B as the winner, and drain Player A's balance.
5. Player A never interacted with the game, or never agreed to a $1000 wager.

**Current mitigation**: The widget auth flow is intended to ensure the player is authenticated, and the widget token is scoped to one player + one game. However, `POST /api/v1/bets` is authenticated via API key (not widget token), meaning the game SERVER creates bets, not the player directly.

**Recommended fix**:
- Bet creation via the developer API should require proof of player consent. Options:
  a. **Widget-only bet creation**: Require that bet creation flows through the widget (authenticated by the player's widget token), not the developer API key. The developer API would only handle result reporting.
  b. **Player consent token**: When a player agrees to a bet in the game UI, the widget generates a short-lived, single-use consent token that the game server must include in the `POST /api/v1/bets` request.
  c. **Player confirmation step**: After the developer API creates a bet, the player must confirm it via the widget before escrow is taken. The bet enters a `PENDING_CONSENT` state before `OPEN`.
- Option (c) is the most pragmatic: it does not require redesigning the API but adds a critical authorization check. Escrow is NOT taken until the player confirms.

### 3.3 HIGH: API Key Theft Enables Full Account Takeover of Developer's Games

**Severity**: High

**Attack scenario**:
1. Developer's API key (`ps_live_...`) is leaked (committed to a public repo, stolen from server logs, intercepted in transit).
2. Attacker uses the key to report false results on all active bets for the developer's games.
3. Attacker can also create bets on behalf of players (see 3.2).
4. Since the key has `result:report` permission, the attacker controls all payouts.

**Current mitigation**: Keys are SHA-256 hashed in storage (good). Keys have granular permissions (good). Rate limit of 1000 req/min (insufficient -- an attacker can do significant damage within the rate limit).

**Recommended fix**:
- **IP allowlisting**: Allow developers to restrict API key usage to specific IP addresses or CIDR ranges. Store allowed IPs in the `ApiKey` model.
- **Key rotation alerts**: Notify developers when an API key is used from a new IP for the first time.
- **Lower rate limits for sensitive operations**: `result:report` should have a separate, much lower rate limit (e.g., 10 per minute) since result reporting should roughly match the pace of actual games.
- **Anomaly detection**: Alert if a key reports more results in an hour than the game's historical average by a significant margin.
- **Mandatory key expiration**: API keys should have a maximum lifetime (e.g., 1 year) with advance notification to rotate.

### 3.4 HIGH: Developer Can Report Results for Bets Created by Other Developers

This is documented in detail in Section 2.2 above. Adding it here for completeness as it is a developer API authorization gap.

### 3.5 HIGH: No SSRF Protection on Webhook URL Registration

**Severity**: High

**Attack scenario**:
1. Developer registers a game with `webhookUrl` set to `http://169.254.169.254/latest/meta-data/` (AWS metadata endpoint) or `http://localhost:6379/` (Redis).
2. PlayStake's webhook delivery worker sends HTTP POST requests to this URL.
3. The response body is stored in `WebhookDeliveryLog.responseBody`.
4. Developer views the delivery log via `GET /api/v1/webhooks/:id/deliveries` and reads the response, which now contains AWS credentials or Redis data.

**Current mitigation**: None documented. The webhook URL is a `VarChar(500)` with no validation beyond format.

**Recommended fix**:
- Validate webhook URLs against a blocklist of private IP ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `127.0.0.0/8`, `fd00::/8`, `::1`.
- Resolve the hostname to an IP BEFORE making the request and check the resolved IP against the blocklist (prevents DNS rebinding).
- Require `https://` for webhook URLs (reject `http://`).
- Do NOT store the response body in `WebhookDeliveryLog` or at minimum truncate/sanitize it. The response body from an external server is untrusted data.
- Set a maximum response body size (e.g., 1KB) to prevent the developer from using PlayStake as a proxy to exfiltrate large payloads.

### 3.6 MEDIUM: Webhook Replay Attacks Against Game Developers

**Severity**: Medium

**Attack scenario**:
1. Attacker intercepts a webhook payload (e.g., `BET_SETTLED`) sent from PlayStake to the game developer.
2. Attacker replays the webhook to the developer's endpoint.
3. If the developer does not implement timestamp checking, they process the event twice.

**Current mitigation**: The outbound webhook includes a timestamp in the signature (`t=<timestamp>`), and the documentation says developers should "reject if t is more than 5 minutes old." However, this is guidance to the developer, not enforcement by PlayStake.

**Recommended fix**:
- Include a unique `deliveryId` in the webhook payload and recommend developers use it for idempotency.
- Provide a webhook verification SDK/library that handles signature verification, timestamp checking, and replay detection out of the box.
- Add the `X-PlayStake-Delivery` header (already specified) and emphasize it in developer documentation as an idempotency key.

### 3.7 MEDIUM: API Key Scope Escalation via Developer Portal

**Severity**: Medium

**Attack scenario**:
1. Developer creates an API key with permissions `["bet:read"]`.
2. Developer modifies the key's permissions via the developer portal or API to add `result:report`.
3. If the permission update does not require re-authentication or admin approval, a compromised developer portal session can escalate permissions on existing keys.

**Current mitigation**: The `POST /api/developer/api-keys` endpoint accepts a `permissions` array. The `PATCH` endpoint for keys is not documented (only `DELETE` is), which suggests permissions may be immutable after creation (good if true).

**Recommended fix**:
- API key permissions MUST be immutable after creation. To change permissions, revoke the old key and create a new one.
- Document this explicitly in the developer guide.
- If permission modification is allowed, require the developer's password or 2FA code to confirm the change.

### 3.8 LOW: Missing Maximum Bet Duration Enforcement

**Severity**: Low

**Attack scenario**:
1. Developer creates a bet with `expiresInSeconds: 3600` (1 hour).
2. Bet is accepted (status = `MATCHED`).
3. The game never reports a result. Funds remain in escrow indefinitely.
4. While a background job escalates after 24 hours, this is a long time for funds to be locked.

**Current mitigation**: The stuck-bet monitor worker alerts on bets in `MATCHED` for more than 24 hours.

**Recommended fix**:
- Add a `matchDeadline` field (e.g., `matchedAt + 4 hours`) after which the bet auto-voids if no result is reported.
- The deadline should be configurable per game but have a platform-enforced maximum (e.g., 24 hours).

---

## 4. Widget Authentication Attacks

### 4.1 HIGH: Widget Token Passed in URL is Vulnerable to Leakage

**Severity**: High

**Attack scenario**:
1. The widget auth flow (Section 7 of system architecture) shows the token passed as a URL parameter: `src="https://widget.playstake.com?token=wt_...&gameId=..."`.
2. URL parameters are logged in server access logs, browser history, referrer headers, and potentially proxies.
3. A malicious game developer can read the token from their own server logs (the game page's referrer is sent to any external resources loaded by the widget page).
4. The token gives access to create and accept bets on behalf of the player.

**Current mitigation**: Widget tokens have a 1-hour TTL and are scoped to one game + one player. Only one active token per player per game (new request revokes the previous one).

**Recommended fix**:
- Do NOT pass the token as a URL parameter. Instead:
  a. The game client passes the token to the widget iframe via `postMessage` after the iframe loads.
  b. The iframe loads with only `gameId` in the URL, then listens for the token via `postMessage` from the verified parent origin.
- Set `Referrer-Policy: no-referrer` on the widget iframe to prevent token leakage via referrer headers.
- Reduce widget token TTL to 15 minutes (sufficient for a game session) with a refresh mechanism.

### 4.2 HIGH: Malicious Game Can Inject Fake Widget to Steal Player Actions

**Severity**: High

**Attack scenario**:
1. A malicious game developer registers a legitimate-seeming game.
2. Instead of embedding the real PlayStake widget iframe, they create a pixel-perfect replica that captures the player's interactions.
3. The fake widget shows a $5 bet to the player but submits a $500 bet via the API.
4. Since the game server holds the API key and the widget token, the player has no way to verify the bet parameters.

**Current mitigation**: The widget is served from `widget.playstake.com` as an iframe, which provides origin isolation. The CSP `frame-ancestors` directive restricts where the widget can be embedded.

**Residual risk**: The player trusts what they see in the game. If the game developer controls both the game UI and the decision to embed the real widget or a fake one, CSP only ensures the real widget runs on PlayStake's domain -- it does not prevent the game from showing a fake UI alongside or instead of the real one.

**Recommended fix**:
- The widget should display a PlayStake-branded "trust indicator" that cannot be replicated (e.g., showing the player's display name and a unique session color/icon).
- All bet creation via the widget should require a player confirmation step WITHIN the PlayStake iframe (e.g., "You are about to bet $25 on Battle Royale X. Confirm?"). This confirmation happens in PlayStake's origin, not the game's.
- Consider requiring players to set a "verification phrase" during account setup that is shown in the widget to prove authenticity.
- The widget should clearly display the bet amount and opponent before any funds are escrowed.

### 4.3 MEDIUM: Session Fixation via Widget Token Pre-Generation

**Severity**: Medium

**Attack scenario**:
1. Attacker obtains a valid widget token for a victim player (e.g., via the URL leakage in 4.1).
2. Attacker opens the widget in their own browser with the stolen token.
3. Attacker creates bets on behalf of the victim.

**Current mitigation**: Widget tokens are scoped to one player + one game, and "Max 1 active token per player per game (new request revokes the previous one)."

**Residual risk**: If the attacker uses the token before the legitimate player, and the legitimate player's game session requests a new token (revoking the attacker's), the attack window is short. However, if the attacker acts first, they can create and accept bets before revocation.

**Recommended fix**:
- Bind the widget token to the requesting IP address. The `WidgetSession` model already has an `ipAddress` field. Enforce that widget API requests come from the same IP that was recorded when the token was issued.
- Add device fingerprinting as a secondary signal (User-Agent binding at minimum).
- Rate limit bet creation per widget token (e.g., max 3 bets per token lifetime).

### 4.4 MEDIUM: Widget iframe Communication Can Be Intercepted by Malicious Game

**Severity**: Medium

**Attack scenario**:
1. The widget communicates with the host game via `postMessage`.
2. The game registers a `message` event listener on the widget iframe's window.
3. While `postMessage` with strict origin checking prevents the game from sending messages as the widget, the game CAN listen to all messages the widget sends (since the game controls the parent frame).
4. If the widget sends sensitive data (balance, bet details, transaction IDs) via postMessage, the game can capture it.

**Current mitigation**: The architecture mentions "Communication between the game and widget uses postMessage with strict origin checking."

**Recommended fix**:
- Minimize the data sent via `postMessage` from the widget to the game. Only send non-sensitive event notifications (e.g., "bet_created", "bet_accepted") without financial details.
- Never send tokens, balances, or transaction IDs via `postMessage`.
- Document the `postMessage` API contract and what data is exposed to the game.

---

## 5. General Financial Security

### 5.1 CRITICAL: No Minimum or Validation on Decimal Precision for Bet Amounts

**Severity**: Critical (downgraded to High if API-layer validation is thorough)

**Attack scenario**:
1. The API documentation says amounts are in cents (integers), but the database stores `Decimal(12, 2)`.
2. If the API-to-database conversion has a bug, or if a developer bypasses the API layer (e.g., via direct database access in a worker), fractional cents could be introduced.
3. Repeated rounding in fee calculations (`feeAmount = totalPot * platformFeePercent`) could cause penny-shaving: each settlement rounds down by a fraction of a cent, and the cumulative loss accrues to the platform or to players.
4. Over millions of settlements, this can add up to significant amounts.

**Current mitigation**: The API layer converts cents (integers) to `Decimal(14, 2)` for storage. The fee percentage is `Decimal(5, 4)` allowing precision like 0.0500 (5%).

**Recommended fix**:
- All fee calculations must use `Decimal` arithmetic with explicit rounding rules. Document whether rounding is ROUND_HALF_UP, ROUND_DOWN, or ROUND_CEILING, and who absorbs rounding differences.
- Add a database constraint: `CHECK (amount = ROUND(amount, 2))` on `ledger_entries` and `transactions` to prevent sub-cent amounts.
- The `money.ts` utility file should enforce that all monetary operations go through a single set of functions that handle rounding consistently.
- Add a "rounding account" to the ledger that absorbs rounding differences, keeping the double-entry invariant intact.

### 5.2 HIGH: Negative Amount Attacks

**Severity**: High

**Attack scenario**:
1. Attacker sends `POST /api/v1/bets` with `"amount": -2500`.
2. If negative amounts are not rejected, the escrow logic runs: debit PLAYER_BALANCE by -2500 (which is a credit of 2500) and credit ESCROW by -2500 (which is a debit of 2500).
3. The player gains $25 in their balance and the escrow has -$25.
4. The player cancels the bet, triggering a refund: debit ESCROW by -(-2500) and credit PLAYER_BALANCE.
5. Depending on how the math works, the player could end up with more money than they started with.

**Current mitigation**: The API specifies `min 500 ($5)` for deposits and game-level `minBetAmount`. If these validations are properly enforced on the API layer, negative amounts are rejected.

**Recommended fix**:
- Add database-level constraints: `CHECK (amount > 0)` on `bets.amount` and `transactions.amount`.
- Add Zod schema validation on every API endpoint that accepts an amount: `z.number().int().positive().min(1)`.
- The `LedgerEntry.amount` field legitimately uses negative values (debits), so the constraint there should be different: ensure that for any transaction, the entries sum to exactly zero.
- Test explicitly with negative, zero, and extremely large amounts in the integration test suite.

### 5.3 HIGH: Self-Betting for Money Laundering or Exploit Extraction

**Severity**: High

**Attack scenario (money laundering)**:
1. Player creates Account A and Account B with different emails.
2. Player deposits dirty funds into Account A via Stripe.
3. Player creates a bet from Account A, accepts from Account B.
4. Reports Account B as winner. Account B now holds the funds minus the platform fee.
5. Account B withdraws "clean" winnings.
6. The 5% platform fee is the "laundering cost."

**Attack scenario (exploit extraction)**:
1. If a player finds any exploit that gives them an inflated balance (e.g., via the negative amount attack above), they create a bet against themselves, transfer the illicit funds to the other account, and withdraw from the "clean" account.

**Current mitigation**: The `POST /api/v1/bets/:betId/accept` endpoint rejects `playerBId same as playerAId`. However, this only checks if the two player IDs are identical, not if they are controlled by the same person.

**Recommended fix**:
- Flag and manually review when the same IP address, device fingerprint, or payment method is used by both players in a bet.
- Implement velocity checks: if Account A and Account B consistently bet against each other, flag for review.
- Cross-reference Stripe customer IDs: if two accounts use the same bank account or card, flag as potential sybil.
- Require KYC verification above a cumulative threshold (this is partially in place for withdrawals > $500/week but should also apply to betting volume).
- Track IP addresses at bet creation and acceptance time. Alert on matches.

### 5.4 MEDIUM: Denial-of-Service via Mass Bet Creation to Lock Up Escrow

**Severity**: Medium

**Attack scenario**:
1. Attacker deposits $1,000 and creates 100 bets of $10 each with very long expiry times (3600 seconds).
2. These bets are visible to other players.
3. When real players accept these bets, the attacker's game server never reports a result.
4. $2,000 ($1,000 from attacker + $1,000 from victims) is locked in escrow for up to 24 hours (until the stuck-bet monitor triggers).
5. Repeat at scale to lock up significant platform liquidity.

**Current mitigation**: Games have `maxBetAmount`. The stuck-bet monitor alerts after 24 hours. Bets auto-cancel if not matched by `expiresAt`.

**Recommended fix**:
- Limit concurrent OPEN bets per player (already recommended in 1.5).
- Limit concurrent MATCHED bets per player (e.g., 5 at a time).
- Require a higher deposit-to-bet ratio for new accounts (e.g., first 30 days: max 3 concurrent bets).
- Implement a "developer reliability score" that degrades if their game frequently fails to report results, automatically reducing the game's bet limits.
- Reduce the stuck-bet timeout to 4-6 hours for auto-voiding (rather than just alerting at 24 hours).

### 5.5 MEDIUM: Integer Overflow in Cents Representation

**Severity**: Medium

**Attack scenario**:
1. JavaScript uses 64-bit floating-point for all numbers. Safe integer range is `Number.MAX_SAFE_INTEGER` = 2^53 - 1 = 9,007,199,254,740,991 cents = ~$90 trillion.
2. The database uses `Decimal(14, 2)` which caps at 999,999,999,999.99 = ~$10 trillion.
3. Overflow is unlikely in normal operation but could be triggered by repeated ADJUSTMENT transactions or a bug in the settlement calculator.

**Current mitigation**: The use of `Decimal` in PostgreSQL prevents floating-point precision issues at the database level. JavaScript's handling of cents as integers is safe for realistic amounts.

**Recommended fix**:
- Add database constraints: `CHECK (balance <= 10000000)` on `PLAYER_BALANCE` accounts (no player should have more than $100K).
- Add application-level sanity checks: reject any single transaction above $10,000 (or whatever the platform's maximum supported amount is).
- Use a BigInt or Decimal library (e.g., `decimal.js`) in Node.js for all monetary arithmetic, never native JavaScript arithmetic on amounts that could exceed safe integer range.

### 5.6 MEDIUM: Insufficient Withdrawal Controls Enable Rapid Fund Extraction

**Severity**: Medium

**Attack scenario**:
1. Attacker compromises a player account with a large balance.
2. Attacker requests 3 withdrawals (the daily max) of the maximum amount.
3. Before the player notices, funds are on the way to the attacker's bank via Stripe.

**Current mitigation**: Rate limit of 3 withdrawals per day. KYC required for > $500/week. Email verification required.

**Recommended fix**:
- Send a notification (email and/or push) on every withdrawal request with a cancel link (e.g., 5-minute delay before Stripe payout is initiated).
- Require 2FA for withdrawals above a threshold (e.g., $100).
- Implement a cooling-off period after password changes (no withdrawals for 24 hours).
- Add a suspicious login detection: if a withdrawal is requested from a new IP or device, require re-authentication.

### 5.7 LOW: Insufficient Error Message Exposure in Balance Checks

**Severity**: Low

**Attack scenario**:
1. The 402 error response includes `{ available: 1500, required: 2500 }`.
2. An attacker probing the system can use this to enumerate a player's exact balance by submitting bet creation requests with different amounts.

**Current mitigation**: Bet creation requires the game server's API key, so only the game developer can probe balances.

**Recommended fix**:
- Return a generic "Insufficient funds" error without revealing the exact available balance in developer API responses.
- The player-facing API can show the balance since the player already has access via `GET /api/wallet/balance`.

### 5.8 LOW: No Cooling-Off or Self-Exclusion Mechanism

**Severity**: Low (from a security perspective; High from a regulatory/compliance perspective)

**Attack scenario**: Not a traditional security attack, but a regulatory risk. Gambling platforms in most jurisdictions are required to offer self-exclusion tools. Absence of this feature could result in regulatory action or platform shutdown.

**Recommended fix**:
- Implement a `selfExcludedUntil` field on the User model.
- Allow players to self-exclude for configurable periods (24 hours, 7 days, 30 days, permanent).
- During self-exclusion, reject all bet creation and acceptance. Allow withdrawals.
- Self-exclusion cannot be reversed before the period expires (even by the player).

### 5.9 LOW: Admin Panel Lacks Audit Trail and Access Controls

**Severity**: Low (could be High depending on admin capabilities)

**Attack scenario**:
1. Admin resolves a dispute in favor of Player A (their accomplice).
2. There is no record of which admin took the action or what justification was provided (the `resolvedById` field exists but there is no documented approval workflow).
3. The admin manipulates dispute outcomes to extract funds.

**Current mitigation**: The `Dispute` model has `resolvedById` and `resolution` text fields.

**Recommended fix**:
- Create a dedicated `AdminAuditLog` table that records every admin action (dispute resolution, account freezing, ADJUSTMENT transactions, user role changes) with timestamp, IP address, and justification.
- Require dual-admin approval for actions that move money (dispute resolution with payout, ADJUSTMENT transactions).
- Admin sessions should have shorter TTLs (1 hour) and require 2FA.

### 5.10 LOW: Potential Timing Side-Channel in API Key Lookup

**Severity**: Low

**Attack scenario**:
1. API key lookup hashes the incoming bearer token and queries the database for the hash.
2. If the database lookup time varies based on whether the hash exists, an attacker could use timing analysis to determine if a guessed key prefix is close to a valid hash.

**Current mitigation**: The key is 32 bytes of `crypto.randomBytes` (256 bits of entropy), making brute-force infeasible regardless of timing leakage.

**Recommended fix**:
- No immediate action needed due to sufficient entropy.
- For defense-in-depth, add a constant-time comparison fallback and ensure the database lookup uses an index (already done with `idx_apikey_hash`).

---

## 6. Additional Architecture-Level Concerns

### 6.1 MEDIUM: Single Point of Failure in Settlement Processor

**Severity**: Medium

If the settlement processor crashes or is unavailable, bets accumulate in `RESULT_REPORTED` status and no payouts occur. Players see increasing delays.

**Recommended fix**:
- Deploy the settlement worker with at least 2 replicas.
- The advisory lock mechanism already prevents double-processing, so multiple workers are safe.
- Add a monitoring alert for settlement lag (already documented, but make the critical threshold lower: > 5 minutes).

### 6.2 MEDIUM: No CSRF Protection Documented for Session-Cookie Endpoints

**Severity**: Medium

**Attack scenario**:
1. Player is logged into PlayStake with a session cookie (`sameSite=lax`).
2. `sameSite=lax` sends cookies on top-level navigations (GET) but NOT on cross-origin POST requests.
3. However, if any state-changing operation uses GET (e.g., due to a misconfigured route), it is vulnerable to CSRF.

**Current mitigation**: `sameSite=lax` on the session cookie. All mutating operations appear to use POST/PATCH/DELETE.

**Recommended fix**:
- Add explicit CSRF token protection (e.g., double-submit cookie pattern or synchronizer token) for all state-changing endpoints.
- Verify that no mutating operation uses GET method.
- Consider upgrading to `sameSite=strict` if the login flow supports it (may break some redirect flows).

### 6.3 MEDIUM: Account Linking Flow May Be Vulnerable to OAuth-Style Attacks

**Severity**: Medium

The player account linking flow (Section 7) describes an OAuth-like flow where the game server exchanges a one-time authorization code for a permanent `playerId` mapping.

**Attack scenario**:
1. Attacker initiates the linking flow and captures the authorization code from the redirect URL.
2. Attacker replays the code or performs a CSRF attack to link the victim's PlayStake account to the attacker's game account.

**Recommended fix**:
- Use a `state` parameter (CSRF protection) in the authorization flow, exactly as OAuth 2.0 specifies.
- Authorization codes must be single-use and short-lived (< 5 minutes).
- Bind the code to the session that initiated the flow.
- Use PKCE (Proof Key for Code Exchange) to prevent authorization code interception.

---

## 7. Prioritized Remediation Roadmap

### Immediate (Before Launch)

| # | Finding | Severity | Section |
|---|---------|----------|---------|
| 1 | Game developer can report false results | Critical | 2.1, 3.1 |
| 2 | Developer can create bets without player consent | Critical | 3.2 |
| 3 | No cross-developer authorization check on result reporting | Critical | 2.2 |
| 4 | Add CHECK constraint for non-negative balances | Critical | 1.1 |
| 5 | Negative amount validation at API and database layers | High | 5.2 |
| 6 | SSRF protection on webhook URLs | High | 3.5 |
| 7 | Widget token not passed in URL | High | 4.1 |
| 8 | Self-betting and sybil detection | High | 5.3 |

### Before Public Beta

| # | Finding | Severity | Section |
|---|---------|----------|---------|
| 9 | Dual-admin authorization for ADJUSTMENT transactions | Medium | 1.4 |
| 10 | Per-player concurrent bet and escrow limits | Medium | 1.5 |
| 11 | Platform fee must read from Bet snapshot, not Game | High | 2.4 |
| 12 | Dispute-on-settled-bet must not auto-reverse payouts | High | 2.3 |
| 13 | API key IP allowlisting | High | 3.3 |
| 14 | Fake widget protection (player confirmation in iframe) | High | 4.2 |
| 15 | Fee rounding strategy and rounding account | Critical* | 5.1 |
| 16 | CSRF protection for session-cookie endpoints | Medium | 6.2 |
| 17 | Account linking CSRF/PKCE protection | Medium | 6.3 |

### Post-Launch Hardening

| # | Finding | Severity | Section |
|---|---------|----------|---------|
| 18 | Withdrawal notification and cooling-off periods | Medium | 5.6 |
| 19 | Self-exclusion mechanism | Low/Regulatory | 5.8 |
| 20 | Admin audit trail and dual-approval | Low | 5.9 |
| 21 | Statistical anomaly detection for developers | High | 2.1 |
| 22 | Settlement worker redundancy | Medium | 6.1 |
| 23 | Match deadline for auto-void of stuck bets | Low | 3.8 |
| 24 | API key immutable permissions | Medium | 3.7 |
| 25 | Widget postMessage data minimization | Medium | 4.4 |

---

## 8. Positive Security Observations

The architecture gets several things right that should be preserved:

1. **Double-entry ledger**: The accounting model is sound. Every money movement creates two entries that sum to zero. This is the gold standard for financial systems.

2. **Atomic balance checks**: The `UPDATE ... WHERE balance >= $amount` pattern is the correct way to prevent overdrafts under concurrent access. Do not change this to a SELECT-then-UPDATE pattern.

3. **Idempotency everywhere**: Every mutating endpoint accepts an idempotency key. The `Transaction.idempotencyKey` unique constraint prevents double-processing. This is critical for a financial system.

4. **Hashed secret storage**: API keys, session tokens, and widget tokens are all SHA-256 hashed before storage. The raw values are returned once and never stored.

5. **Per-bet escrow accounts**: Each bet gets its own escrow account rather than a shared pool. This makes auditing simpler and prevents cross-bet contamination.

6. **Ledger integrity checker**: The daily reconciliation job that verifies all invariants is an excellent safety net. Consider running it more frequently (every hour) during the early launch period.

7. **Webhook signature verification**: Both inbound (Stripe) and outbound (to developers) webhooks use HMAC signatures with timestamp-based replay protection.

8. **Balance never cached**: The explicit decision to never cache player balances avoids a large class of consistency bugs.

---

*End of security review. All findings should be tracked in the issue tracker and assigned to responsible engineers with target completion dates.*
