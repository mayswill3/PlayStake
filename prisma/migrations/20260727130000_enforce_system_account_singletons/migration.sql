-- PLATFORM_REVENUE, STRIPE_SOURCE, and STRIPE_SINK are global singleton
-- accounts. PostgreSQL treats NULL values as distinct in the existing
-- (user_id, account_type) unique constraint, so enforce their real invariant
-- with a partial unique index.
CREATE UNIQUE INDEX "uq_system_ledger_account_type"
ON "ledger_accounts" ("account_type")
WHERE "user_id" IS NULL
  AND "account_type" IN (
      'PLATFORM_REVENUE',
      'STRIPE_SOURCE',
      'STRIPE_SINK'
  );
