-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'DEVELOPER', 'ADMIN');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'BET_ESCROW', 'BET_ESCROW_RELEASE', 'BET_ESCROW_REFUND', 'PLATFORM_FEE', 'DEVELOPER_SHARE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('PLAYER_BALANCE', 'DEVELOPER_BALANCE', 'ESCROW', 'PLATFORM_REVENUE', 'STRIPE_SOURCE', 'STRIPE_SINK');

-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('PENDING_CONSENT', 'OPEN', 'MATCHED', 'RESULT_REPORTED', 'SETTLED', 'CANCELLED', 'DISPUTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "BetOutcome" AS ENUM ('PLAYER_A_WIN', 'PLAYER_B_WIN', 'DRAW');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_PLAYER_A', 'RESOLVED_PLAYER_B', 'RESOLVED_DRAW', 'RESOLVED_VOID');

-- CreateEnum
CREATE TYPE "WebhookEventType" AS ENUM ('BET_CREATED', 'BET_MATCHED', 'BET_RESULT_REPORTED', 'BET_SETTLED', 'BET_CANCELLED', 'BET_DISPUTED');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "WidgetSessionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "AnomalyType" AS ENUM ('SKEWED_WIN_RATE', 'RAPID_BET_SETTLEMENT', 'SINGLE_WINNER_PATTERN', 'HIGH_VOLUME_SPIKE', 'RESULT_HASH_MISMATCH');

-- CreateEnum
CREATE TYPE "AnomalyStatus" AS ENUM ('DETECTED', 'INVESTIGATING', 'CONFIRMED_FRAUD', 'FALSE_POSITIVE', 'RESOLVED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "display_name" VARCHAR(100) NOT NULL,
    "avatar_url" VARCHAR(500),
    "kyc_status" "KycStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "stripe_customer_id" VARCHAR(255),
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" VARCHAR(255),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "developer_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "website_url" VARCHAR(500),
    "contact_email" VARCHAR(255) NOT NULL,
    "rev_share_percent" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "developer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" UUID NOT NULL,
    "developer_profile_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "logo_url" VARCHAR(500),
    "webhook_url" VARCHAR(500),
    "webhook_secret" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "max_bet_amount" DECIMAL(12,2) NOT NULL DEFAULT 1000,
    "min_bet_amount" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "platform_fee_percent" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "developer_profile_id" UUID NOT NULL,
    "key_prefix" VARCHAR(8) NOT NULL,
    "key_hash" VARCHAR(255) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY['bet:create', 'bet:read', 'result:report']::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "bet_id" UUID,
    "account_type" "LedgerAccountType" NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "frozen" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "ledger_account_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balance_after" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "description" VARCHAR(500),
    "metadata" JSONB,
    "bet_id" UUID,
    "stripe_payment_id" VARCHAR(255),
    "failure_reason" VARCHAR(500),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bets" (
    "id" UUID NOT NULL,
    "external_id" VARCHAR(255),
    "game_id" UUID NOT NULL,
    "player_a_id" UUID NOT NULL,
    "player_b_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING_CONSENT',
    "outcome" "BetOutcome",
    "platform_fee_percent" DECIMAL(5,4) NOT NULL,
    "platform_fee_amount" DECIMAL(12,2),
    "game_metadata" JSONB,
    "result_payload" JSONB,
    "result_reported_at" TIMESTAMP(3),
    "result_idempotency_key" VARCHAR(255),
    "server_result_hash" VARCHAR(255),
    "widget_result_hash" VARCHAR(255),
    "result_verified" BOOLEAN NOT NULL DEFAULT false,
    "player_a_consented_at" TIMESTAMP(3),
    "player_b_consented_at" TIMESTAMP(3),
    "matched_at" TIMESTAMP(3),
    "settled_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consent_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" UUID NOT NULL,
    "bet_id" UUID NOT NULL,
    "filed_by_id" UUID NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "resolution" TEXT,
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_messages" (
    "id" UUID NOT NULL,
    "dispute_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_configs" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "secret" VARCHAR(255) NOT NULL,
    "events" "WebhookEventType"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_delivery_logs" (
    "id" UUID NOT NULL,
    "webhook_config_id" UUID NOT NULL,
    "bet_id" UUID,
    "event_type" "WebhookEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "http_status" INTEGER,
    "response_body" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "widget_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "status" "WidgetSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "ip_address" VARCHAR(45),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "widget_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_events" (
    "id" UUID NOT NULL,
    "stripe_event_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(255) NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "developer_escrow_limits" (
    "id" UUID NOT NULL,
    "developer_profile_id" UUID NOT NULL,
    "max_total_escrow" DECIMAL(14,2) NOT NULL DEFAULT 50000,
    "max_single_bet" DECIMAL(14,2) NOT NULL DEFAULT 1000,
    "current_escrow" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tier" VARCHAR(50) NOT NULL DEFAULT 'STARTER',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "developer_escrow_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomaly_alerts" (
    "id" UUID NOT NULL,
    "developer_profile_id" UUID NOT NULL,
    "game_id" UUID,
    "type" "AnomalyType" NOT NULL,
    "status" "AnomalyStatus" NOT NULL DEFAULT 'DETECTED',
    "severity" VARCHAR(20) NOT NULL,
    "details" JSONB NOT NULL,
    "auto_action" VARCHAR(100),
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anomaly_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "idx_user_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_user_stripe_customer" ON "users"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "idx_user_role" ON "users"("role");

-- CreateIndex
CREATE INDEX "idx_user_created_at" ON "users"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "idx_session_user" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "idx_session_expires" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "developer_profiles_user_id_key" ON "developer_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "games_slug_key" ON "games"("slug");

-- CreateIndex
CREATE INDEX "idx_game_developer" ON "games"("developer_profile_id");

-- CreateIndex
CREATE INDEX "idx_game_slug" ON "games"("slug");

-- CreateIndex
CREATE INDEX "idx_game_active" ON "games"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "idx_apikey_hash" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "idx_apikey_developer" ON "api_keys"("developer_profile_id");

-- CreateIndex
CREATE INDEX "idx_ledger_account_type" ON "ledger_accounts"("account_type");

-- CreateIndex
CREATE INDEX "idx_ledger_account_user" ON "ledger_accounts"("user_id");

-- CreateIndex
CREATE INDEX "idx_ledger_account_bet" ON "ledger_accounts"("bet_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_account_type" ON "ledger_accounts"("user_id", "account_type");

-- CreateIndex
CREATE INDEX "idx_entry_account_time" ON "ledger_entries"("ledger_account_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_entry_transaction" ON "ledger_entries"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_idempotency_key_key" ON "transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_txn_type_status" ON "transactions"("type", "status");

-- CreateIndex
CREATE INDEX "idx_txn_bet" ON "transactions"("bet_id");

-- CreateIndex
CREATE INDEX "idx_txn_stripe" ON "transactions"("stripe_payment_id");

-- CreateIndex
CREATE INDEX "idx_txn_created" ON "transactions"("created_at");

-- CreateIndex
CREATE INDEX "idx_txn_idempotency" ON "transactions"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "bets_external_id_key" ON "bets"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "bets_result_idempotency_key_key" ON "bets"("result_idempotency_key");

-- CreateIndex
CREATE INDEX "idx_bet_game_status" ON "bets"("game_id", "status");

-- CreateIndex
CREATE INDEX "idx_bet_player_a_status" ON "bets"("player_a_id", "status");

-- CreateIndex
CREATE INDEX "idx_bet_player_b_status" ON "bets"("player_b_id", "status");

-- CreateIndex
CREATE INDEX "idx_bet_status_expires" ON "bets"("status", "expires_at");

-- CreateIndex
CREATE INDEX "idx_bet_created" ON "bets"("created_at");

-- CreateIndex
CREATE INDEX "idx_bet_external" ON "bets"("external_id");

-- CreateIndex
CREATE INDEX "idx_dispute_bet" ON "disputes"("bet_id");

-- CreateIndex
CREATE INDEX "idx_dispute_status" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "idx_dispute_filed_by" ON "disputes"("filed_by_id");

-- CreateIndex
CREATE INDEX "idx_dispute_msg_thread" ON "dispute_messages"("dispute_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_webhook_config_game" ON "webhook_configs"("game_id");

-- CreateIndex
CREATE INDEX "idx_webhook_log_config" ON "webhook_delivery_logs"("webhook_config_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_webhook_log_retry" ON "webhook_delivery_logs"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "idx_webhook_log_bet" ON "webhook_delivery_logs"("bet_id");

-- CreateIndex
CREATE UNIQUE INDEX "widget_sessions_token_hash_key" ON "widget_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "idx_widget_session_token" ON "widget_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "idx_widget_session_user_game" ON "widget_sessions"("user_id", "game_id");

-- CreateIndex
CREATE INDEX "idx_widget_session_expires" ON "widget_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_events_stripe_event_id_key" ON "stripe_events"("stripe_event_id");

-- CreateIndex
CREATE INDEX "idx_stripe_event_id" ON "stripe_events"("stripe_event_id");

-- CreateIndex
CREATE INDEX "idx_stripe_event_unprocessed" ON "stripe_events"("processed", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "developer_escrow_limits_developer_profile_id_key" ON "developer_escrow_limits"("developer_profile_id");

-- CreateIndex
CREATE INDEX "idx_anomaly_developer_status" ON "anomaly_alerts"("developer_profile_id", "status");

-- CreateIndex
CREATE INDEX "idx_anomaly_type_status" ON "anomaly_alerts"("type", "status");

-- CreateIndex
CREATE INDEX "idx_anomaly_created" ON "anomaly_alerts"("created_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developer_profiles" ADD CONSTRAINT "developer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_developer_profile_id_fkey" FOREIGN KEY ("developer_profile_id") REFERENCES "developer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_developer_profile_id_fkey" FOREIGN KEY ("developer_profile_id") REFERENCES "developer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_bet_id_fkey" FOREIGN KEY ("bet_id") REFERENCES "bets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_ledger_account_id_fkey" FOREIGN KEY ("ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bet_id_fkey" FOREIGN KEY ("bet_id") REFERENCES "bets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_player_a_id_fkey" FOREIGN KEY ("player_a_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_player_b_id_fkey" FOREIGN KEY ("player_b_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_bet_id_fkey" FOREIGN KEY ("bet_id") REFERENCES "bets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_filed_by_id_fkey" FOREIGN KEY ("filed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_configs" ADD CONSTRAINT "webhook_configs_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_delivery_logs" ADD CONSTRAINT "webhook_delivery_logs_webhook_config_id_fkey" FOREIGN KEY ("webhook_config_id") REFERENCES "webhook_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_delivery_logs" ADD CONSTRAINT "webhook_delivery_logs_bet_id_fkey" FOREIGN KEY ("bet_id") REFERENCES "bets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widget_sessions" ADD CONSTRAINT "widget_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developer_escrow_limits" ADD CONSTRAINT "developer_escrow_limits_developer_profile_id_fkey" FOREIGN KEY ("developer_profile_id") REFERENCES "developer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
