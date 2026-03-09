# PlayStake Project Directory Structure

```
playstake/
|
|-- prisma/
|   |-- schema.prisma                    # Database schema (source of truth)
|   |-- migrations/                      # Auto-generated migration files
|   |-- seed.ts                          # Seed script (dev games, test users)
|
|-- src/
|   |
|   |-- app/                             # Next.js App Router
|   |   |
|   |   |-- (auth)/                      # Route group: public auth pages
|   |   |   |-- login/page.tsx
|   |   |   |-- register/page.tsx
|   |   |   |-- forgot-password/page.tsx
|   |   |   |-- reset-password/page.tsx
|   |   |   |-- verify-email/page.tsx
|   |   |   |-- layout.tsx               # Minimal layout (no sidebar)
|   |   |
|   |   |-- (dashboard)/                 # Route group: authenticated player pages
|   |   |   |-- dashboard/page.tsx       # Stats overview
|   |   |   |-- wallet/page.tsx          # Balance, deposit, withdraw
|   |   |   |-- wallet/deposit/page.tsx
|   |   |   |-- wallet/withdraw/page.tsx
|   |   |   |-- wallet/transactions/page.tsx
|   |   |   |-- bets/page.tsx            # Bet history list
|   |   |   |-- bets/[id]/page.tsx       # Single bet detail
|   |   |   |-- settings/page.tsx        # Profile, password, 2FA
|   |   |   |-- layout.tsx               # Dashboard shell (sidebar, nav, auth guard)
|   |   |
|   |   |-- (developer)/                 # Route group: developer portal
|   |   |   |-- developer/page.tsx       # Developer dashboard / analytics
|   |   |   |-- developer/games/page.tsx
|   |   |   |-- developer/games/new/page.tsx
|   |   |   |-- developer/games/[id]/page.tsx
|   |   |   |-- developer/api-keys/page.tsx
|   |   |   |-- developer/webhooks/page.tsx
|   |   |   |-- developer/docs/page.tsx  # Embedded API documentation
|   |   |   |-- layout.tsx               # Developer layout (auth + role guard)
|   |   |
|   |   |-- (admin)/                     # Route group: admin panel
|   |   |   |-- admin/page.tsx           # Admin dashboard
|   |   |   |-- admin/disputes/page.tsx
|   |   |   |-- admin/disputes/[id]/page.tsx
|   |   |   |-- admin/users/page.tsx
|   |   |   |-- admin/bets/page.tsx
|   |   |   |-- admin/ledger/page.tsx    # Ledger health / audit view
|   |   |   |-- admin/anomalies/page.tsx # Anomaly alerts + developer trust management
|   |   |   |-- admin/developers/page.tsx # Developer escrow caps + trust tiers
|   |   |   |-- layout.tsx
|   |   |
|   |   |-- api/                         # Next.js API Routes (website API)
|   |   |   |
|   |   |   |-- auth/
|   |   |   |   |-- register/route.ts
|   |   |   |   |-- login/route.ts
|   |   |   |   |-- logout/route.ts
|   |   |   |   |-- verify-email/route.ts
|   |   |   |   |-- forgot-password/route.ts
|   |   |   |   |-- reset-password/route.ts
|   |   |   |   |-- 2fa/
|   |   |   |       |-- enable/route.ts
|   |   |   |       |-- confirm/route.ts
|   |   |   |
|   |   |   |-- user/
|   |   |   |   |-- profile/route.ts     # GET + PATCH
|   |   |   |   |-- password/route.ts    # PATCH
|   |   |   |
|   |   |   |-- wallet/
|   |   |   |   |-- balance/route.ts     # GET
|   |   |   |   |-- deposit/route.ts     # POST
|   |   |   |   |-- withdraw/route.ts    # POST
|   |   |   |   |-- transactions/route.ts         # GET (list)
|   |   |   |   |-- transactions/[id]/route.ts    # GET (detail)
|   |   |   |
|   |   |   |-- bets/
|   |   |   |   |-- route.ts             # GET (list)
|   |   |   |   |-- [id]/route.ts        # GET (detail)
|   |   |   |   |-- [id]/dispute/route.ts # POST
|   |   |   |
|   |   |   |-- dashboard/
|   |   |   |   |-- stats/route.ts       # GET
|   |   |   |
|   |   |   |-- developer/
|   |   |   |   |-- register/route.ts    # POST
|   |   |   |   |-- games/route.ts       # GET + POST
|   |   |   |   |-- games/[id]/route.ts  # GET + PATCH
|   |   |   |   |-- api-keys/route.ts    # GET + POST
|   |   |   |   |-- api-keys/[id]/route.ts # DELETE
|   |   |   |   |-- analytics/route.ts   # GET
|   |   |   |
|   |   |   |-- admin/
|   |   |   |   |-- disputes/route.ts
|   |   |   |   |-- disputes/[id]/route.ts
|   |   |   |   |-- disputes/[id]/resolve/route.ts
|   |   |   |   |-- users/route.ts
|   |   |   |   |-- users/[id]/route.ts
|   |   |   |   |-- ledger/audit/route.ts
|   |   |   |   |-- anomalies/route.ts          # GET list, PATCH resolve
|   |   |   |   |-- anomalies/[id]/route.ts
|   |   |   |   |-- developers/[id]/escrow-limit/route.ts  # PATCH caps/tier
|   |   |   |
|   |   |   |-- v1/                      # Developer API (API-key auth)
|   |   |   |   |-- widget/
|   |   |   |   |   |-- auth/route.ts    # POST
|   |   |   |   |
|   |   |   |   |-- bets/
|   |   |   |   |   |-- route.ts         # GET (list) + POST (create)
|   |   |   |   |   |-- [betId]/route.ts # GET (detail)
|   |   |   |   |   |-- [betId]/consent/route.ts # POST (widget-auth: player escrow consent)
|   |   |   |   |   |-- [betId]/accept/route.ts  # POST (widget-auth: player B accepts)
|   |   |   |   |   |-- [betId]/result/route.ts  # POST (API-key: server reports result)
|   |   |   |   |   |-- [betId]/widget-result/route.ts # POST (widget-auth: dual-source verify)
|   |   |   |   |   |-- [betId]/cancel/route.ts  # POST (API-key: cancel bet)
|   |   |   |   |
|   |   |   |   |-- webhooks/
|   |   |   |       |-- route.ts         # GET + POST
|   |   |   |       |-- [id]/route.ts    # PATCH + DELETE
|   |   |   |       |-- [id]/deliveries/route.ts  # GET
|   |   |   |       |-- [id]/test/route.ts         # POST
|   |   |   |
|   |   |   |-- webhooks/
|   |   |       |-- stripe/route.ts      # POST (Stripe webhook receiver)
|   |   |
|   |   |-- layout.tsx                   # Root layout
|   |   |-- page.tsx                     # Landing page
|   |   |-- globals.css
|   |
|   |-- lib/                             # Shared server-side logic
|   |   |
|   |   |-- db/
|   |   |   |-- client.ts               # Prisma client singleton
|   |   |   |-- queries/                 # Reusable query functions
|   |   |       |-- users.ts
|   |   |       |-- bets.ts
|   |   |       |-- wallets.ts
|   |   |       |-- transactions.ts
|   |   |       |-- games.ts
|   |   |       |-- disputes.ts
|   |   |
|   |   |-- auth/
|   |   |   |-- session.ts              # Session create/validate/destroy
|   |   |   |-- password.ts             # bcrypt hash/verify
|   |   |   |-- two-factor.ts           # TOTP generation/verification
|   |   |   |-- api-key.ts              # API key generation, hashing, lookup
|   |   |   |-- widget-token.ts         # Widget token generation/validation
|   |   |
|   |   |-- ledger/
|   |   |   |-- accounts.ts             # Create/get ledger accounts
|   |   |   |-- transfer.ts             # Core double-entry transfer function
|   |   |   |-- escrow.ts               # Escrow-specific operations (hold, release, refund)
|   |   |   |-- audit.ts                # Integrity checking functions
|   |   |
|   |   |-- payments/
|   |   |   |-- stripe.ts               # Stripe client singleton
|   |   |   |-- deposits.ts             # Create PaymentIntent, handle success
|   |   |   |-- withdrawals.ts          # Create Payout, handle success/failure
|   |   |   |-- webhook-handler.ts      # Stripe webhook event processing
|   |   |
|   |   |-- bets/
|   |   |   |-- create.ts               # Bet proposal (PENDING_CONSENT, no escrow)
|   |   |   |-- consent.ts              # Player consent + escrow lock
|   |   |   |-- accept.ts               # Player B acceptance + escrow lock
|   |   |   |-- result.ts               # Server result recording + hash
|   |   |   |-- widget-result.ts        # Widget result + dual-source verification
|   |   |   |-- cancel.ts               # Cancellation + refund
|   |   |   |-- settlement.ts           # Settlement calculation + execution
|   |   |
|   |   |-- security/
|   |   |   |-- anomaly-detection.ts    # Developer result pattern analysis
|   |   |   |-- escrow-caps.ts          # Developer escrow limit management
|   |   |   |-- trust-tiers.ts          # Developer trust tier evaluation + auto-adjust
|   |   |   |-- collusion-detection.ts  # Player pairing pattern analysis
|   |   |
|   |   |-- webhooks/
|   |   |   |-- dispatch.ts             # Queue outbound webhook delivery
|   |   |   |-- sign.ts                 # HMAC-SHA256 signing
|   |   |   |-- verify.ts              # Signature verification (for inbound)
|   |   |
|   |   |-- middleware/
|   |   |   |-- auth.ts                 # Session auth middleware
|   |   |   |-- api-key-auth.ts         # API key auth middleware
|   |   |   |-- widget-auth.ts          # Widget token auth middleware
|   |   |   |-- developer-ownership.ts  # Cross-developer authorization (gameId/betId ownership)
|   |   |   |-- rate-limit.ts           # Rate limiting (Redis-backed)
|   |   |   |-- idempotency.ts          # Idempotency key handling
|   |   |   |-- escrow-cap.ts           # Developer escrow cap enforcement
|   |   |   |-- error-handler.ts        # Centralized error responses
|   |   |   |-- validate.ts             # Zod schema validation wrapper
|   |   |
|   |   |-- validation/
|   |   |   |-- schemas.ts              # Zod schemas for all request bodies
|   |   |   |-- bet.ts                  # Bet-specific validations
|   |   |   |-- wallet.ts               # Wallet-specific validations
|   |   |   |-- auth.ts                 # Auth-specific validations
|   |   |
|   |   |-- errors/
|   |   |   |-- index.ts                # Custom error classes
|   |   |   |-- codes.ts                # Error code constants
|   |   |
|   |   |-- config/
|   |   |   |-- env.ts                  # Environment variable validation (Zod)
|   |   |   |-- constants.ts            # Business rule constants (min/max bets, fees, etc.)
|   |   |
|   |   |-- utils/
|   |       |-- crypto.ts               # Random token generation, hashing
|   |       |-- money.ts                # Cents <-> Decimal conversion helpers
|   |       |-- pagination.ts           # Pagination helpers
|   |       |-- logger.ts               # Structured logger (pino or winston)
|   |       |-- request-id.ts           # Request ID generation/propagation
|   |
|   |-- workers/                         # Background job processors
|   |   |-- index.ts                     # Worker entry point (registers all processors)
|   |   |-- consent-expiry.worker.ts     # Auto-cancel PENDING_CONSENT bets
|   |   |-- settlement.worker.ts         # Settlement processor (requires resultVerified)
|   |   |-- bet-expiry.worker.ts         # Expired bet cleanup
|   |   |-- webhook-delivery.worker.ts   # Outbound webhook delivery + retries
|   |   |-- dispute-escalation.worker.ts # Auto-escalate stale disputes
|   |   |-- ledger-audit.worker.ts       # Daily ledger integrity check
|   |   |-- stuck-bet-monitor.worker.ts  # Alert on bets stuck in MATCHED > 24h
|   |   |-- anomaly-detection.worker.ts  # Periodic developer fraud pattern analysis
|   |   |-- unverified-result.worker.ts  # Escalate results missing widget verification
|   |
|   |-- jobs/                            # Job definitions and queue setup
|   |   |-- queue.ts                     # BullMQ queue initialization
|   |   |-- types.ts                     # Job payload type definitions
|   |   |-- schedules.ts                 # Cron-like schedules for recurring jobs
|   |
|   |-- widget/                          # Widget application (separate build target)
|   |   |-- index.html                   # Widget iframe entry
|   |   |-- widget.tsx                   # React widget root
|   |   |-- components/
|   |   |   |-- BetCreate.tsx
|   |   |   |-- BetAccept.tsx
|   |   |   |-- OpenBets.tsx
|   |   |   |-- Balance.tsx
|   |   |   |-- WidgetAuth.tsx
|   |   |-- hooks/
|   |   |   |-- useWidgetAuth.ts
|   |   |   |-- useBets.ts
|   |   |   |-- useBalance.ts
|   |   |-- styles/
|   |       |-- widget.css               # Isolated styles (no globals leak)
|   |
|   |-- components/                      # Shared React components (website)
|   |   |-- ui/                          # Base UI primitives (shadcn/ui or custom)
|   |   |   |-- Button.tsx
|   |   |   |-- Input.tsx
|   |   |   |-- Card.tsx
|   |   |   |-- Dialog.tsx
|   |   |   |-- Table.tsx
|   |   |   |-- Badge.tsx
|   |   |   |-- Toast.tsx
|   |   |-- layout/
|   |   |   |-- Sidebar.tsx
|   |   |   |-- Header.tsx
|   |   |   |-- Footer.tsx
|   |   |-- wallet/
|   |   |   |-- BalanceCard.tsx
|   |   |   |-- DepositForm.tsx
|   |   |   |-- WithdrawForm.tsx
|   |   |   |-- TransactionList.tsx
|   |   |-- bets/
|   |   |   |-- BetCard.tsx
|   |   |   |-- BetDetail.tsx
|   |   |   |-- BetHistoryTable.tsx
|   |   |   |-- DisputeForm.tsx
|   |   |-- dashboard/
|   |   |   |-- StatsGrid.tsx
|   |   |   |-- RecentBets.tsx
|   |   |   |-- WinRateChart.tsx
|   |   |-- developer/
|   |   |   |-- GameForm.tsx
|   |   |   |-- ApiKeyList.tsx
|   |   |   |-- WebhookManager.tsx
|   |   |   |-- AnalyticsCharts.tsx
|   |   |-- auth/
|   |       |-- LoginForm.tsx
|   |       |-- RegisterForm.tsx
|   |       |-- TwoFactorSetup.tsx
|   |
|   |-- hooks/                           # Client-side React hooks
|   |   |-- useUser.ts
|   |   |-- useBalance.ts
|   |   |-- useBets.ts
|   |   |-- useTransactions.ts
|   |
|   |-- types/                           # Shared TypeScript types
|       |-- api.ts                       # API request/response types
|       |-- bet.ts
|       |-- wallet.ts
|       |-- user.ts
|       |-- developer.ts
|
|-- public/
|   |-- favicon.ico
|   |-- logo.svg
|   |-- widget/
|       |-- sdk.js                       # Lightweight JS SDK for game developers
|                                        # (loads iframe, handles postMessage)
|
|-- docs/
|   |-- architecture/
|   |   |-- schema.prisma
|   |   |-- api-endpoints.md
|   |   |-- system-architecture.md
|   |   |-- directory-structure.md
|   |-- api/
|       |-- developer-guide.md           # Integration guide for game developers
|       |-- widget-guide.md              # Widget embedding instructions
|       |-- webhook-reference.md         # Webhook payload reference
|
|-- scripts/
|   |-- seed-dev.ts                      # Dev environment seeding
|   |-- ledger-audit.ts                  # Manual ledger audit script
|   |-- migrate-and-seed.sh             # CI/CD migration script
|
|-- tests/
|   |-- unit/
|   |   |-- ledger/
|   |   |   |-- transfer.test.ts
|   |   |   |-- escrow.test.ts
|   |   |   |-- audit.test.ts
|   |   |-- bets/
|   |   |   |-- create.test.ts
|   |   |   |-- accept.test.ts
|   |   |   |-- settlement.test.ts
|   |   |-- auth/
|   |       |-- api-key.test.ts
|   |       |-- session.test.ts
|   |
|   |-- integration/
|   |   |-- api/
|   |   |   |-- auth.test.ts
|   |   |   |-- wallet.test.ts
|   |   |   |-- bets.test.ts
|   |   |-- v1/
|   |   |   |-- bet-lifecycle.test.ts    # Full propose->consent->accept->result->verify->settle
|   |   |   |-- consent-flow.test.ts     # Player consent required before escrow
|   |   |   |-- cross-developer.test.ts  # Developer A cannot operate on Developer B's games
|   |   |   |-- dual-source-result.test.ts # Server+widget result verification
|   |   |   |-- escrow-cap.test.ts       # Developer escrow limits enforced
|   |   |   |-- self-bet.test.ts         # Self-betting prevention
|   |   |   |-- idempotency.test.ts
|   |   |   |-- webhook-delivery.test.ts
|   |   |-- workers/
|   |   |   |-- settlement.test.ts
|   |   |   |-- bet-expiry.test.ts
|   |   |   |-- anomaly-detection.test.ts
|   |
|   |-- e2e/
|   |   |-- deposit-and-bet.test.ts
|   |   |-- widget-flow.test.ts
|   |
|   |-- fixtures/
|   |   |-- users.ts
|   |   |-- games.ts
|   |   |-- bets.ts
|   |
|   |-- helpers/
|       |-- db.ts                        # Test DB setup/teardown
|       |-- factory.ts                   # Test data factories
|       |-- stripe-mock.ts              # Stripe API mocking
|
|-- .env.example                         # Documented env vars
|-- .env.local                           # Local overrides (gitignored)
|-- .eslintrc.json
|-- .prettierrc
|-- .gitignore
|-- docker-compose.yml                   # PostgreSQL + Redis for local dev
|-- Dockerfile                           # Production container (app + workers)
|-- next.config.js
|-- package.json
|-- tsconfig.json
|-- tailwind.config.ts
|-- vitest.config.ts                     # Test configuration
```

## Key Design Decisions

### Why separate `lib/` from `app/api/`

API route handlers in `app/api/` are thin controllers. They parse input, call middleware, invoke a function from `lib/`, and format the response. All business logic lives in `lib/` so it can be reused by:
- Website API routes (`app/api/...`)
- Developer API routes (`app/api/v1/...`)
- Background workers (`workers/`)
- Admin routes

This prevents duplication of business logic between the HTTP layer and the job processing layer.

### Why `src/widget/` is a separate directory

The in-game widget is built and deployed as a standalone bundle (separate Vite/esbuild config) that runs inside an iframe on `widget.playstake.com`. It shares TypeScript types with the main app but has its own entry point, styles, and build pipeline. This isolation ensures:
- The widget's CSS does not leak into the host game.
- The widget's JavaScript runs in a sandboxed iframe context.
- The widget can be versioned independently of the main website.

### Why workers are separate from API routes

Background workers run as a separate process (or container) from the Next.js server. This prevents long-running settlement or webhook delivery jobs from consuming API server resources. The entry point `workers/index.ts` registers all job processors and is started via `node dist/workers/index.js` (compiled separately).

### Environment Variables

```
# .env.example

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/playstake

# Redis
REDIS_URL=redis://localhost:6379

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Auth
SESSION_SECRET=<64-byte-hex>
PASSWORD_SALT_ROUNDS=12

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
WIDGET_URL=http://localhost:3001
NEXT_PUBLIC_WIDGET_URL=http://localhost:3001

# Monitoring (optional)
SENTRY_DSN=https://...
DATADOG_API_KEY=...
```
