# PlayStake Production Security Review

**Review date:** 2026-08-06
**Scope:** Authentication, session security, payments, ledger/escrow, webhooks,
developer integrations, referee settlement and deployment controls.

## Decision

PlayStake is suitable for continued development and test-mode demonstrations.
It is **not approved for real-money production launch**. Live card charging and
withdrawals are deliberately disabled in code unless a Stripe test secret is
configured. This is a policy and regulatory boundary, not just an engineering
task: the current skill-game wager and prize model needs written approval from
an appropriate payment provider plus jurisdiction-specific legal advice.

## Controls implemented and verified in code

- Passwords use a strong password hash and sessions store only token hashes in
  HttpOnly, Secure, SameSite cookies.
- Email verification and password recovery now use random, hashed, expiring,
  single-use database tokens. Password reset revokes every active session.
- TOTP secrets are encrypted with AES-256-GCM. TOTP replay is blocked and eight
  hashed, single-use backup codes are issued during setup.
- Google and Kick OAuth use state validation; Kick additionally uses PKCE and
  encrypted access/refresh token storage.
- Browser cross-site API mutations are rejected before route handling. Common
  transport, MIME-sniffing, referrer and browser-permission headers are set.
- Ledger transfers use double-entry records, atomic conditional debits and
  frozen-account checks. Non-system balances have database constraints.
- Application transactions default to `SERIALIZABLE` and retry PostgreSQL write
  conflicts. Settlement also uses transaction-scoped advisory and row locks.
- Result settlement requires the implemented verification/referee workflow,
  enforces escrow balance expectations and retains audit evidence.
- Idempotency keys are bound to operation parameters and user ownership. Ledger
  replays must match amount, accounts, bet and transaction type exactly.
- Stripe webhooks verify signatures, persist event IDs, reject duplicates and
  return 5xx on processing failure so delivery is retried.
- Withdrawals no longer pay the platform's bank account. Test-mode users must
  complete a persisted Stripe Express connected-account onboarding flow, and
  test transfers go to that account.
- Stripe account status is synchronized by API checks and signed webhooks.
- Real Stripe keys fail closed: deposits, Connect onboarding and withdrawals
  accept `sk_test_` keys only.

## Open findings before any real-money launch

### Critical: provider and legal approval

Obtain written approval for the exact player-versus-player wager, prize,
referee-fee and developer-revenue flows. Complete gambling/skill-game analysis,
licensing, age/identity checks, sanctions screening, geofencing, tax treatment,
responsible-play controls and consumer disclosures for every launch territory.
Do not remove the test-only code gate until this is complete.

### Critical: public developer result API is incomplete

The widget references `/api/v1/bets` endpoints that are not present in the app.
The demo result bridge also calls a missing result endpoint. Do not distribute
the widget or developer API as production-ready. Before exposure, implement the
routes with scoped API keys, game ownership checks, player consent, result
signatures, dual-source confirmation, strict schemas and adversarial tests.

### High: durable payment reconciliation

Stripe request idempotency makes an interrupted deposit or test transfer safe
to resume, but recovery currently depends on a retry. Add a durable payment
outbox/reconciliation worker that locates incomplete ledger/external-payment
pairs, retries them, alerts on age thresholds and requires operations review for
unresolved entries.

### High: distributed abuse protection

Some route and login throttles are process-local. Before running more than one
application process, move all login, recovery, registration, challenge and
payment limits to Redis with atomic counters. Rate-limit by both account and IP,
and add credential-stuffing and breached-password monitoring.

### High: operational and worker controls

Run settlement, expiry, dispute escalation, webhook delivery and ledger-audit
workers as separately monitored services. Add dead-letter queues, alerting,
runbooks, tested backup restoration, database point-in-time recovery and a
documented incident-response process.

### High: independent assessment

Commission an independent penetration test and payment/ledger architecture
review. Resolve findings, run concurrency/fault-injection tests against a real
PostgreSQL/Redis test environment, and perform a launch readiness review.

### Medium: browser policy hardening

A strict Content Security Policy is not yet enabled because the current theme
bootstrap and structured-data scripts are inline and the external widget needs
an explicit embedding policy. Replace inline executable script with a nonce or
hash strategy, define `frame-ancestors` deliberately, and deploy CSP in
report-only mode before enforcement.

### Medium: privileged operations

Require recent re-authentication for enabling/disabling 2FA and changing payout
details. Add dual approval and append-only audit events for any future admin
ledger adjustment, account unfreeze, dispute override or manual payment action.

## Required production configuration

- Generate separate 32-byte `AUTH_ENCRYPTION_KEY`,
  `KICK_TOKEN_ENCRYPTION_KEY` and `AUDIT_IP_SALT` values; never reuse them.
- Set `NEXT_PUBLIC_APP_URL=https://playstake.org` and restrict
  `ALLOWED_ORIGINS` to controlled HTTPS origins.
- Verify `playstake.org` with the email provider, set SPF/DKIM/DMARC, configure
  `RESEND_API_KEY`, and send from `PlayStake <support@playstake.org>`.
- Keep `STRIPE_SECRET_KEY` in test mode and set `STRIPE_CONNECT_COUNTRY` to the
  approved platform country during testing.
- Subscribe the Stripe webhook to payment intent, connected account and legacy
  payout events; rotate and store the signing secret securely.
- Apply database migrations before deploying application code, then verify the
  worker services and webhook endpoints.

## Re-review triggers

Repeat this review before enabling real money, adding a territory, changing the
settlement/referee model, exposing the developer API, changing a payment
provider, or introducing a new administrator money-movement capability.
