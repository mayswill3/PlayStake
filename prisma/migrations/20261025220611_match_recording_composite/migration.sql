-- AlterEnum
ALTER TYPE "MatchRecordingRole" ADD VALUE 'COMPOSITE';

-- AlterTable
ALTER TABLE "match_recordings" ADD COLUMN     "sha256" VARCHAR(64);

