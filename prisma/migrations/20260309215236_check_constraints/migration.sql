-- =============================================================================
-- PlayStake CHECK Constraints
-- =============================================================================
-- These constraints enforce business rules at the database level that cannot
-- be expressed in Prisma schema natively. They provide a final safety net
-- against invalid data regardless of application-level bugs.
-- =============================================================================

-- Prevent negative balances on all ledger accounts.
-- Every account (player, developer, escrow, platform) must have balance >= 0.
ALTER TABLE ledger_accounts ADD CONSTRAINT chk_balance_non_negative
  CHECK (balance >= 0);

-- Enforce cent rounding on ledger account balances.
ALTER TABLE ledger_accounts ADD CONSTRAINT chk_balance_cents
  CHECK (balance = ROUND(balance, 2));

-- Prevent negative or zero bet amounts. Every bet must wager a positive amount.
ALTER TABLE bets ADD CONSTRAINT chk_bet_amount_positive
  CHECK (amount > 0);

-- Enforce cent rounding on bet amounts.
ALTER TABLE bets ADD CONSTRAINT chk_bet_amount_cents
  CHECK (amount = ROUND(amount, 2));

-- Prevent self-betting: player A cannot also be player B on the same bet.
ALTER TABLE bets ADD CONSTRAINT chk_no_self_bet
  CHECK (player_a_id != player_b_id);

-- Platform fee percentage on bets must be between 0% and 100% (0.0000 to 1.0000).
ALTER TABLE bets ADD CONSTRAINT chk_fee_percent_range
  CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 1);

-- Prevent negative or zero transaction amounts.
ALTER TABLE transactions ADD CONSTRAINT chk_txn_amount_positive
  CHECK (amount > 0);

-- Enforce cent rounding on transaction amounts.
ALTER TABLE transactions ADD CONSTRAINT chk_txn_amount_cents
  CHECK (amount = ROUND(amount, 2));

-- Developer escrow limits must be positive, and current escrow cannot be negative.
ALTER TABLE developer_escrow_limits ADD CONSTRAINT chk_escrow_non_negative
  CHECK (current_escrow >= 0 AND max_total_escrow > 0 AND max_single_bet > 0);

-- Game-level fee percentage must be between 0% and 100%.
ALTER TABLE games ADD CONSTRAINT chk_game_fee_percent_range
  CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 1);

-- Game min bet must be positive, max bet must be >= min bet.
ALTER TABLE games ADD CONSTRAINT chk_game_bet_amount_range
  CHECK (min_bet_amount > 0 AND max_bet_amount >= min_bet_amount);

-- Developer rev-share percentage must be between 0% and 100%.
ALTER TABLE developer_profiles ADD CONSTRAINT chk_rev_share_range
  CHECK (rev_share_percent >= 0 AND rev_share_percent <= 1);
