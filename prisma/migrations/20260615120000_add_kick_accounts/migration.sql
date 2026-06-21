-- CreateTable
CREATE TABLE "kick_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kick_user_id" VARCHAR(255) NOT NULL,
    "channel_slug" VARCHAR(255),
    "email" VARCHAR(255),
    "display_name" VARCHAR(255),
    "profile_picture" VARCHAR(500),
    "access_token_enc" TEXT NOT NULL,
    "refresh_token_enc" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kick_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kick_accounts_user_id_key" ON "kick_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "kick_accounts_kick_user_id_key" ON "kick_accounts"("kick_user_id");

-- CreateIndex
CREATE INDEX "idx_kick_account_kick_user" ON "kick_accounts"("kick_user_id");

-- AddForeignKey
ALTER TABLE "kick_accounts" ADD CONSTRAINT "kick_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
