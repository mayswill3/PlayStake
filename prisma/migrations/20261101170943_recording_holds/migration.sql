-- AlterTable
ALTER TABLE "match_recordings" ADD COLUMN     "held_at" TIMESTAMP(3),
ADD COLUMN     "held_by_id" UUID,
ADD COLUMN     "held_reason" VARCHAR(500);

