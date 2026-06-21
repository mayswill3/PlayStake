-- AlterTable
ALTER TABLE "kick_accounts" ADD COLUMN "is_live" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "kick_accounts" ADD COLUMN "last_live_at" TIMESTAMP(3);
