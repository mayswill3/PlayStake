-- AlterEnum
ALTER TYPE "MatchRecordingRole" ADD VALUE 'VOICE';

-- DropIndex
DROP INDEX "uq_match_recording_role";

-- AlterTable
ALTER TABLE "match_recordings" ADD COLUMN     "segment" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "uq_match_recording_role_segment" ON "match_recordings"("bet_id", "role", "segment");

