-- CreateEnum
CREATE TYPE "KycSubmissionPurpose" AS ENUM ('IDENTITY', 'ADDRESS_UPDATE');

-- AlterTable
ALTER TABLE "kyc_submissions" ADD COLUMN     "purpose" "KycSubmissionPurpose" NOT NULL DEFAULT 'IDENTITY';

