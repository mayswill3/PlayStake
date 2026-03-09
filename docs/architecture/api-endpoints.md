# PlayStake API Endpoint Reference

All monetary amounts are integers in **cents** (USD) in request/response bodies to avoid floating-point issues. The database stores `Decimal(14,2)` for human-readable reporting, but the API layer converts.

---

## Authentication Schemes

| Scheme | Header | Used By |
|--------|--------|---------|
| **Session Cookie** | `playstake_session` (httpOnly, secure, sameSite=lax) | Website users (players, developers, admins) |
| **API Key** | `Authorization: Bearer ps_live_...` | Game servers calling Developer API |
| **Widget Token** | `Authorization: WidgetToken wt_...` | In-game widget on behalf of a player |

---

## A. Website API (`/api/...`)

All website routes are authenticated via session cookie unless marked `[public]`.

---

### A1. Auth

#### `POST /api/auth/register` [public]

Create a new player account.

```
Request:
{
  "email": "player@example.com",
  "password": "SecureP@ss1",       // min 8 chars, 1 upper, 1 number, 1 special
  "displayName": "FragMaster99"
}

Response 201:
{
  "user": {
    "id": "uuid",
    "email": "player@example.com",
    "displayName": "FragMaster99",
    "role": "PLAYER"
  }
}

Errors:
  409 - Email already registered
  422 - Validation failure
```

**Rules**: Sends verification email. Account is usable immediately but withdrawals require `emailVerified = true`.

---

#### `POST /api/auth/login` [public]

```
Request:
{
  "email": "player@example.com",
  "password": "SecureP@ss1",
  "twoFactorCode": "123456"        // required if 2FA is enabled
}

Response 200:
{
  "user": { "id": "uuid", "email": "...", "displayName": "...", "role": "PLAYER" }
}
Sets httpOnly cookie: playstake_session=<token>

Errors:
  401 - Invalid credentials
  403 - 2FA required (response includes `twoFactorRequired: true`)
  423 - Account locked (too many failed attempts)
```

**Rules**: Rate-limited to 10 attempts per 15 minutes per IP. Failed attempts increment a counter; 10 consecutive failures lock the account for 30 minutes.

---

#### `POST /api/auth/logout`

Invalidate the current session.

```
Response 200: { "ok": true }
```

---

#### `POST /api/auth/verify-email` [public]

```
Request: { "token": "verification-token-from-email" }
Response 200: { "ok": true }
Errors: 400 - Invalid or expired token
```

---

#### `POST /api/auth/forgot-password` [public]

```
Request: { "email": "player@example.com" }
Response 200: { "ok": true }   // always 200 to prevent email enumeration
```

---

#### `POST /api/auth/reset-password` [public]

```
Request: { "token": "reset-token", "newPassword": "NewSecure1!" }
Response 200: { "ok": true }
Errors: 400 - Invalid or expired token, 422 - Password too weak
```

---

#### `POST /api/auth/2fa/enable`

```
Response 200: { "secret": "base32-secret", "qrCodeUrl": "otpauth://..." }
```

#### `POST /api/auth/2fa/confirm`

```
Request: { "code": "123456" }
Response 200: { "backupCodes": ["code1", "code2", ...] }
Errors: 400 - Invalid code
```

---

### A2. User Profile

#### `GET /api/user/profile`

```
Response 200:
{
  "id": "uuid",
  "email": "player@example.com",
  "displayName": "FragMaster99",
  "avatarUrl": "https://...",
  "role": "PLAYER",
  "kycStatus": "VERIFIED",
  "emailVerified": true,
  "twoFactorEnabled": false,
  "createdAt": "2026-01-15T00:00:00Z"
}
```

#### `PATCH /api/user/profile`

```
Request: { "displayName": "NewName", "avatarUrl": "https://..." }
Response 200: { ...updated profile }
```

#### `PATCH /api/user/password`

```
Request: { "currentPassword": "old", "newPassword": "new" }
Response 200: { "ok": true }
Errors: 401 - Current password incorrect
```

---

### A3. Wallet & Transactions

#### `GET /api/wallet/balance`

```
Response 200:
{
  "available": 150000,          // cents, withdrawable
  "escrowed": 5000,             // cents, locked in active bets
  "currency": "USD"
}
```

**Rules**: `available` = LedgerAccount(PLAYER_BALANCE).balance. `escrowed` = sum of escrow accounts linked to user's active bets.

---

#### `POST /api/wallet/deposit`

Initiate a Stripe Payment Intent for depositing funds.

```
Request:
{
  "amount": 5000,               // cents, min 500 ($5), max 100000 ($1000)
  "idempotencyKey": "dep_abc123"
}

Response 200:
{
  "transactionId": "uuid",
  "stripeClientSecret": "pi_xxx_secret_yyy"
}

Errors:
  400 - Amount out of range
  409 - Idempotency key already used with different parameters
  429 - Rate limit (max 5 deposits per hour)
```

**Rules**: Creates a PENDING Transaction. Actual balance credit happens when Stripe webhook confirms `payment_intent.succeeded`. The `idempotencyKey` is also forwarded to Stripe.

---

#### `POST /api/wallet/withdraw`

Request a withdrawal to the player's Stripe-connected payout method.

```
Request:
{
  "amount": 10000,              // cents, min 1000 ($10)
  "idempotencyKey": "wd_xyz789"
}

Response 200:
{
  "transactionId": "uuid",
  "estimatedArrival": "2026-03-12T00:00:00Z"
}

Errors:
  400 - Amount exceeds available balance, amount below minimum
  403 - Email not verified, or KYC not completed for amounts > $500
  409 - Idempotency conflict
  429 - Rate limit (max 3 withdrawals per day)
```

**Rules**: Immediately debits PLAYER_BALANCE (optimistic). If Stripe payout fails, a reversal Transaction is created to credit the balance back. Requires `emailVerified = true`. Withdrawals over $500 cumulative per week require `kycStatus = VERIFIED`.

---

#### `GET /api/wallet/transactions`

Paginated transaction history.

```
Query params:
  ?page=1&limit=20&type=DEPOSIT&status=COMPLETED

Response 200:
{
  "data": [
    {
      "id": "uuid",
      "type": "DEPOSIT",
      "status": "COMPLETED",
      "amount": 5000,
      "currency": "USD",
      "description": "Deposit via Stripe",
      "createdAt": "2026-03-09T12:00:00Z",
      "completedAt": "2026-03-09T12:01:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalCount": 42,
    "totalPages": 3
  }
}
```

---

#### `GET /api/wallet/transactions/:id`

Full detail for a single transaction including ledger entries.

```
Response 200:
{
  "id": "uuid",
  "type": "BET_ESCROW",
  "status": "COMPLETED",
  "amount": 2500,
  "currency": "USD",
  "description": "Escrow for bet abc123",
  "betId": "uuid",
  "ledgerEntries": [
    { "accountType": "PLAYER_BALANCE", "amount": -2500, "balanceAfter": 147500 },
    { "accountType": "ESCROW", "amount": 2500, "balanceAfter": 2500 }
  ],
  "createdAt": "...",
  "completedAt": "..."
}
```

---

### A4. Bets (Player View)

#### `GET /api/bets`

Player's bet history, paginated.

```
Query params:
  ?page=1&limit=20&status=SETTLED&gameId=uuid

Response 200:
{
  "data": [
    {
      "id": "uuid",
      "gameId": "uuid",
      "gameName": "Battle Royale X",
      "opponent": { "id": "uuid", "displayName": "RivalPlayer" },
      "amount": 2500,
      "status": "SETTLED",
      "outcome": "PLAYER_A_WIN",
      "myRole": "PLAYER_A",         // so client knows if user won or lost
      "netResult": 2375,            // winnings minus fee, negative if lost
      "createdAt": "...",
      "settledAt": "..."
    }
  ],
  "pagination": { ... }
}
```

---

#### `GET /api/bets/:id`

Full bet detail.

```
Response 200:
{
  "id": "uuid",
  "externalId": "game-match-123",
  "game": { "id": "uuid", "name": "Battle Royale X", "logoUrl": "..." },
  "playerA": { "id": "uuid", "displayName": "FragMaster99" },
  "playerB": { "id": "uuid", "displayName": "RivalPlayer" },
  "amount": 2500,
  "currency": "USD",
  "status": "SETTLED",
  "outcome": "PLAYER_A_WIN",
  "platformFeeAmount": 250,
  "gameMetadata": { "map": "dust2", "mode": "1v1" },
  "resultPayload": { "score": { "playerA": 16, "playerB": 9 } },
  "createdAt": "...",
  "matchedAt": "...",
  "resultReportedAt": "...",
  "settledAt": "..."
}
```

---

#### `POST /api/bets/:id/dispute`

File a dispute on a settled or result-reported bet.

```
Request: { "reason": "The game crashed and the result is incorrect." }

Response 201:
{
  "disputeId": "uuid",
  "status": "OPEN"
}

Errors:
  400 - Bet is not in a disputable state
  409 - Dispute already filed for this bet by this user
  429 - Rate limit (max 3 disputes per day)
```

**Rules**: Allowed only within 24 hours of result reporting. If bet is `RESULT_REPORTED` (not yet settled), settlement is paused. If already `SETTLED`, payout may be reversed pending review.

---

### A5. Dashboard / Stats

#### `GET /api/dashboard/stats`

```
Response 200:
{
  "totalBets": 127,
  "wins": 72,
  "losses": 50,
  "draws": 5,
  "winRate": 0.567,
  "totalWagered": 350000,          // cents
  "totalWon": 185000,
  "totalLost": 125000,
  "netProfit": 60000,
  "activeBets": 2
}
```

---

### A6. Developer Portal (requires `role = DEVELOPER`)

#### `POST /api/developer/register`

Upgrade a PLAYER account to DEVELOPER.

```
Request:
{
  "companyName": "GameStudio Inc",
  "websiteUrl": "https://gamestudio.com",
  "contactEmail": "dev@gamestudio.com"
}

Response 201:
{
  "developerProfileId": "uuid",
  "isApproved": false     // requires admin approval
}
```

---

#### `POST /api/developer/games`

Register a new game.

```
Request:
{
  "name": "Battle Royale X",
  "slug": "battle-royale-x",
  "description": "...",
  "logoUrl": "https://...",
  "webhookUrl": "https://gamestudio.com/webhooks/playstake",
  "minBetAmount": 100,
  "maxBetAmount": 50000
}

Response 201:
{
  "id": "uuid",
  "slug": "battle-royale-x",
  "webhookSecret": "whsec_xxxxxxxx",    // returned only on creation
  ...
}
```

---

#### `GET /api/developer/games`

List developer's registered games.

---

#### `PATCH /api/developer/games/:id`

Update game settings (webhook URL, bet limits, etc.).

---

#### `POST /api/developer/api-keys`

Generate a new API key.

```
Request: { "label": "Production Server", "permissions": ["bet:create", "bet:read", "result:report"] }

Response 201:
{
  "id": "uuid",
  "key": "ps_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx",  // returned ONCE, never again
  "keyPrefix": "ps_live_",
  "label": "Production Server",
  "permissions": ["bet:create", "bet:read", "result:report"]
}
```

---

#### `GET /api/developer/api-keys`

List keys (shows prefix + label + lastUsedAt, never the full key).

---

#### `DELETE /api/developer/api-keys/:id`

Revoke a key.

---

#### `GET /api/developer/analytics`

```
Response 200:
{
  "totalBets": 4500,
  "totalVolume": 12500000,
  "activeBets": 23,
  "revShareEarned": 31250,
  "periodStart": "2026-03-01",
  "periodEnd": "2026-03-09"
}
```

---

## B. Developer API (`/api/v1/...`)

All endpoints require `Authorization: Bearer ps_live_...` header. Authenticated against `api_keys` table via SHA-256 hash lookup.

Rate limit: 1000 requests per minute per API key.

Every mutating endpoint accepts an `idempotencyKey` field. Replayed requests with the same key return the original response without re-executing.

---

### B1. Widget Authentication

#### `POST /api/v1/widget/auth`

Game server requests a short-lived widget token on behalf of a player. This is the entry point for the in-game widget authentication flow.

```
Request:
{
  "gameId": "uuid",
  "playerId": "uuid",            // PlayStake user ID (player must have linked their account)
  "idempotencyKey": "wa_abc123"
}

Required permission: widget:auth

Response 200:
{
  "widgetToken": "wt_xxxxxxxxxxxxxxxx",
  "expiresAt": "2026-03-09T13:00:00Z",  // 1 hour TTL
  "playerId": "uuid",
  "gameId": "uuid"
}

Errors:
  400 - Invalid gameId or playerId
  403 - API key does not have widget:auth permission
  404 - Player not found or has not linked account to this game
```

**Rules**: Token is SHA-256 hashed before storage. The raw token is returned to the game server, which passes it to the client-side widget. Widget token is scoped to one game + one player. Max 1 active token per player per game (new request revokes the previous one).

---

### B2. Bet Lifecycle

#### `POST /api/v1/bets`

Propose a new bet (challenge). Does NOT escrow funds — the bet enters `PENDING_CONSENT` until the player confirms via the widget.

```
Request:
{
  "gameId": "uuid",
  "playerAId": "uuid",
  "amount": 2500,                 // cents
  "currency": "USD",
  "externalId": "match-456",     // developer's match ID (optional, must be unique per game)
  "gameMetadata": {               // optional, arbitrary
    "map": "dust2",
    "mode": "1v1"
  },
  "expiresInSeconds": 300,       // how long to wait for an opponent (default 300, max 3600)
  "consentTimeoutSeconds": 60,   // how long player A has to consent (default 60, max 120)
  "idempotencyKey": "bet_create_xyz"
}

Required permission: bet:create

Response 201:
{
  "betId": "uuid",
  "externalId": "match-456",
  "status": "PENDING_CONSENT",
  "amount": 2500,
  "playerA": { "id": "uuid", "displayName": "FragMaster99" },
  "consentExpiresAt": "2026-03-09T12:31:00Z",
  "expiresAt": "2026-03-09T12:35:00Z"
}

Errors:
  400 - Amount outside game's min/max range, invalid gameId
  403 - gameId does not belong to this API key's developer (CRITICAL: cross-developer check)
  409 - Idempotency conflict or externalId already exists for this game
  422 - Player A account frozen or unverified
  429 - Developer escrow cap would be exceeded
```

**Business rules**:
- **No funds are escrowed at this point.** The bet is in `PENDING_CONSENT`.
- The developer's `currentEscrow + amount` is checked against their `maxTotalEscrow` cap. Rejected if exceeded.
- The `amount` is checked against the developer's `maxSingleBet` cap.
- Bet requires player A to confirm via `POST /api/v1/bets/:betId/consent` (widget-authenticated) within `consentTimeoutSeconds`.
- If consent is not given by `consentExpiresAt`, the bet is auto-cancelled (no funds were locked).
- **Cross-developer authorization**: The API key's `developerProfileId` MUST match the game's `developerProfileId`. This is enforced as middleware on all `/api/v1/` routes that reference a gameId.

---

#### `POST /api/v1/bets/:betId/consent`

Player confirms the bet via the widget. This is where escrow happens.

```
Required auth: Widget Token (player must be playerA or playerB for the bet)

Request:
{
  "idempotencyKey": "consent_xyz"
}

Response 200:
{
  "betId": "uuid",
  "status": "OPEN",
  "amount": 2500,
  "escrowTransactionId": "uuid",
  "playerA": { "id": "uuid", "displayName": "FragMaster99" },
  "expiresAt": "2026-03-09T12:35:00Z"
}

Errors:
  400 - Bet is not in PENDING_CONSENT status, or consent window expired
  401 - Widget token does not match playerA for this bet
  402 - Insufficient balance
  404 - Bet not found
  409 - Idempotency conflict
```

**Business rules**:
- Only the player themselves (authenticated via widget token) can consent. The game server CANNOT consent on behalf of a player.
- Creates an ESCROW LedgerAccount for this bet.
- Creates a BET_ESCROW Transaction: debit Player A's PLAYER_BALANCE, credit the bet's ESCROW account.
- Updates `DeveloperEscrowLimit.currentEscrow += amount` atomically.
- Bet status transitions from `PENDING_CONSENT` to `OPEN`.
- Sets `playerAConsentedAt = now()`.
- If not matched by `expiresAt`, a background job transitions to CANCELLED and creates a BET_ESCROW_REFUND transaction.

---

#### `POST /api/v1/bets/:betId/accept`

Player B accepts the challenge via the widget. Escrows Player B's funds.

```
Required auth: Widget Token (player B authenticates themselves)

Request:
{
  "idempotencyKey": "bet_accept_xyz"
}

Response 200:
{
  "betId": "uuid",
  "status": "MATCHED",
  "playerA": { "id": "uuid", "displayName": "FragMaster99" },
  "playerB": { "id": "uuid", "displayName": "RivalPlayer" },
  "matchedAt": "2026-03-09T12:31:00Z",
  "escrowTransactionId": "uuid"
}

Errors:
  400 - Bet is not in OPEN status, playerB same as playerA (DB constraint enforced)
  401 - Widget token invalid or expired
  402 - Insufficient balance for Player B
  404 - Bet not found
  409 - Idempotency conflict
  410 - Bet expired
  429 - Developer escrow cap would be exceeded
```

**Business rules**:
- **Player B is identified from the widget token**, not from a request body field. The game server cannot specify playerBId.
- Creates a second BET_ESCROW Transaction: debit Player B's PLAYER_BALANCE, credit the bet's ESCROW account.
- Updates `DeveloperEscrowLimit.currentEscrow += amount` atomically.
- ESCROW account now holds `amount * 2`.
- Bet status = MATCHED. Sets `playerBConsentedAt = now()`.
- Self-bet prevention: `playerAId != playerBId` enforced at DB level and in code.
- Fires `BET_MATCHED` webhook to game developer.

---

#### `POST /api/v1/bets/:betId/result`

Game server reports the match result. Settlement requires dual-source verification (see widget result below).

```
Request:
{
  "outcome": "PLAYER_A_WIN",      // PLAYER_A_WIN | PLAYER_B_WIN | DRAW
  "resultPayload": {              // optional, arbitrary proof data
    "score": { "playerA": 16, "playerB": 9 },
    "duration": 1800,
    "replayUrl": "https://..."
  },
  "idempotencyKey": "result_match456"
}

Required permission: result:report

Response 200:
{
  "betId": "uuid",
  "status": "RESULT_REPORTED",
  "outcome": "PLAYER_A_WIN",
  "resultVerified": false,         // true only after widget confirms
  "resultReportedAt": "2026-03-09T12:55:00Z",
  "settlementEstimate": "2026-03-09T12:57:00Z"  // 2 min after verification
}

Errors:
  400 - Bet not in MATCHED status, invalid outcome value
  403 - Bet's game does not belong to this API key's developer (cross-developer check)
  404 - Bet not found
  409 - Result already reported (idempotency key match returns original response)
```

**Business rules**:
- **Cross-developer authorization**: The API key's `developerProfileId` MUST own the game associated with this bet. Prevents Developer B from reporting results on Developer A's bets.
- Stores `outcome`, `resultPayload`, `resultReportedAt`.
- Computes `serverResultHash = SHA-256(betId + outcome + idempotencyKey)` and stores it.
- Sets `resultIdempotencyKey` to prevent double-reporting even with different idempotency keys.
- Bet status = RESULT_REPORTED.
- **Settlement does NOT begin until dual-source verification completes** (see widget result endpoint below). If widget confirmation does not arrive within 5 minutes, the bet is flagged for manual review.
- After verification + 2-minute dispute window, the Payout Engine settles the bet automatically.

---

#### `POST /api/v1/bets/:betId/widget-result`

Widget submits its view of the match outcome for dual-source verification.

```
Required auth: Widget Token (either player in the bet)

Request:
{
  "outcome": "PLAYER_A_WIN"       // must match the server's reported outcome
}

Response 200:
{
  "betId": "uuid",
  "resultVerified": true,          // true if widget + server agree
  "mismatch": false,
  "settlementEstimate": "2026-03-09T12:57:00Z"
}

Errors:
  400 - Bet not in RESULT_REPORTED status, or result not yet reported by server
  401 - Widget token invalid or not a participant in this bet
  404 - Bet not found
  409 - Widget result already submitted
```

**Business rules**:
- Computes `widgetResultHash = SHA-256(betId + outcome)` and stores it.
- If `serverResultHash` prefix (betId + outcome portion) matches `widgetResultHash`: sets `resultVerified = true`, starts the 2-minute confirmation window.
- If hashes **do not match**: bet is flagged as `DISPUTED` automatically, an `AnomalyAlert` of type `RESULT_HASH_MISMATCH` is created, and the developer's anomaly score is incremented. Neither player's funds are released until manual review.
- This prevents a malicious game server from reporting false outcomes — the client-side widget acts as a second witness.
- **Graceful degradation**: If no widget result arrives within 5 minutes, settlement proceeds but the bet is flagged for audit and the developer's trust score is decremented.

---

#### `POST /api/v1/bets/:betId/cancel`

Cancel a bet that has not yet been matched.

```
Request:
{
  "reason": "Player left the lobby",
  "idempotencyKey": "cancel_xyz"
}

Required permission: bet:create

Response 200:
{
  "betId": "uuid",
  "status": "CANCELLED",
  "refundTransactionId": "uuid"
}

Errors:
  400 - Bet is not in OPEN status (cannot cancel a matched bet)
  404 - Bet not found
  409 - Idempotency conflict
```

**Business rules**:
- If bet was in `PENDING_CONSENT` (no escrow yet): simply marks as CANCELLED, no ledger operations needed.
- If bet was in `OPEN` (Player A escrowed): Creates BET_ESCROW_REFUND Transaction: debit ESCROW, credit Player A's PLAYER_BALANCE. Updates `DeveloperEscrowLimit.currentEscrow -= amount`.
- Verifies the bet's ESCROW LedgerAccount balance = 0 after refund.
- Bet status = CANCELLED.
- **Cross-developer authorization**: API key's developer must own the game.

---

#### `GET /api/v1/bets/:betId`

Query bet status. Also works with `?externalId=match-456&gameId=uuid` as an alternative lookup.

```
Required permission: bet:read

Response 200:
{
  "betId": "uuid",
  "externalId": "match-456",
  "gameId": "uuid",
  "status": "MATCHED",
  "amount": 2500,
  "currency": "USD",
  "playerA": { "id": "uuid", "displayName": "FragMaster99" },
  "playerB": { "id": "uuid", "displayName": "RivalPlayer" },
  "outcome": null,
  "platformFeeAmount": null,
  "gameMetadata": { "map": "dust2", "mode": "1v1" },
  "createdAt": "...",
  "matchedAt": "...",
  "expiresAt": "..."
}
```

---

#### `GET /api/v1/bets`

List bets for the game, paginated.

```
Query params:
  ?gameId=uuid&status=OPEN&page=1&limit=50

Required permission: bet:read

Response 200:
{
  "data": [ ...bet objects... ],
  "pagination": { "page": 1, "limit": 50, "totalCount": 120, "totalPages": 3 }
}
```

---

### B3. Webhook Management

#### `GET /api/v1/webhooks`

```
Required permission: webhook:manage

Response 200:
{
  "data": [
    {
      "id": "uuid",
      "gameId": "uuid",
      "url": "https://gamestudio.com/webhooks/playstake",
      "events": ["BET_MATCHED", "BET_SETTLED"],
      "isActive": true
    }
  ]
}
```

---

#### `POST /api/v1/webhooks`

```
Request:
{
  "gameId": "uuid",
  "url": "https://gamestudio.com/webhooks/playstake",
  "events": ["BET_CREATED", "BET_MATCHED", "BET_SETTLED", "BET_CANCELLED"]
}

Required permission: webhook:manage

Response 201:
{
  "id": "uuid",
  "secret": "whsec_xxxxxxxx",    // returned ONCE
  "url": "...",
  "events": [...]
}
```

---

#### `PATCH /api/v1/webhooks/:id`

Update URL or event subscriptions.

---

#### `DELETE /api/v1/webhooks/:id`

Deactivate a webhook config.

---

#### `GET /api/v1/webhooks/:id/deliveries`

View recent delivery attempts for debugging.

```
Required permission: webhook:manage

Response 200:
{
  "data": [
    {
      "id": "uuid",
      "eventType": "BET_SETTLED",
      "status": "DELIVERED",
      "httpStatus": 200,
      "attemptCount": 1,
      "deliveredAt": "2026-03-09T13:00:00Z",
      "createdAt": "2026-03-09T12:59:59Z"
    }
  ]
}
```

---

#### `POST /api/v1/webhooks/:id/test`

Send a test webhook payload to verify endpoint connectivity.

```
Required permission: webhook:manage

Response 200:
{
  "delivered": true,
  "httpStatus": 200,
  "responseTimeMs": 145
}
```

---

## C. Internal / Background Jobs (not HTTP-exposed)

These run as background workers using a job queue (BullMQ on Redis or pg-boss on PostgreSQL).

---

### C0. Consent Expiry Processor

**Trigger**: Runs every 15 seconds, picks up bets where `status = PENDING_CONSENT` and `consentExpiresAt < now()`.

**Process**:
1. Transition bet to CANCELLED.
2. No ledger operations needed (no funds were escrowed).
3. Fire `BET_CANCELLED` webhook.

**Idempotency**: Uses idempotency key `consent_expire_{betId}`.

---

### C1. Settlement Processor

**Trigger**: Runs every 30 seconds, picks up bets where `status = RESULT_REPORTED` and `resultVerified = true` and `resultReportedAt + 2 minutes < now()` and no open disputes exist.

**Process**:
1. BEGIN database transaction.
2. Acquire advisory lock on the bet ID (inside the transaction).
3. `SELECT bet FOR UPDATE` — verify status is still `RESULT_REPORTED` AND `resultVerified = true`.
4. `SELECT escrow account FOR UPDATE` — verify balance equals exactly `amount * 2`.
5. Calculate platform fee: `feeAmount = ROUND(totalPot * platformFeePercent, 2)`. Any sub-cent remainder goes to a `ROUNDING` ledger account (never silently lost/created).
6. Calculate winner payout: `payout = totalPot - feeAmount`.
7. Within the same transaction:
   a. Create PLATFORM_FEE Transaction: debit ESCROW, credit PLATFORM_REVENUE.
   b. If rounding remainder exists: create ROUNDING Transaction.
   c. If developer has `revSharePercent > 0`: create DEVELOPER_SHARE Transaction from PLATFORM_REVENUE to DEVELOPER_BALANCE.
   d. Create BET_ESCROW_RELEASE Transaction: debit ESCROW (remaining), credit winner's PLAYER_BALANCE.
   e. For DRAW: split equally, create two BET_ESCROW_RELEASE transactions (minus half the fee each).
   f. Update bet status to SETTLED, set `settledAt`, `platformFeeAmount`.
   g. Verify ESCROW account balance = 0 (invariant check — abort if violated).
   h. Update `DeveloperEscrowLimit.currentEscrow -= (amount * 2)` atomically.
8. COMMIT transaction.
9. Fire `BET_SETTLED` webhook.

**Idempotency**: The advisory lock + `SELECT FOR UPDATE` + status check in step 3 prevents double settlement. Each transaction uses a deterministic idempotency key: `settle_{betId}_{step}`.

---

### C2. Bet Expiry Processor

**Trigger**: Runs every 60 seconds, picks up bets where `status = OPEN` and `expiresAt < now()`.

**Process**:
1. Transition bet to CANCELLED.
2. Create BET_ESCROW_REFUND Transaction.
3. Fire `BET_CANCELLED` webhook.

**Idempotency**: Uses idempotency key `expire_{betId}`.

---

### C3. Stripe Webhook Handler

**Trigger**: `POST /api/webhooks/stripe` (this one HTTP endpoint is exposed but listed here because it feeds the background processing pipeline).

**Process**:
1. Verify Stripe signature using `STRIPE_WEBHOOK_SECRET`.
2. Check if `stripeEventId` already exists in `stripe_events` table. If yes, return 200 immediately (idempotent).
3. Insert into `stripe_events` with `processed = false`.
4. Process based on event type:
   - `payment_intent.succeeded`: Find matching PENDING DEPOSIT Transaction by `stripePaymentId`. Mark COMPLETED. Execute ledger entries (debit STRIPE_SOURCE, credit PLAYER_BALANCE).
   - `payment_intent.payment_failed`: Mark Transaction as FAILED with reason.
   - `payout.paid`: Mark WITHDRAWAL Transaction as COMPLETED.
   - `payout.failed`: Mark WITHDRAWAL Transaction as FAILED. Create reversal Transaction to credit PLAYER_BALANCE back.
5. Mark `stripe_events.processed = true`.

---

### C4. Webhook Delivery Worker

**Trigger**: Runs continuously, picks up `webhook_delivery_logs` where `status IN (PENDING, RETRYING)` and `nextRetryAt <= now()`.

**Process**:
1. Build payload JSON with event data.
2. Compute HMAC-SHA256 signature: `hex(HMAC-SHA256(webhookSecret, timestamp + "." + payloadJson))`.
3. Send HTTP POST with headers:
   - `Content-Type: application/json`
   - `X-PlayStake-Signature: t=<timestamp>,v1=<signature>`
   - `X-PlayStake-Event: BET_SETTLED`
   - `X-PlayStake-Delivery: <deliveryLogId>`
4. If response 2xx: mark DELIVERED.
5. If response non-2xx or timeout (10s): increment `attemptCount`, set status to RETRYING, set `nextRetryAt` with exponential backoff:
   - Attempt 1: +1 min
   - Attempt 2: +5 min
   - Attempt 3: +30 min
   - Attempt 4: +2 hours
   - Attempt 5: +12 hours
   - After 5 failed attempts: mark FAILED.

---

### C5. Dispute Auto-Escalation

**Trigger**: Runs every 5 minutes, picks up disputes where `status = OPEN` and `createdAt + 48 hours < now()`.

**Process**: Transitions to `UNDER_REVIEW` and sends alert to admin dashboard. If no admin action within 7 days, auto-resolves as VOID and refunds both players.

---

### C6. Ledger Integrity Checker

**Trigger**: Runs daily at 03:00 UTC.

**Process**:
1. For every LedgerAccount, verify that `balance` equals the sum of all its LedgerEntry amounts.
2. For every Transaction, verify that the sum of its LedgerEntry amounts equals zero (double-entry invariant).
3. Verify total PLAYER_BALANCE + ESCROW + PLATFORM_REVENUE + DEVELOPER_BALANCE = total STRIPE_SOURCE debits - total STRIPE_SINK credits (conservation of money).
4. Verify `DeveloperEscrowLimit.currentEscrow` matches the actual sum of escrow accounts for each developer's active bets.
5. If any invariant fails: fire PagerDuty alert, freeze affected accounts.

---

### C7. Unverified Result Escalation

**Trigger**: Runs every 60 seconds, picks up bets where `status = RESULT_REPORTED` and `resultVerified = false` and `resultReportedAt + 5 minutes < now()`.

**Process**:
1. Flag the bet for admin review (add to admin queue).
2. Create an `AnomalyAlert` of type `RESULT_HASH_MISMATCH` with severity `MEDIUM`.
3. Decrement the developer's trust score.
4. If developer has more than 3 unverified results in the past 24 hours: auto-reduce their `maxTotalEscrow` by 50% and create a `HIGH` severity alert.
5. Settlement proceeds with caution (2-minute window still applies) but the bet is tagged for post-settlement audit.

---

### C8. Developer Anomaly Detection

**Trigger**: Runs every 15 minutes, analyzes per-developer result patterns.

**Process**:
1. **Win-rate skew detection**: For each developer, calculate the win rate per player across the last 100 bets. Flag if any single player wins more than 80% of bets (expected: ~50% in fair games).
2. **Single-winner pattern**: Flag if the same player wins more than 10 consecutive bets for a developer.
3. **Rapid settlement pattern**: Flag if average time between bet creation and result report is under 30 seconds (indicates pre-determined outcomes).
4. **Volume spike detection**: Flag if a developer's bet volume in the past hour exceeds 3x their 7-day hourly average.
5. **Auto-actions by severity**:
   - `MEDIUM`: Log alert, notify admin.
   - `HIGH`: Reduce developer escrow cap by 50%, notify admin.
   - `CRITICAL`: Freeze all of the developer's active bets (hold escrow, block new bets), suspend API keys, escalate to admin immediately.
