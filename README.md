# PlayStake

Real-money peer-to-peer wagering platform for competitive games.

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-4169E1?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis_7-DC382D?style=flat&logo=redis&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-635BFF?style=flat&logo=stripe&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma)

PlayStake lets game developers add real-money wagering to their games. Players deposit funds, bet against each other inside third-party games, and withdraw their winnings. Every dollar is tracked through a double-entry ledger with escrow accounts, dual-source result verification, and automated anomaly detection.

---

## Architecture Overview

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
| Prisma   |   | BullMQ      |   | Stripe   |   | Redis          |
| ORM      |   | Job Queue   |   | SDK      |   | (rate limits,  |
|          |   |             |   |          |   |  sessions,     |
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
| **Website** | Player-facing UI: auth, wallet, bet history, dashboard | Session cookie (httpOnly, secure) |
| **Developer Portal** | Game registration, API key management, analytics | Session cookie + `role = DEVELOPER` |
| **Developer API** | Game server integration: bet CRUD, result reporting | API key (`Bearer ps_live_...`) |
| **Widget** | In-game UI for players to create/accept bets | Widget token (short-lived, scoped) |
| **Payout Engine** | Settlement, escrow management, fee calculation | Internal only (background workers) |
| **Webhook System** | Outbound notifications to game developers | HMAC-SHA256 signed payloads |

### Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 (App Router) on Node.js 20 |
| Language | TypeScript 5.9 |
| Database | PostgreSQL 16 with Prisma 7 ORM |
| Cache / Queue | Redis 7 with BullMQ |
| Payments | Stripe (deposits, withdrawals, PCI compliance) |
| Validation | Zod |
| Styling | Tailwind CSS 4 |
| Testing | Vitest |
| Widget | React 19, built as a standalone iframe bundle |

---

## Features

### Player Features

- Account registration with email verification and optional TOTP-based 2FA
- Stripe-powered deposits and withdrawals with KYC enforcement for larger amounts
- Real-time wallet balance with full transaction history and ledger entry detail
- Bet history with win/loss tracking, stats dashboard, and win-rate analytics
- Dispute filing with a 24-hour window after result reporting

### Developer Features

- Game registration with configurable bet limits and platform fee percentages
- Scoped API keys (`bet:create`, `bet:read`, `result:report`, `webhook:manage`, `widget:auth`)
- HMAC-SHA256 signed webhooks for bet lifecycle events (`BET_MATCHED`, `BET_SETTLED`, etc.)
- Embeddable in-game widget (iframe + JS SDK) with postMessage bridge
- Developer analytics: bet volume, revenue share, active bet count

### Security Features

- **Double-entry ledger** -- every money movement creates exactly two ledger entries summing to zero, with database `CHECK` constraints preventing negative balances
- **Escrow accounts** -- per-bet escrow holds funds atomically; escrow balance must return to zero at settlement or cancellation
- **Player consent before escrow** -- bets start in `PENDING_CONSENT`; funds are only locked after the player explicitly confirms via the widget
- **Dual-source result verification** -- both the game server and the client-side widget independently report outcomes; mismatches auto-trigger disputes
- **Developer trust tiers** -- STARTER / VERIFIED / TRUSTED / ENTERPRISE tiers with escalating escrow caps ($50K to custom) and automatic downgrades on anomalies
- **Anomaly detection** -- background workers flag win-rate skew, single-winner patterns, rapid settlements, and volume spikes
- **Cross-developer authorization** -- middleware enforces that API keys can only operate on their own games and bets
- **Idempotency** -- every mutating endpoint accepts an `idempotencyKey`; replayed requests return the original response

### Bet Lifecycle

| State | Description |
|-------|-------------|
| `PENDING_CONSENT` | Game server proposed the bet; no funds locked yet |
| `OPEN` | Player A consented via widget; Player A's funds escrowed |
| `MATCHED` | Player B accepted via widget; both players' funds escrowed |
| `RESULT_REPORTED` | Game server reported the outcome; awaiting widget verification and 2-minute dispute window |
| `SETTLED` | Payout distributed to winner (minus platform fee); escrow zeroed out |
| `CANCELLED` | Bet expired or was cancelled before matching; escrowed funds refunded |
| `DISPUTED` | Result contested by a player or auto-flagged by hash mismatch; funds held pending review |
| `VOIDED` | Admin resolved a dispute as void; both players refunded |

---

## Getting Started

### Prerequisites

- **Node.js** 20+ and npm 9+
- **Docker** and Docker Compose (for PostgreSQL and Redis)
- **Stripe CLI** (for local webhook forwarding) -- [install guide](https://stripe.com/docs/stripe-cli)

### 1. Clone and Install

```bash
git clone https://github.com/your-org/playstake.git
cd playstake
npm install
```

### 2. Environment Setup

Copy the `.env` file and fill in your Stripe test keys:

```bash
cp .env .env.local
```

Required environment variables:

| Variable | Description | Default / Example |
|----------|-------------|-------------------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://playstake:playstake@localhost:5432/playstake` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `STRIPE_SECRET_KEY` | Stripe secret key (test mode) | `sk_test_...` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Exposed to browser for Stripe.js | `pk_test_...` |

### 3. Start Infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL 16 and Redis 7 via `docker-compose.yml`.

### 4. Run Database Migrations

```bash
npm run db:migrate
```

### 5. Seed the Database

```bash
npm run db:seed
```

Creates test users, games, and sample data for local development.

### 6. Start the Application

In separate terminals:

```bash
# Terminal 1: Next.js dev server (website + API)
npm run dev

# Terminal 2: Background workers (settlement, expiry, webhooks, anomaly detection)
npm run workers

# Terminal 3: Stripe webhook forwarding
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### 7. Build the Widget

```bash
npm run widget:build
```

The widget is built as a standalone bundle (separate from the Next.js app) and served as an iframe.

---

## Project Structure

```
playstake/
|-- prisma/                         # Schema, migrations, seed script
|-- src/
|   |-- app/                        # Next.js App Router
|   |   |-- (auth)/                 # Public auth pages (login, register, etc.)
|   |   |-- (dashboard)/            # Player dashboard, wallet, bet history
|   |   |-- (developer)/            # Developer portal (games, API keys, webhooks)
|   |   |-- (admin)/                # Admin panel (disputes, ledger audit, anomalies)
|   |   |-- api/                    # Website API routes (session auth)
|   |   |   |-- v1/                 # Developer API routes (API key auth)
|   |   |   |-- webhooks/stripe/    # Inbound Stripe webhook handler
|   |-- lib/                        # Shared server-side business logic
|   |   |-- auth/                   # Session, password, API key, widget token
|   |   |-- bets/                   # Bet create, consent, accept, result, settlement
|   |   |-- ledger/                 # Double-entry transfer, escrow, audit
|   |   |-- payments/               # Stripe deposits, withdrawals, webhook handler
|   |   |-- security/               # Anomaly detection, escrow caps, trust tiers
|   |   |-- middleware/             # Auth, rate limiting, idempotency, validation
|   |   |-- webhooks/               # Outbound webhook dispatch and signing
|   |-- workers/                    # Background job processors (BullMQ)
|   |-- widget/                     # In-game widget (standalone React build)
|   |-- components/                 # Website React components
|-- public/widget/sdk.js            # Lightweight JS SDK for game developers
|-- tests/                          # Unit, integration, and e2e tests
|-- docs/architecture/              # System architecture, API reference, security review
```

For the full annotated directory tree, see [docs/architecture/directory-structure.md](docs/architecture/directory-structure.md).

---

## API Reference

All monetary amounts in request and response bodies are integers in **cents** (USD).

### Website API (`/api/...`)

Authenticated via session cookie unless marked `[public]`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | public | Create a new player account |
| POST | `/api/auth/login` | public | Log in (supports 2FA) |
| POST | `/api/auth/logout` | session | Invalidate session |
| POST | `/api/auth/verify-email` | public | Verify email address |
| POST | `/api/auth/forgot-password` | public | Request password reset |
| POST | `/api/auth/reset-password` | public | Reset password with token |
| POST | `/api/auth/2fa/enable` | session | Generate 2FA secret and QR code |
| POST | `/api/auth/2fa/confirm` | session | Confirm 2FA setup with code |
| GET | `/api/user/profile` | session | Get user profile |
| PATCH | `/api/user/profile` | session | Update display name / avatar |
| PATCH | `/api/user/password` | session | Change password |
| GET | `/api/wallet/balance` | session | Get available and escrowed balance |
| POST | `/api/wallet/deposit` | session | Initiate Stripe deposit |
| POST | `/api/wallet/withdraw` | session | Request withdrawal |
| GET | `/api/wallet/transactions` | session | Paginated transaction history |
| GET | `/api/wallet/transactions/:id` | session | Transaction detail with ledger entries |
| GET | `/api/bets` | session | Player's bet history |
| GET | `/api/bets/:id` | session | Bet detail |
| POST | `/api/bets/:id/dispute` | session | File a dispute |
| GET | `/api/dashboard/stats` | session | Player stats (wins, losses, net profit) |

### Developer Portal (`/api/developer/...`)

Requires session cookie + `role = DEVELOPER`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/developer/register` | session | Upgrade account to developer |
| POST | `/api/developer/games` | session | Register a new game |
| GET | `/api/developer/games` | session | List developer's games |
| PATCH | `/api/developer/games/:id` | session | Update game settings |
| POST | `/api/developer/api-keys` | session | Generate a new API key |
| GET | `/api/developer/api-keys` | session | List API keys (prefix only) |
| DELETE | `/api/developer/api-keys/:id` | session | Revoke an API key |
| GET | `/api/developer/analytics` | session | Developer analytics |

### Developer API (`/api/v1/...`)

Authenticated via API key (`Authorization: Bearer ps_live_...`). Rate limit: 1000 req/min per key.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/widget/auth` | API key (`widget:auth`) | Get a widget token for a player |
| POST | `/api/v1/bets` | API key (`bet:create`) | Propose a new bet |
| GET | `/api/v1/bets` | API key (`bet:read`) | List bets for a game |
| GET | `/api/v1/bets/:betId` | API key (`bet:read`) | Get bet status |
| POST | `/api/v1/bets/:betId/consent` | Widget token | Player confirms bet (escrow) |
| POST | `/api/v1/bets/:betId/accept` | Widget token | Player B accepts bet (escrow) |
| POST | `/api/v1/bets/:betId/result` | API key (`result:report`) | Report match result |
| POST | `/api/v1/bets/:betId/widget-result` | Widget token | Widget confirms result (dual-source) |
| POST | `/api/v1/bets/:betId/cancel` | API key (`bet:create`) | Cancel an unmatched bet |
| GET | `/api/v1/webhooks` | API key (`webhook:manage`) | List webhook configurations |
| POST | `/api/v1/webhooks` | API key (`webhook:manage`) | Create a webhook endpoint |
| PATCH | `/api/v1/webhooks/:id` | API key (`webhook:manage`) | Update webhook settings |
| DELETE | `/api/v1/webhooks/:id` | API key (`webhook:manage`) | Deactivate a webhook |
| GET | `/api/v1/webhooks/:id/deliveries` | API key (`webhook:manage`) | View delivery attempts |
| POST | `/api/v1/webhooks/:id/test` | API key (`webhook:manage`) | Send a test webhook |

### Background Jobs

These run as separate worker processes, not HTTP endpoints.

| Worker | Schedule | Description |
|--------|----------|-------------|
| Consent Expiry | Every 15s | Cancel `PENDING_CONSENT` bets past their consent window |
| Settlement | Every 30s | Settle verified results after 2-minute dispute window |
| Bet Expiry | Every 60s | Cancel `OPEN` bets past their expiration, refund escrow |
| Webhook Delivery | Continuous | Deliver outbound webhooks with exponential backoff (5 retries) |
| Unverified Result Escalation | Every 60s | Flag results missing widget verification after 5 minutes |
| Anomaly Detection | Every 15min | Analyze developer result patterns for fraud signals |
| Dispute Escalation | Every 5min | Auto-escalate disputes open longer than 48 hours |
| Ledger Audit | Daily 03:00 UTC | Verify double-entry invariants across all accounts |

For full request/response schemas, see [docs/architecture/api-endpoints.md](docs/architecture/api-endpoints.md).

---

## Developer Integration Guide

Game developers integrate PlayStake in four steps:

### 1. Register and Create a Game

Sign up at PlayStake, upgrade to a developer account, and register your game through the Developer Portal. You receive a webhook secret for your game at creation time.

### 2. Generate API Keys

Create API keys with the scopes you need. The full key is shown once at creation -- store it securely.

Available scopes: `bet:create`, `bet:read`, `result:report`, `webhook:manage`, `widget:auth`.

### 3. Embed the Widget SDK

Add the PlayStake SDK to your game client. The widget runs in a sandboxed iframe and handles all player-facing bet interactions (consent, accept, result confirmation).

```html
<script src="https://widget.playstake.com/sdk.js"></script>
<script>
  // Initialize after your game server provides a widget token
  const widget = PlayStake.init({
    gameId: "your-game-uuid",
    widgetToken: "wt_...",        // from your server via POST /api/v1/widget/auth
    theme: "dark",                // "dark" or "light"
    position: "right",            // "left", "right", or "center"
    containerId: "my-container",  // optional: render inside an element instead of fixed position

    // Lifecycle callbacks
    onBetCreated: function(bet) {
      console.log("Bet created:", bet.betId);
    },
    onBetAccepted: function(bet) {
      console.log("Bet matched:", bet.betId);
      startMatch(bet);
    },
    onBetSettled: function(bet) {
      console.log("Bet settled:", bet.betId, bet.outcome);
    },
    onError: function(err) {
      console.error("Widget error:", err.code, err.message);
    }
  });

  // Open/close the widget
  widget.open();
  widget.close();
  widget.toggle();

  // Programmatically create a bet (opens widget automatically)
  widget.createBet({ amount: 2500, metadata: { map: "dust2" } });
</script>
```

### 4. Report Results from Your Game Server

After a match concludes, report the outcome from your game server. The widget independently confirms the result from the client side (dual-source verification).

```bash
curl -X POST https://playstake.com/api/v1/bets/{betId}/result \
  -H "Authorization: Bearer ps_live_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "outcome": "PLAYER_A_WIN",
    "resultPayload": {
      "score": { "playerA": 16, "playerB": 9 },
      "duration": 1800,
      "replayUrl": "https://yourgame.com/replays/123"
    },
    "idempotencyKey": "result_match456"
  }'
```

Settlement happens automatically 2 minutes after both the server and widget results match, provided no dispute is filed.

For the complete integration walkthrough, see [docs/api/developer-guide.md](docs/api/developer-guide.md).

---

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start the Next.js development server |
| `build` | `npm run build` | Production build of the Next.js app |
| `start` | `npm run start` | Start the production server |
| `lint` | `npm run lint` | Run ESLint |
| `workers` | `npm run workers` | Start background workers (settlement, expiry, webhooks) |
| `workers:dev` | `npm run workers:dev` | Start workers with file watching |
| `widget:build` | `npm run widget:build` | Build the in-game widget bundle |
| `widget:build:prod` | `npm run widget:build:prod` | Production widget build |
| `db:up` | `npm run db:up` | Start PostgreSQL and Redis containers |
| `db:down` | `npm run db:down` | Stop containers |
| `db:migrate` | `npm run db:migrate` | Run Prisma migrations (dev) |
| `db:migrate:deploy` | `npm run db:migrate:deploy` | Run migrations (production) |
| `db:seed` | `npm run db:seed` | Seed the database with test data |
| `db:reset` | `npm run db:reset` | Reset database and re-run all migrations |
| `db:studio` | `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `prisma:generate` | `npm run prisma:generate` | Regenerate Prisma client |
| `prisma:format` | `npm run prisma:format` | Format the Prisma schema |
| `test` | `npm test` | Run all tests |
| `test:watch` | `npm run test:watch` | Run tests in watch mode |
| `test:ledger` | `npm run test:ledger` | Run ledger unit tests only |
| `test:auth` | `npm run test:auth` | Run auth unit tests only |
| `test:integration` | `npm run test:integration` | Run integration tests |
| `test:integration:watch` | `npm run test:integration:watch` | Run integration tests in watch mode |

---

## Testing

```bash
# Run all tests
npm test

# Run only unit tests for the ledger
npm run test:ledger

# Run integration tests (requires running PostgreSQL and Redis)
npm run test:integration

# Watch mode for development
npm run test:watch
```

### Test Coverage

| Area | Tests Cover |
|------|-------------|
| **Ledger** | Double-entry transfers, escrow hold/release/refund, ledger audit invariants |
| **Bets** | Full lifecycle (propose, consent, accept, result, settle), cancellation, expiry |
| **Auth** | API key generation/hashing/lookup, session management |
| **Integration: Bet Lifecycle** | End-to-end from proposal through consent, match, dual-source verification, and settlement |
| **Integration: Security** | Cross-developer authorization, self-bet prevention, escrow cap enforcement, idempotency |
| **Integration: Workers** | Settlement processor, bet expiry, anomaly detection |
| **E2E** | Deposit-and-bet flow, widget authentication flow |

Test utilities include database setup/teardown helpers, test data factories, and Stripe API mocks in `tests/helpers/`.

---

## Security

PlayStake handles real money. The security architecture is designed with defense-in-depth across every layer.

**Financial integrity:**
- Double-entry ledger with `CHECK (balance >= 0)` database constraints as a backstop
- Atomic balance checks via `UPDATE ... WHERE balance >= amount` (row-level locks, no race conditions)
- Per-bet escrow accounts that must zero out at settlement or cancellation
- Idempotency on every mutating endpoint to prevent duplicate charges

**Player protection:**
- Players must explicitly consent via the widget before any funds are escrowed
- Dual-source result verification: game server AND client-side widget must agree on the outcome
- 2-minute dispute window between result verification and settlement
- Self-bet prevention enforced at the database level (`CHECK (player_a_id != player_b_id)`)

**Developer trust model:**
- Tiered escrow caps limit the blast radius of a compromised developer account
- Cross-developer middleware prevents one developer from operating on another's games or bets
- Automated anomaly detection flags win-rate skew, suspicious patterns, and result hash mismatches
- Trust tiers auto-downgrade when anomaly thresholds are exceeded

**Authentication:**
- Session cookies: httpOnly, secure, sameSite=lax, 7-day expiry
- API keys: SHA-256 hashed at rest, shown once at creation, scoped permissions
- Widget tokens: short-lived (1 hour), scoped to one player and one game
- Rate limiting on login (10 attempts per 15 minutes per IP), API (1000 req/min per key), and financial operations

For the full adversarial threat model and finding details, see [docs/architecture/security-review.md](docs/architecture/security-review.md).

---

## License

MIT
