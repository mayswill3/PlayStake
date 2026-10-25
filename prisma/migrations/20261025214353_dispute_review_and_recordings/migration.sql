-- CreateEnum
CREATE TYPE "MatchRecordingRole" AS ENUM ('PLAYER_A', 'PLAYER_B', 'REFEREE');

-- CreateEnum
CREATE TYPE "MatchRecordingStatus" AS ENUM ('RECORDING', 'READY', 'FAILED', 'DELETED');

-- AlterTable
ALTER TABLE "disputes" ADD COLUMN     "moments" JSONB,
ADD COLUMN     "review_claimed_at" TIMESTAMP(3),
ADD COLUMN     "reviewer_id" UUID;

-- AlterTable
ALTER TABLE "referee_profiles" ADD COLUMN     "can_review_disputes" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dispute_reviewer_approved_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "match_recordings" (
    "id" UUID NOT NULL,
    "bet_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "MatchRecordingRole" NOT NULL,
    "channel_slug" VARCHAR(100) NOT NULL,
    "status" "MatchRecordingStatus" NOT NULL DEFAULT 'RECORDING',
    "storage_key" VARCHAR(500),
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "byte_size" BIGINT,
    "failure_reason" VARCHAR(500),
    "retain_until" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_match_recording_retain" ON "match_recordings"("retain_until");

-- CreateIndex
CREATE UNIQUE INDEX "uq_match_recording_role" ON "match_recordings"("bet_id", "role");

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_recordings" ADD CONSTRAINT "match_recordings_bet_id_fkey" FOREIGN KEY ("bet_id") REFERENCES "bets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_recordings" ADD CONSTRAINT "match_recordings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

