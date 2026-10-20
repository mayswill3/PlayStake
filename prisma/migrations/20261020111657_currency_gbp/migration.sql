-- AlterTable
ALTER TABLE "bets" ALTER COLUMN "currency" SET DEFAULT 'GBP';

-- AlterTable
ALTER TABLE "ledger_accounts" ALTER COLUMN "currency" SET DEFAULT 'GBP';

-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "currency" SET DEFAULT 'GBP';

-- Relabel existing rows. Everything recorded so far is beta test money
-- (Stripe test mode, no real-money wagering), and amounts are not converted:
-- the platform's limits and thresholds keep the same figures in pounds.
-- ledger_entries carry no currency and are untouched.
UPDATE "ledger_accounts" SET "currency" = 'GBP' WHERE "currency" = 'USD';
UPDATE "transactions" SET "currency" = 'GBP' WHERE "currency" = 'USD';
UPDATE "bets" SET "currency" = 'GBP' WHERE "currency" = 'USD';
