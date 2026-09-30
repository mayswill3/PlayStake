-- AlterTable
ALTER TABLE "deposit_limits" ADD COLUMN     "pending_removal" BOOLEAN NOT NULL DEFAULT false;
