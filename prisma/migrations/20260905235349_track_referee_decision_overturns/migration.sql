-- AlterTable
ALTER TABLE "referee_assignments" ADD COLUMN     "overturned_at" TIMESTAMP(3),
ADD COLUMN     "overturned_outcome" "BetOutcome";

-- CreateIndex
CREATE INDEX "idx_referee_assignment_overturned" ON "referee_assignments"("overturned_at");
