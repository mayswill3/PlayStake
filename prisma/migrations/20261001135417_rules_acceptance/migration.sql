-- AlterTable
ALTER TABLE "referee_profiles" ADD COLUMN     "code_accepted_at" TIMESTAMP(3),
ADD COLUMN     "code_version" VARCHAR(20);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "match_rules_accepted_at" TIMESTAMP(3),
ADD COLUMN     "match_rules_version" VARCHAR(20);
