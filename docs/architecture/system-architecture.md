# PlayStake System Architecture

## 1. High-Level Overview

```
+-------------------+       +-------------------+       +-------------------+
|                   |       |                   |       |                   |
|  PlayStake        |       |  Developer API    |       |  In-Game Widget   |
|  Website (Next.js)|       |  /api/v1/...      |       |  (iframe/JS SDK)  |
|                   |       |                   |       |                   |
+--------+----------+       +--------+----------+       +--------+----------+
         |                           |                           |
         |  Session Cookie           |  API Key (Bearer)         |  Widget Token
         |                           |                           |
+--------v---------------------------v---------------------------v----------+
|                                                                           |
|                        Next.js App Router (API Routes)                    |
|                        Node.js Runtime                                    |
|                                                                           |
+-----+----------------+----------------+----------------+-----------------+
      |                |                |                |
      v                v                v                v
+----------+   +-------------+   +----------+   +----------------+
| Prisma   |   | BullMQ /    |   | Stripe   |   | Redis          |
| ORM      |   | pg-boss     |   | SDK      |   | (rate limits,  |
|          |   | Job Queue   |   |          |   |  sessions,     |
+----+-----+   +------+------+   +----+-----+   |  cache)        |
     |                |               |          +----------------+
     v                v               v
+----+----------------+---------------+-----+
|                                           |
|              PostgreSQL                   |
|              (Primary DB)                 |
|                                           |
+-------------------------------------------+
```

### Separation of Concerns

| Layer | Responsibility | Auth Mechanism |
|-------|---------------|----------------|
| **Website Frontend** | Player-facing UI: auth, wallet, bet history, dashboard | Session cookie (httpOnly, secure) |
| **Developer Portal** | Game registration, API key management, analytics | Session cookie + `role = DEVELOPER` |
| **Developer API** | Game server integration: bet CRUD, result reporting | API key (Bearer token, SHA-256 hashed) |
| **Widget** | In-game UI for players to create/accept bets | Widget token (short-lived, scoped) |
| **Payout Engine** | Settlement, escrow management, fee calculation | Internal only, no HTTP exposure |
| **Webhook System** | Outbound notifications to game developers | HMAC-SHA256 signed payloads |

---

## 2. Request Flow Diagrams

### 2.1 Deposit Flow

```
Player                Website              Stripe               Database
  |                     |                    |                     |
  |  1. POST /api/wallet/deposit             |                     |
  |  { amount: 5000, idempotencyKey }        |                     |
  |------------------->|                     |                     |
  |                     |                    |                     |
  |                     |  2. Create PENDING Transaction           |
  |                     |  (type=DEPOSIT, status=PENDING)          |
  |                     |------------------------------------------->
  |                     |                    |                     |
  |                     |  3. Create PaymentIntent                 |
  |                     |  (amount=5000, idempotency_key)          |
  |                     |------------------->|                     |
  |                     |                    |                     |
  |                     |  4. Return client_secret                 |
  |                     |<-------------------|                     |
  |                     |                    |                     |
  |  5. Return { transactionId, stripeClientSecret }               |
  |<--------------------|                    |                     |
  |                     |                    |                     |
  |  6. Stripe.js confirms payment           |                     |
  |  (card details never touch our server)   |                     |
  |------------------------------------->--->|                     |
  |                     |                    |                     |
  |                     |  7. Webhook: payment_intent.succeeded    |
  |                     |<-------------------|                     |
  |                     |                    |                     |
  |                     |  8. Verify signature, check idempotency  |
  |                     |  9. In DB transaction:                   |
  |                     |     - Mark Transaction COMPLETED         |
  |                     |     - Create LedgerEntry: debit STRIPE_SOURCE -5000
  |                     |     - Create LedgerEntry: credit PLAYER_BALANCE +5000
  |                     |     - Update PLAYER_BALANCE.balance      |
  |                     |------------------------------------------->
  |                     |                    |                     |
  |  10. Balance updated (visible on next refresh/websocket push)  |
  |<--------------------|                    |                     |
```

### 2.2 Complete Bet Lifecycle

```
Game Server       Widget (Player)      Developer API          Database             Payout Engine
  |                    |                    |                     |                     |
  |  === PHASE 1: PROPOSE (no escrow yet) ===                    |                     |
  |                    |                    |                     |                     |
  |  1. POST /api/v1/bets                  |                     |                     |
  |  { playerAId, amount: 2500,            |                     |                     |
  |    gameId, idempotencyKey }            |                     |                     |
  |--------------------------------------->|                     |                     |
  |                    |                    |                     |                     |
  |                    |                    |  2. Validate:                             |
  |                    |                    |     - API key owns gameId (cross-dev)     |
  |                    |                    |     - amount within game min/max          |
  |                    |                    |     - dev escrow cap not exceeded         |
  |                    |                    |  3. Create Bet (status=PENDING_CONSENT)   |
  |                    |                    |     NO escrow, NO balance debit           |
  |                    |                    |-------------------------------------------->
  |                    |                    |                     |                     |
  |  4. Response 201 { status: PENDING_CONSENT }                 |                     |
  |<---------------------------------------|                     |                     |
  |                    |                    |                     |                     |
  |  === PHASE 1b: PLAYER CONSENT (escrow happens here) ===     |                     |
  |                    |                    |                     |                     |
  |  5. Game passes betId to widget        |                     |                     |
  |---> postMessage -->|                   |                     |                     |
  |                    |                    |                     |                     |
  |                    |  6. POST /api/v1/bets/:betId/consent    |                     |
  |                    |  (Widget Token auth — proves it's       |                     |
  |                    |   the actual player, not the server)    |                     |
  |                    |------>------------>|                     |                     |
  |                    |                    |                     |                     |
  |                    |                    |  7. DB Transaction:                       |
  |                    |                    |     a. Bet status = OPEN                  |
  |                    |                    |     b. Create ESCROW LedgerAccount        |
  |                    |                    |     c. BET_ESCROW: PLAYER_A -2500         |
  |                    |                    |     d. LedgerEntry: ESCROW +2500          |
  |                    |                    |     e. DeveloperEscrowLimit += 2500       |
  |                    |                    |-------------------------------------------->
  |                    |                    |                     |                     |
  |                    |  8. Response 200 { status: OPEN }       |                     |
  |                    |<------|------------|                     |                     |
  |                    |                    |                     |                     |
  |  === PHASE 2: MATCH (Player B accepts via widget) ===       |                     |
  |                    |                    |                     |                     |
  |                    |  9. POST /api/v1/bets/:betId/accept     |                     |
  |                    |  (Widget Token — Player B identified    |                     |
  |                    |   from token, NOT from request body)    |                     |
  |                    |------>------------>|                     |                     |
  |                    |                    |                     |                     |
  |                    |                    |  10. Validate:                            |
  |                    |                    |      - playerB != playerA (DB constraint) |
  |                    |                    |      - Player B balance >= amount         |
  |                    |                    |      - Dev escrow cap not exceeded        |
  |                    |                    |  11. DB Transaction:                      |
  |                    |                    |      a. Bet.playerBId = playerB           |
  |                    |                    |      b. Bet.status = MATCHED              |
  |                    |                    |      c. BET_ESCROW: PLAYER_B -2500        |
  |                    |                    |      d. ESCROW +2500 (total now 5000)     |
  |                    |                    |      e. DeveloperEscrowLimit += 2500      |
  |                    |                    |-------------------------------------------->
  |                    |                    |                     |                     |
  |  12. Webhook: BET_MATCHED              |                     |                     |
  |<- - - - - - - - - - - - - - - - - - - |                     |                     |
  |                    |                    |                     |                     |
  |  === PHASE 3: PLAY (happens in-game) ===                    |                     |
  |                    |                    |                     |                     |
  |  === PHASE 4: RESULT (dual-source verification) ===         |                     |
  |                    |                    |                     |                     |
  |  13. POST /api/v1/bets/:betId/result   |                     |                     |
  |  { outcome: PLAYER_A_WIN }             |                     |                     |
  |--------------------------------------->|                     |                     |
  |                    |                    |                     |                     |
  |                    |                    |  14. Validate:                            |
  |                    |                    |      - API key owns this game             |
  |                    |                    |      - Bet status = MATCHED               |
  |                    |                    |  15. Store serverResultHash               |
  |                    |                    |      status = RESULT_REPORTED             |
  |                    |                    |-------------------------------------------->
  |                    |                    |                     |                     |
  |                    |  16. POST /api/v1/bets/:betId/widget-result                   |
  |                    |  { outcome: PLAYER_A_WIN }              |                     |
  |                    |  (Widget Token — second witness)        |                     |
  |                    |------>------------>|                     |                     |
  |                    |                    |                     |                     |
  |                    |                    |  17. Compare hashes:                      |
  |                    |                    |      serverResultHash == widgetResultHash? |
  |                    |                    |      YES: resultVerified = true            |
  |                    |                    |      NO: auto-DISPUTED + anomaly alert    |
  |                    |                    |-------------------------------------------->
  |                    |                    |                     |                     |
  |  === PHASE 5: SETTLEMENT (2 min after verification) ===     |                     |
  |                    |                    |                     |                     |
  |                    |                    |                     |  18. Settlement job  |
  |                    |                    |                     |  (only if verified)  |
  |                    |                    |                     |<--------------------|
  |                    |                    |                     |                     |
  |                    |                    |                     |  19. In DB Txn:     |
  |                    |                    |                     |  a. BEGIN + lock bet |
  |                    |                    |                     |  b. Verify ESCROW=  |
  |                    |                    |                     |     5000 (expected)  |
  |                    |                    |                     |  c. fee=ROUND(5000* |
  |                    |                    |                     |     0.05,2) = 250   |
  |                    |                    |                     |  d. PLATFORM_FEE    |
  |                    |                    |                     |     ESCROW -250     |
  |                    |                    |                     |     PLATFORM_REV+250|
  |                    |                    |                     |  e. ESCROW_RELEASE  |
  |                    |                    |                     |     ESCROW -4750    |
  |                    |                    |                     |     PLAYER_A +4750  |
  |                    |                    |                     |  f. Assert ESCROW=0 |
  |                    |                    |                     |  g. DevEscrow -5000 |
  |                    |                    |                     |  h. status=SETTLED  |
  |                    |                    |                     |  i. COMMIT          |
  |                    |                    |                     |-------------------->|
  |                    |                    |                     |                     |
  |  20. Webhook: BET_SETTLED              |                     |                     |
  |<- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -|
  |                    |                    |                     |                     |
```

### 2.3 Withdrawal Flow

```
Player                Website              Database             Stripe
  |                     |                    |                     |
  |  1. POST /api/wallet/withdraw            |                     |
  |  { amount: 10000, idempotencyKey }       |                     |
  |------------------->|                     |                     |
  |                     |                    |                     |
  |                     |  2. Validate:                            |
  |                     |     - emailVerified = true               |
  |                     |     - balance >= amount                  |
  |                     |     - KYC check if weekly > $500         |
  |                     |                    |                     |
  |                     |  3. DB Transaction:                      |
  |                     |     a. Create WITHDRAWAL Transaction (PENDING)
  |                     |     b. LedgerEntry: PLAYER_BALANCE -10000|
  |                     |     c. LedgerEntry: STRIPE_SINK +10000   |
  |                     |     d. Update balances                   |
  |                     |-------------------------------------------->
  |                     |                    |                     |
  |                     |  4. Create Stripe Payout                 |
  |                     |  (to connected account or bank)          |
  |                     |-------------------------------------------->
  |                     |                    |                     |
  |  5. Response 200                         |                     |
  |  { transactionId, estimatedArrival }     |                     |
  |<--------------------|                    |                     |
  |                     |                    |                     |
  |                     |  === IF PAYOUT SUCCEEDS ===              |
  |                     |  6. Webhook: payout.paid                 |
  |                     |<-------------------------------------------|
  |                     |  7. Mark Transaction COMPLETED           |
  |                     |-------------------------------------------->
  |                     |                    |                     |
  |                     |  === IF PAYOUT FAILS ===                 |
  |                     |  6b. Webhook: payout.failed              |
  |                     |<-------------------------------------------|
  |                     |  7b. Mark Transaction FAILED             |
  |                     |  8b. Create reversal Transaction:        |
  |                     |      STRIPE_SINK -10000                  |
  |                     |      PLAYER_BALANCE +10000               |
  |                     |-------------------------------------------->
  |                     |                    |                     |
```

---

## 3. Security Model

### 3.1 Authentication Layers

**Player Authentication (Session-Based)**
- Password hashed with bcrypt (cost factor 12).
- Sessions stored in `sessions` table with SHA-256 hashed token.
- Cookie: `playstake_session`, httpOnly, secure, sameSite=lax, 7-day expiry.
- Optional TOTP-based 2FA using `otplib`.
- Rate limiting on login: 10 attempts per 15 minutes per IP (Redis counter).
- Account lockout after 10 consecutive failures (30-minute cooldown).

**Developer API Authentication (API Key)**
- Keys generated as `ps_live_` + 32 bytes of `crypto.randomBytes` (base62 encoded).
- Only the SHA-256 hash is stored; the raw key is shown once at creation.
- Lookup: hash the incoming Bearer token, query `api_keys.keyHash`.
- Keys have granular permission scopes: `bet:create`, `bet:read`, `result:report`, `webhook:manage`, `widget:auth`.
- Keys can have an expiration date.
- Rate limit: 1000 req/min per key (Redis sliding window).
- **Cross-developer authorization middleware**: Every `/api/v1/` route that references a `gameId` or `betId` MUST verify that `apiKey.developerProfileId === game.developerProfileId`. This prevents Developer B from operating on Developer A's games/bets. Enforced as reusable middleware, not per-route logic.

**Widget Authentication (Short-Lived Token)**
- Game server requests a widget token via `POST /api/v1/widget/auth` (requires API key + `widget:auth` scope).
- Token format: `wt_` + 32 random bytes (base62).
- Stored as SHA-256 hash in `widget_sessions`.
- TTL: 1 hour. Scoped to one player + one game.
- The game server passes this token to the client-side widget.
- Widget sends it as `Authorization: WidgetToken wt_...` on each request.
- Limited to read operations + bet create/accept for that specific player.

### 3.2 Webhook Signature Verification (Inbound from Stripe)

```
signature = stripe-signature header
payload = raw request body (Buffer, not parsed JSON)
verify using stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET)
```

### 3.3 Webhook Signature (Outbound to Game Developers)

```
timestamp = Unix epoch seconds
payload = JSON.stringify(eventBody)
signature = HMAC-SHA256(webhookSecret, `${timestamp}.${payload}`)

Header: X-PlayStake-Signature: t=1709985600,v1=<hex-signature>
```

Game developer verifies by:
1. Extract `t` and `v1` from header.
2. Recompute HMAC with their stored secret.
3. Compare signatures (constant-time).
4. Reject if `t` is more than 5 minutes old (replay protection).

### 3.4 Dual-Source Result Verification

The game developer is NOT trusted as the sole source of truth for match outcomes. A malicious or compromised developer could otherwise report false results to direct payouts to an accomplice.

**How it works**:
1. Game server reports result via `POST /api/v1/bets/:betId/result` — computes `serverResultHash = SHA-256(betId + outcome + idempotencyKey)`.
2. Widget (client-side, running in player's browser) independently reports what it observed via `POST /api/v1/bets/:betId/widget-result` — computes `widgetResultHash = SHA-256(betId + outcome)`.
3. If both agree: `resultVerified = true`, settlement proceeds after 2-minute dispute window.
4. If they disagree: bet auto-transitions to `DISPUTED`, an `AnomalyAlert` is created, and the developer's anomaly score increases.
5. If widget result never arrives (5-minute timeout): settlement proceeds cautiously but is flagged for post-audit.

**Limitations**: This is not tamper-proof against a sophisticated attacker who controls both the game client AND server. However, it raises the bar significantly — the attacker must compromise the widget iframe (cross-origin isolated) in addition to the game server. For higher-value bets, consider requiring both players to confirm via widget.

### 3.5 Developer Trust and Escrow Caps

Developers are assigned trust tiers that limit their escrow exposure:

| Tier | Max Total Escrow | Max Single Bet | Requirements |
|------|-----------------|----------------|-------------|
| STARTER | $50,000 | $1,000 | New developer, approved |
| VERIFIED | $200,000 | $5,000 | 30 days, 500+ bets, < 1% dispute rate |
| TRUSTED | $500,000 | $10,000 | 90 days, 5000+ bets, < 0.5% dispute rate |
| ENTERPRISE | Custom | Custom | Manual review, legal agreement |

Trust tier is automatically downgraded if:
- Anomaly alerts exceed threshold (3+ HIGH in 7 days)
- Dispute rate exceeds tier limit
- Unverified results exceed 10% of total results

### 3.6 Data Protection

- All database connections over TLS.
- Sensitive fields (`passwordHash`, `twoFactorSecret`, `apiKey.keyHash`, `webhookSecret`) never returned in API responses.
- PII (email, displayName) encrypted at rest via PostgreSQL TDE or application-level encryption for sensitive fields.
- All API responses strip internal fields (database timestamps for internal accounts, etc.).
- CORS restricted to PlayStake domains + registered game widget origins.

### 3.5 Widget Content Security

The in-game widget is served as an iframe from `widget.playstake.com` to isolate it from the host game's JavaScript context.

```
Content-Security-Policy: frame-ancestors 'self' https://*.registeredgame.com;
X-Frame-Options: ALLOW-FROM https://registeredgame.com
```

The allowed origins are derived from the game's registered `websiteUrl` in the database. Communication between the game and widget uses `postMessage` with strict origin checking.

---

## 4. Escrow Flow Detail

### Invariants

1. **Conservation of money**: At any point in time, the sum of all LedgerEntry amounts across the entire system equals zero.
2. **Non-negative player balance**: A player's PLAYER_BALANCE can never go below zero. All debit operations check balance within the same database transaction using `SELECT ... FOR UPDATE`.
3. **Escrow account lifecycle**: Each bet creates exactly one ESCROW LedgerAccount. At settlement or cancellation, the account balance must return to exactly zero.

### Escrow State Machine

```
BET PROPOSED (PENDING_CONSENT)
  NO ESCROW — no funds locked yet
    |
    +-- [Player A consents via widget] --> OPEN
    |     ESCROW balance = Player A's wager (e.g., 2500)
    |     DeveloperEscrowLimit.currentEscrow += 2500
    |       |
    |       +-- [Player B accepts via widget] --> MATCHED
    |       |     ESCROW balance = 2 * wager (e.g., 5000)
    |       |     DeveloperEscrowLimit.currentEscrow += 2500
    |       |       |
    |       |       +-- [Server result + widget result match] --> RESULT_REPORTED (verified)
    |       |       |     ESCROW balance = 5000 (unchanged)
    |       |       |       |
    |       |       |       +-- [2 min, no dispute] --> SETTLED
    |       |       |       |     ESCROW balance = 0
    |       |       |       |     Winner PLAYER_BALANCE += (pot - fee)
    |       |       |       |     PLATFORM_REVENUE += ROUND(fee, 2)
    |       |       |       |     DeveloperEscrowLimit.currentEscrow -= 5000
    |       |       |       |
    |       |       |       +-- [Dispute filed] --> DISPUTED
    |       |       |             ESCROW balance = 5000 (held)
    |       |       |               |
    |       |       |               +-- [Resolved: winner] --> SETTLED
    |       |       |               +-- [Resolved: void] --> VOIDED
    |       |       |                     Both players refunded
    |       |       |
    |       |       +-- [Server + widget results MISMATCH] --> DISPUTED (auto)
    |       |       |     AnomalyAlert created, manual review required
    |       |       |
    |       |       +-- [No widget result in 5 min] --> RESULT_REPORTED (unverified)
    |       |       |     Flagged for audit, dev trust decremented
    |       |       |
    |       |       +-- [Admin void] --> VOIDED (both refunded)
    |       |
    |       +-- [Expires / Creator cancels] --> CANCELLED
    |             ESCROW balance = 0, Player A refunded
    |             DeveloperEscrowLimit.currentEscrow -= 2500
    |
    +-- [Consent timeout / Creator cancels] --> CANCELLED
          No escrow to refund (no funds were locked)
```

### Balance Check Implementation

```sql
-- Atomic balance check + debit (used inside a Prisma $transaction)
UPDATE ledger_accounts
SET balance = balance - $amount,
    updated_at = NOW()
WHERE id = $accountId
  AND account_type = 'PLAYER_BALANCE'
  AND balance >= $amount
RETURNING balance;

-- If zero rows returned: insufficient funds, abort transaction.
```

This pattern prevents race conditions even under concurrent requests because PostgreSQL's `UPDATE ... WHERE balance >= $amount` acquires a row-level lock and the check is atomic.

**Defense in depth**: The `CHECK (balance >= 0)` constraint on `ledger_accounts` acts as a backstop. Even if a code path bypasses the `WHERE balance >= $amount` check (e.g., admin adjustment, worker bug), the database itself will reject the transaction. This is critical for financial integrity.

### Developer Escrow Cap Enforcement

```sql
-- Atomic escrow cap check (inside the same transaction as bet escrow)
UPDATE developer_escrow_limits
SET current_escrow = current_escrow + $amount,
    updated_at = NOW()
WHERE developer_profile_id = $devId
  AND current_escrow + $amount <= max_total_escrow
  AND $amount <= max_single_bet
RETURNING current_escrow;

-- If zero rows returned: developer escrow cap exceeded, abort.
```

This limits the blast radius of a compromised developer. Even if an attacker has valid API keys, they can only lock up funds up to the developer's tier cap (e.g., $50K for STARTER, $500K for ENTERPRISE).

---

## 5. Idempotency Strategy

### Principles

Every operation that mutates money or bet state accepts an `idempotencyKey` parameter. The system guarantees that replaying the same request with the same key produces the same result without side effects.

### Implementation

```
1. Client sends request with idempotencyKey in body.
2. Server checks Transaction table for existing row with this key.
   a. If found and COMPLETED: return the stored response (200).
   b. If found and PENDING: return 409 ("operation in progress").
   c. If found with DIFFERENT parameters: return 409 ("idempotency key reused with different params").
   d. If not found: proceed with operation.
3. Create Transaction row with idempotencyKey BEFORE executing the operation.
4. Execute operation within database transaction.
5. On success: mark COMPLETED, store response.
6. On failure: mark FAILED with reason.
```

### Key Format Conventions

| Operation | Key Format | Example |
|-----------|-----------|---------|
| Deposit | `dep_{userGenerated}` | `dep_abc123` |
| Withdrawal | `wd_{userGenerated}` | `wd_xyz789` |
| Bet Create | `bet_create_{userGenerated}` | `bet_create_match456` |
| Bet Accept | `bet_accept_{userGenerated}` | `bet_accept_match456_p2` |
| Result Report | `result_{userGenerated}` | `result_match456` |
| Settlement | `settle_{betId}_{step}` | `settle_uuid_fee` (system-generated) |
| Bet Expiry | `expire_{betId}` | `expire_uuid` (system-generated) |

### Double-Report Prevention

In addition to the general idempotency mechanism, the `Bet.resultIdempotencyKey` field provides a second layer of protection. Even if a game server sends two result reports with different idempotency keys, the first successful report sets `resultIdempotencyKey` and any subsequent attempt to report a result on the same bet is rejected (bet is no longer in MATCHED status).

---

## 6. Error Handling and Edge Cases

### 6.1 Insufficient Funds

- Checked atomically in the same database transaction as the escrow debit (see Section 4).
- Returns HTTP 402 with `{ error: "Insufficient balance", code: "INSUFFICIENT_FUNDS" }`.
- **Security note**: Do NOT return the actual available balance in error responses to the developer API — this leaks player financial data. Only return it to player-facing widget/website endpoints.
- No partial escrow; the entire operation is rolled back.
- DB `CHECK (balance >= 0)` constraint provides defense-in-depth.

### 6.2 Double Result Reporting

- First report succeeds and transitions bet to RESULT_REPORTED.
- Second report (same idempotency key): returns the original success response (200).
- Second report (different idempotency key): returns 400 because bet is no longer in MATCHED status.
- The game server should always use the same idempotency key for a given match to get safe retry behavior.

### 6.3 Player Disconnect / Game Crash

- The game server is responsible for detecting disconnects and reporting the result.
- If the game server reports a DRAW due to a crash, both players are refunded minus the platform fee (fee still applies because escrow resources were consumed).
- If the game server never reports a result, the bet remains in MATCHED state. A background job escalates bets stuck in MATCHED for more than 24 hours to admin review.
- The widget shows a "waiting for result" state and periodically polls `GET /api/v1/bets/:betId`.

### 6.4 Concurrent Bet Acceptance

- Two players attempt to accept the same OPEN bet simultaneously.
- The `POST /api/v1/bets/:betId/accept` handler uses `SELECT ... FOR UPDATE` on the bet row.
- First player succeeds; second player receives 400 ("Bet is not in OPEN status").

### 6.5 Stripe Payment Failure After Deposit Initiated

- Player's card is declined after PaymentIntent was created.
- Stripe sends `payment_intent.payment_failed` webhook.
- Transaction is marked FAILED. No ledger entries were created (they only happen on success).
- Player sees "Deposit failed" in their transaction history.

### 6.6 Withdrawal Payout Failure

- Stripe sends `payout.failed` webhook.
- System creates a reversal Transaction that credits the player's balance back.
- Player is notified and can retry or update their payout method.

### 6.7 Race Condition: Withdraw While Bet is Being Created

- Both operations use `SELECT ... FOR UPDATE` on the player's PLAYER_BALANCE LedgerAccount.
- Whichever transaction acquires the lock first succeeds. The second transaction sees the updated (lower) balance and may fail with insufficient funds.
- This is the correct behavior: the player cannot spend the same money twice.

### 6.8 Settlement During Dispute Window

- The settlement processor checks for open disputes before settling.
- If a dispute is filed during the 2-minute confirmation window, the bet transitions to DISPUTED and settlement is skipped.
- Settlement processor query: `WHERE status = 'RESULT_REPORTED' AND resultVerified = true AND resultReportedAt + interval '2 minutes' < now() AND NOT EXISTS (SELECT 1 FROM disputes WHERE betId = bets.id AND status = 'OPEN')`.

### 6.9 Self-Betting Prevention

- Database constraint `CHECK (player_a_id != player_b_id)` on the `bets` table prevents the same player from appearing on both sides.
- Application code also checks before the constraint is hit to return a friendly error.
- This prevents fee-free money laundering (player bets against themselves, losing the fee each time, but moving funds between accounts they control).

### 6.10 Player Collusion

- Two players agree to split profits: one always "loses" to the other, then they share winnings off-platform.
- Detection: the anomaly detection worker flags repeated pairings with consistent outcomes.
- Mitigation: rate-limit how many bets the same pair of players can create within a time window (max 5 per hour between the same two players).

### 6.11 Developer Escrow Cap Exhaustion (DoS)

- A malicious developer creates thousands of small bets to lock up their entire escrow cap, then never reports results.
- The 24-hour stuck-bet escalation (section C5 in API endpoints) catches this — matched bets without results for 24h are flagged.
- Additional mitigation: bets that remain in `MATCHED` state for more than 4 hours without a result are automatically voided and refunded. The developer's trust score is decremented.

### 6.12 Negative Amount / Fee Manipulation

- Database constraints `CHECK (amount > 0)` on bets and transactions prevent negative amounts.
- Fee percentage is constrained to `[0, 1]` range at the database level.
- Fee is snapshotted at bet creation time from the game config. Changing the game's fee percentage mid-bet does not affect in-flight bets.

---

## 7. Widget Authentication Flow

The in-game widget uses a three-party authentication flow to avoid exposing player credentials to the game.

```
Player          Game Client         Game Server         PlayStake API
  |                 |                    |                    |
  |  1. Player clicks "Bet" in game UI  |                    |
  |---------------->|                    |                    |
  |                 |                    |                    |
  |                 |  2. Request widget token                |
  |                 |  (includes player's PlayStake userId    |
  |                 |   which was linked during onboarding)   |
  |                 |------------------->|                    |
  |                 |                    |                    |
  |                 |                    |  3. POST /api/v1/widget/auth
  |                 |                    |  { gameId, playerId }
  |                 |                    |  (authenticated with API key)
  |                 |                    |------------------->|
  |                 |                    |                    |
  |                 |                    |  4. { widgetToken: "wt_..." }
  |                 |                    |<-------------------|
  |                 |                    |                    |
  |                 |  5. Return widgetToken                  |
  |                 |<-------------------|                    |
  |                 |                    |                    |
  |  6. Open widget iframe              |                    |
  |  src="https://widget.playstake.com  |                    |
  |   ?token=wt_...&gameId=..."         |                    |
  |<----------------|                    |                    |
  |                 |                    |                    |
  |  7. Widget loads, validates token    |                    |
  |  with PlayStake backend              |                    |
  |----------------------------------------------------->--->|
  |                 |                    |                    |
  |  8. Widget shows bet UI             |                    |
  |  (create challenge, see open bets,  |                    |
  |   accept challenge, view balance)   |                    |
  |<-----------------------------------------------------|---|
  |                 |                    |                    |
  |  9. Player creates/accepts bet      |                    |
  |  via widget (token auth)            |                    |
  |----------------------------------------------------->--->|
```

### Player Account Linking

Before the widget flow works, the player must link their PlayStake account to the game. This happens once per game:

1. Game shows a "Connect PlayStake" button.
2. Player is redirected to `https://playstake.com/connect?gameId=xxx&redirectUrl=yyy`.
3. Player logs in (or is already logged in via session cookie).
4. Player confirms linking their account to this game.
5. PlayStake redirects back to the game with a one-time authorization code.
6. Game server exchanges the code for a permanent `playerId` mapping (similar to OAuth).

This ensures the game server knows the player's PlayStake user ID without ever handling their credentials.

---

## 8. Infrastructure and Deployment

### Runtime Environment

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Application | Next.js 14+ (App Router) on Node.js 20 | Website + API server |
| Database | PostgreSQL 16 | Primary data store |
| Cache / Sessions | Redis 7 | Session store, rate limiting, cache |
| Job Queue | BullMQ (Redis-backed) or pg-boss (Postgres-backed) | Background job processing |
| Payments | Stripe API | Deposits, withdrawals, PCI compliance |
| Hosting | Vercel (website) + dedicated Node.js server or AWS ECS (API + workers) | Deployment |
| CDN | Vercel Edge / CloudFront | Static assets, widget JS |
| Monitoring | Datadog or Grafana + Prometheus | Metrics, logs, alerts |
| Error Tracking | Sentry | Exception tracking |

### Database Scaling Strategy

**Phase 1 (MVP)**: Single PostgreSQL instance with connection pooling (PgBouncer or Prisma Accelerate). Handles up to approximately 1000 concurrent bets.

**Phase 2 (Growth)**: Add read replicas for dashboard queries, bet history, and analytics. Write operations stay on primary. Use Prisma's `$replica` for read-only queries.

**Phase 3 (Scale)**: Consider partitioning `ledger_entries` and `transactions` by `created_at` (monthly partitions) once tables exceed 100M rows. Alternatively, move the hot ledger path to a dedicated database instance.

### Caching Strategy

| Data | Cache Duration | Invalidation |
|------|---------------|-------------|
| User profile | 5 minutes | On update |
| Game metadata | 15 minutes | On update |
| Player balance | Not cached (always fresh from DB) | N/A |
| Bet status (for widget polling) | 5 seconds | On state change |
| Dashboard stats | 1 minute | Time-based |
| API key lookup (hashed) | 5 minutes | On revocation |

Player balance is intentionally never cached to avoid showing stale data for financial information. The atomic `UPDATE ... WHERE balance >= $amount` pattern ensures correctness without needing cache coordination.

---

## 9. Monitoring and Alerting

### Key Metrics

| Metric | Warning Threshold | Critical Threshold |
|--------|------------------|-------------------|
| API p95 latency | > 500ms | > 2000ms |
| Settlement lag (time from result to payout) | > 5 minutes | > 15 minutes |
| Failed webhook deliveries (past hour) | > 10% | > 30% |
| Ledger imbalance (daily check) | Any non-zero | Any non-zero |
| Stripe webhook processing delay | > 30 seconds | > 5 minutes |
| Active MATCHED bets older than 24h | > 5 | > 20 |
| Failed login rate (per IP) | > 20/min | > 100/min |
| Database connection pool utilization | > 70% | > 90% |

### Structured Logging

All log entries include:
- `requestId`: UUID generated per request for tracing.
- `userId`: authenticated user (if applicable).
- `betId`: if the operation is bet-related.
- `transactionId`: if the operation involves money.
- `duration`: request/operation duration in ms.

Sensitive data (passwords, tokens, card numbers) is never logged.
