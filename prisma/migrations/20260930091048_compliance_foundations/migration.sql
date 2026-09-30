-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED', 'CLOSED_UNDERAGE');

-- CreateEnum
CREATE TYPE "GamstopStatus" AS ENUM ('NOT_EXCLUDED', 'EXCLUDED', 'PREVIOUSLY_EXCLUDED');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('AUTOMATED_MESSAGE', 'EMAIL', 'PHONE_CALL', 'DEPOSIT_LIMIT_APPLIED', 'COOL_OFF_APPLIED', 'ACCOUNT_RESTRICTED', 'NOTE');

-- CreateEnum
CREATE TYPE "InteractionOutcome" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'CUSTOMER_SET_LIMIT', 'CUSTOMER_TOOK_BREAK', 'BEHAVIOUR_IMPROVED', 'BEHAVIOUR_UNCHANGED', 'ESCALATED', 'NO_RESPONSE');

-- CreateEnum
CREATE TYPE "ComplaintCategory" AS ENUM ('ACCOUNT', 'PAYMENTS', 'WITHDRAWALS', 'BET_OR_RESULT', 'REFEREE', 'RESPONSIBLE_GAMBLING', 'TECHNICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'AWAITING_CUSTOMER', 'FINAL_RESPONSE_ISSUED');

-- CreateEnum
CREATE TYPE "ComplaintOutcome" AS ENUM ('UPHELD', 'PARTIALLY_UPHELD', 'NOT_UPHELD');

-- CreateEnum
CREATE TYPE "AmlCaseType" AS ENUM ('CHIP_DUMPING', 'DEPOSIT_WITHDRAW_NO_PLAY', 'HIGH_DEPOSIT_VOLUME', 'SHARED_IDENTITY', 'SHARED_IP', 'CHARGEBACK', 'DOB_MISMATCH', 'MANUAL');

-- CreateEnum
CREATE TYPE "AmlCaseStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'ESCALATED_TO_MLRO', 'SAR_SUBMITTED', 'CLOSED_NO_ACTION', 'CLOSED_ACTION_TAKEN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PlayerRiskType" ADD VALUE 'DEPOSIT_VELOCITY';
ALTER TYPE "PlayerRiskType" ADD VALUE 'HIGH_DEPOSIT_VOLUME';
ALTER TYPE "PlayerRiskType" ADD VALUE 'LATE_NIGHT_PLAY';

-- DropForeignKey
ALTER TABLE "kyc_submissions" DROP CONSTRAINT "kyc_submissions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "play_breaks" DROP CONSTRAINT "play_breaks_user_id_fkey";

-- DropForeignKey
ALTER TABLE "player_risk_signals" DROP CONSTRAINT "player_risk_signals_user_id_fkey";

-- AlterTable
ALTER TABLE "beta_signups" ADD COLUMN     "unsubscribed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "play_breaks" ADD COLUMN     "return_effective_at" TIMESTAMP(3),
ADD COLUMN     "return_requested_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "player_risk_signals" ADD COLUMN     "review_notes" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "account_status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "account_status_changed_at" TIMESTAMP(3),
ADD COLUMN     "account_status_reason" VARCHAR(500),
ADD COLUMN     "age_confirmed_at" TIMESTAMP(3),
ADD COLUMN     "date_of_birth" DATE,
ADD COLUMN     "gamstop_checked_at" TIMESTAMP(3),
ADD COLUMN     "gamstop_status" "GamstopStatus",
ADD COLUMN     "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketing_consent_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "customer_interactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "risk_signal_id" UUID,
    "type" "InteractionType" NOT NULL,
    "message" TEXT NOT NULL,
    "created_by_id" UUID,
    "acknowledged_at" TIMESTAMP(3),
    "outcome" "InteractionOutcome" NOT NULL DEFAULT 'PENDING',
    "outcome_notes" TEXT,
    "outcome_recorded_at" TIMESTAMP(3),
    "follow_up_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(24) NOT NULL,
    "user_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "category" "ComplaintCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "bet_id" UUID,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),
    "final_response_due_at" TIMESTAMP(3) NOT NULL,
    "final_response" TEXT,
    "final_response_at" TIMESTAMP(3),
    "outcome" "ComplaintOutcome",
    "handled_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_events" (
    "id" UUID NOT NULL,
    "complaint_id" UUID NOT NULL,
    "actor_id" UUID,
    "type" VARCHAR(40) NOT NULL,
    "body" TEXT,
    "visible_to_customer" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aml_cases" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "related_user_id" UUID,
    "type" "AmlCaseType" NOT NULL,
    "status" "AmlCaseStatus" NOT NULL DEFAULT 'OPEN',
    "severity" VARCHAR(20) NOT NULL,
    "details" JSONB NOT NULL,
    "assigned_to_id" UUID,
    "mlro_decision" TEXT,
    "sar_reference" VARCHAR(100),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aml_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aml_case_notes" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aml_case_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "target_type" VARCHAR(40) NOT NULL,
    "target_id" VARCHAR(64),
    "details" JSONB NOT NULL,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_interaction_user" ON "customer_interactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_interaction_unacknowledged" ON "customer_interactions"("user_id", "type", "acknowledged_at");

-- CreateIndex
CREATE INDEX "idx_interaction_follow_up" ON "customer_interactions"("outcome", "follow_up_at");

-- CreateIndex
CREATE UNIQUE INDEX "complaints_reference_key" ON "complaints"("reference");

-- CreateIndex
CREATE INDEX "idx_complaint_status_due" ON "complaints"("status", "final_response_due_at");

-- CreateIndex
CREATE INDEX "idx_complaint_user" ON "complaints"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_complaint_email" ON "complaints"("email");

-- CreateIndex
CREATE INDEX "idx_complaint_event_thread" ON "complaint_events"("complaint_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_aml_case_status" ON "aml_cases"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_aml_case_user_type" ON "aml_cases"("user_id", "type", "status");

-- CreateIndex
CREATE INDEX "idx_aml_note_case" ON "aml_case_notes"("case_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_admin_audit_actor" ON "admin_audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_admin_audit_target" ON "admin_audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "idx_admin_audit_created" ON "admin_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_user_account_status" ON "users"("account_status");

-- AddForeignKey
ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "play_breaks" ADD CONSTRAINT "play_breaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_risk_signals" ADD CONSTRAINT "player_risk_signals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_interactions" ADD CONSTRAINT "customer_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_interactions" ADD CONSTRAINT "customer_interactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_interactions" ADD CONSTRAINT "customer_interactions_risk_signal_id_fkey" FOREIGN KEY ("risk_signal_id") REFERENCES "player_risk_signals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_events" ADD CONSTRAINT "complaint_events_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_events" ADD CONSTRAINT "complaint_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aml_cases" ADD CONSTRAINT "aml_cases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aml_cases" ADD CONSTRAINT "aml_cases_related_user_id_fkey" FOREIGN KEY ("related_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aml_cases" ADD CONSTRAINT "aml_cases_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aml_case_notes" ADD CONSTRAINT "aml_case_notes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "aml_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aml_case_notes" ADD CONSTRAINT "aml_case_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Complaint reference numbers (PS-C-<year>-<n>) come from a sequence so two
-- complaints filed at the same moment can never share one.
CREATE SEQUENCE "complaint_reference_seq" START 1;

-- The admin audit log must stay intact even if application code is changed.
CREATE OR REPLACE FUNCTION reject_admin_audit_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'admin audit log is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "admin_audit_logs_immutable"
BEFORE UPDATE OR DELETE ON "admin_audit_logs"
FOR EACH ROW EXECUTE FUNCTION reject_admin_audit_mutation();
