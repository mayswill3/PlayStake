-- CreateEnum
CREATE TYPE "DepositLimitPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "PlayBreakType" AS ENUM ('COOL_OFF', 'SELF_EXCLUSION');

-- CreateTable
CREATE TABLE "deposit_limits" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "period" "DepositLimitPeriod" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "pending_amount" DECIMAL(14,2),
    "pending_effective_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deposit_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "play_breaks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "PlayBreakType" NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "play_breaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responsible_play_settings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_reminder_minutes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "responsible_play_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_deposit_limit_pending" ON "deposit_limits"("pending_effective_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_deposit_limit_user_period" ON "deposit_limits"("user_id", "period");

-- CreateIndex
CREATE INDEX "idx_play_break_user_active" ON "play_breaks"("user_id", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "responsible_play_settings_user_id_key" ON "responsible_play_settings"("user_id");

-- AddForeignKey
ALTER TABLE "deposit_limits" ADD CONSTRAINT "deposit_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "play_breaks" ADD CONSTRAINT "play_breaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsible_play_settings" ADD CONSTRAINT "responsible_play_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deposit-limit checks sum a user's recent deposits, and Transaction stores the
-- owning user inside its JSON metadata rather than a column. Index that path so
-- the check stays cheap as the transactions table grows.
CREATE INDEX "idx_txn_deposit_user_created"
  ON "transactions" ((metadata->>'userId'), "created_at")
  WHERE "type" = 'DEPOSIT';
