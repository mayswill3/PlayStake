-- CreateEnum
CREATE TYPE "PlayerRiskType" AS ENUM ('LOSS_CHASING_STAKES', 'LOSS_CHASING_DEPOSITS');

-- CreateEnum
CREATE TYPE "PlayerRiskStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED');

-- CreateTable
CREATE TABLE "player_risk_signals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "PlayerRiskType" NOT NULL,
    "status" "PlayerRiskStatus" NOT NULL DEFAULT 'OPEN',
    "severity" VARCHAR(20) NOT NULL,
    "details" JSONB NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_risk_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_player_risk_status" ON "player_risk_signals"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_player_risk_user_type" ON "player_risk_signals"("user_id", "type", "created_at");

-- AddForeignKey
ALTER TABLE "player_risk_signals" ADD CONSTRAINT "player_risk_signals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_risk_signals" ADD CONSTRAINT "player_risk_signals_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
