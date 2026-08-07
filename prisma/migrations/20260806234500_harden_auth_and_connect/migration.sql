CREATE TYPE "AuthTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

ALTER TABLE "users"
    ADD COLUMN "stripe_connect_account_id" VARCHAR(255),
    ADD COLUMN "stripe_connect_details_submitted" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "stripe_connect_payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "two_factor_last_used_step" INTEGER,
    ALTER COLUMN "two_factor_secret" TYPE VARCHAR(512);

CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "two_factor_backup_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "two_factor_backup_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_stripe_connect_account_id_key" ON "users"("stripe_connect_account_id");
CREATE INDEX "idx_user_stripe_connect_account" ON "users"("stripe_connect_account_id");
CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");
CREATE INDEX "idx_auth_token_user_type" ON "auth_tokens"("user_id", "type");
CREATE INDEX "idx_auth_token_expires" ON "auth_tokens"("expires_at");
CREATE UNIQUE INDEX "uq_two_factor_backup_user_code" ON "two_factor_backup_codes"("user_id", "code_hash");
CREATE INDEX "idx_two_factor_backup_user_used" ON "two_factor_backup_codes"("user_id", "used_at");

ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "two_factor_backup_codes" ADD CONSTRAINT "two_factor_backup_codes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users" ADD CONSTRAINT "chk_two_factor_state"
    CHECK (NOT two_factor_enabled OR two_factor_secret IS NOT NULL);
