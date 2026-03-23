-- Allow system ledger accounts (STRIPE_SOURCE, STRIPE_SINK, PLATFORM_REVENUE)
-- to carry negative balances. These represent external funding sources/sinks
-- and are not bound by the same balance rules as player accounts.

-- Drop the blanket non-negative constraint
ALTER TABLE ledger_accounts DROP CONSTRAINT IF EXISTS chk_balance_non_negative;

-- Re-add it only for non-system account types
ALTER TABLE ledger_accounts ADD CONSTRAINT chk_balance_non_negative
  CHECK (
    balance >= 0
    OR account_type IN ('STRIPE_SOURCE', 'STRIPE_SINK', 'PLATFORM_REVENUE')
  );
