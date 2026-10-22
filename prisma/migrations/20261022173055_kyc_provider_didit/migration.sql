-- CreateEnum
CREATE TYPE "KycProvider" AS ENUM ('MANUAL', 'DIDIT');

-- AlterEnum
ALTER TYPE "KycDocumentType" ADD VALUE 'RESIDENCE_PERMIT';

-- AlterTable
ALTER TABLE "kyc_submissions" ADD COLUMN     "provider" "KycProvider" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "provider_session_id" VARCHAR(64),
ADD COLUMN     "provider_status" VARCHAR(30),
ADD COLUMN     "provider_summary" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "kyc_submissions_provider_session_id_key" ON "kyc_submissions"("provider_session_id");

