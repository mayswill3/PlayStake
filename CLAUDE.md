# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PlayStake is a real-money peer-to-peer wagering platform for competitive games. Players deposit via Stripe, wager against each other, and withdraw winnings. Every dollar moves through a **double-entry ledger** with per-bet escrow accounts, dual-source result verification, and background anomaly detection. Money is the invariant — most of the complexity exists to make it impossible to create or destroy funds by accident.

Stack: Next.js 16 (App Router, `output: standalone`) on Node 20 · TypeScript · PostgreSQL 16 + Prisma 7 · Redis 7 + BullMQ · Stripe · Zod · Tailwind 4 · Vitest.

## Commands

```bash
# Infrastructure (Postgres + Redis via Docker)
npm run db:up            # start containers
npm run db:down

# Database
npm run db:migrate       # prisma migrate dev (creates + applies a migration)
npm run db:seed          # tsx prisma/seed.ts — test users, games, sample data
npm run db:reset         # drop, re-migrate, re-seed
npm run db:studio
npm run prisma:generate  # regenerate client into generated/prisma (see note below)

# Run the app (needs 3 processes locally)
npm run dev              # Next.js website + API on :3000
npm run workers          # BullMQ background workers (settlement, expiry, webhooks, ...)
npm run workers:dev      # workers with --watch
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Tests (Vitest)
npm test                 # all tests, run once
npm run test:watch
npm run test:ledger      # only tests/unit/ledger/
npm run test:auth        # only tests/unit/auth/
npm run test:integration # only tests/integration/
npx vitest run tests/integration/settlement.test.ts   # a single file
npx vitest run -t "insufficient funds"                # a single test by name

# Widget (standalone bundle, built separately from Next.js)
npm run widget:build          # → public/widget/{widget.js,widget.css,index.html}
npm run widget:build:prod

npm run lint                  # next lint
npm run build                 # prisma generate && next build
```

**Integration tests hit a real database.** They run against `DATABASE_URL` (use the Docker Postgres), invoke Next.js route handlers directly without an HTTP server (see `tests/integration/helpers.ts`), and `vitest.config.ts` sets `fileParallelism: false` to avoid connection-pool exhaustion — don't parallelize them.

## Prisma client is generated to a non-standard path

The client is emitted to `generated/prisma/` (configured in `prisma/schema.prisma`), **not** `@prisma/client`. Import types and enums from the relative path, e.g. `../../generated/prisma/client`. Runtime helpers like `Decimal` come from `@prisma/client/runtime/client`. The driver-adapter pattern (`PrismaPg`) is used everywhere — see `src/lib/db/client.ts`. After changing `schema.prisma`, run `npm run prisma:generate`. `npm run build` regenerates automatically.

## Architecture

### The ledger is the core (`src/lib/ledger/`)

All money movement flows through this module — treat it as the trust boundary.

- **`transfer.ts` — `transfer(tx, input)` is the ONLY function permitted to modify `ledger_accounts.balance`.** It creates exactly two `LedgerEntry` rows (debit negative + credit positive) that sum to zero, records a `balanceAfter` snapshot on each, and enforces sufficient funds with an atomic `UPDATE ... WHERE balance >= amount` raw query. It is idempotent on `idempotencyKey`. System accounts (`STRIPE_SOURCE`, `STRIPE_SINK`, `PLATFORM_REVENUE`) are allowed to go negative; player/developer/escrow accounts are not. Never write balances directly — always go through `transfer`.
- **`escrow.ts`** — bet-level operations (`holdEscrow`, `releaseEscrow`, `refundEscrow`, `collectFee`, `distributeDevShare`) composed from `transfer`. Per-bet escrow must net to zero at settlement or cancellation.
- **`accounts.ts`** — get-or-create for player/developer/escrow/system accounts.
- **`audit.ts`** — invariant verification (per-account, per-transaction, system-wide conservation). Run continuously by the ledger-audit worker; also exercised in tests.

Ledger functions take a `TxClient` (Prisma interactive-transaction client) as their first argument so callers compose them inside a single transaction boundary. Wrap multi-step money operations in `withTransaction(fn)` from `src/lib/db/client.ts`.

### Money representation

API request/response bodies use **integer cents**. The ledger stores `Decimal` USD. Convert at the boundary with `src/lib/utils/money.ts` (`centsToDollars`, etc.). Don't mix the two.

### Request layers (`src/lib/middleware/`)

API routes compose middleware for `auth`, `rate-limit` (Redis-backed), `idempotency`, and `validate` (Zod schemas in `src/lib/validation/schemas.ts`). Auth mechanisms in `src/lib/auth/`: session cookies (`session.ts`) for the website, API keys (`api-key.ts`) for developer/game-server calls, and short-lived widget tokens (`widget-token.ts`) for in-game actions. Errors are thrown as typed `AppError` subclasses from `src/lib/errors/`.

### Bet lifecycle

`PENDING_CONSENT → OPEN → MATCHED → RESULT_REPORTED → SETTLED` (or `CANCELLED` / `DISPUTED` / `VOIDED`). Funds are **not** escrowed until a player explicitly consents (bets start `PENDING_CONSENT` with nothing locked). Results are dual-sourced — the game server and the client widget report independently, and a mismatch auto-triggers a dispute. Settlement happens only after a dispute window elapses, in a worker (not inline).

### Background workers (`src/workers/`, `src/lib/jobs/`)

A **separate process** from the web app (`npm run workers`, `Procfile` `worker:`). `src/workers/index.ts` boots all workers and calls `registerSchedules()`. Queues/connection live in `src/lib/jobs/queue.ts` (shared IORedis, 3 attempts, exponential backoff); schedules and job-name constants in `schedules.ts` / `types.ts`. Workers: settlement, consent-expiry, bet-expiry, webhook-delivery, unverified-result, anomaly-detection, dispute-escalation, ledger-audit, lobby-expiry. Time-sensitive state transitions (expiry, settlement, escalation) belong in workers, not request handlers.

### Lobby / matchmaking (`src/lib/lobby/`)

Real-time matchmaking layer: `service.ts` holds the business logic (reused by routes and the lobby-expiry worker), `pubsub.ts` publishes lobby events over Redis (consumed by the SSE endpoint `/api/lobby/stream`). Waiting entries and invites have short TTLs (see constants at the top of `service.ts`).

### Kick streaming integration (`src/lib/kick/`, `/api/webhooks/kick`)

OAuth link to Kick accounts, live-status polling, and inbound webhooks power the "Live Now" dashboard rail and the in-app stream pages (`src/app/(dashboard)/streams/[slug]`).

### Outbound webhooks (`src/lib/webhooks/`)

Bet-lifecycle notifications to developers, HMAC-SHA256 signed (`sign.ts`), delivered with retry/backoff by the webhook-delivery worker (`dispatch.ts`).

### The widget (`src/widget/`)

A standalone React 19 app bundled by `widget.build.ts` (esbuild, React bundled in) to `public/widget/`. It is **not** part of the Next.js build — rebuild it separately with `npm run widget:build`. `/widget` is rewritten to the built `index.html` in `next.config.ts`. `public/widget/sdk.js` is the lightweight loader game developers embed.

### Demo / play games (`src/app/play/`, `/api/demo/`)

Playable demo games (darts, cards, tic-tac-toe) used to exercise the bet flow without a real game-server integration. `/demo` and `/demo/*` are permanently redirected to `/play` (`next.config.ts`).

## App Router route groups (`src/app/`)

- `(auth)` — login, register, verify-email, password reset
- `(dashboard)` — player wallet, deposit/withdraw, bets, settings, streams
- `(admin)` — disputes, anomalies, user management, ledger oversight
- `api/` — all API routes, **session- or API-key-authed by handler** (there is no `/api/v1` prefix and no `(developer)` route group despite what older README sections imply — the app pivoted to lobby matchmaking + Kick streaming). Notable groups: `auth`, `wallet`, `bets`, `lobby`, `kick`, `streamers`, `demo`, `admin`, `webhooks/{stripe,kick}`.

> Note: `README.md` documents an aspirational developer-API/widget product (a `/api/v1/...` surface, a developer portal, `src/lib/bets`, `src/lib/security`). Those paths do **not** exist in the current tree — trust the code over that section of the README.

## Deployment

Hosted on Railway (Postgres + Redis + the Next.js app). `Procfile` defines two process types: `web` (runs `prisma migrate deploy` then `next start`) and `worker`. CI runs a supply-chain malware scan (`.github/workflows/malware-scan.yml`, `scripts/scan-malware.sh`).
