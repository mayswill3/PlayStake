-- AlterTable
ALTER TABLE "users" ADD COLUMN     "funds_protection_acknowledged_at" TIMESTAMP(3),
ADD COLUMN     "funds_protection_version" VARCHAR(40);

