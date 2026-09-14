-- CreateTable
CREATE TABLE "match_chat_messages" (
    "id" UUID NOT NULL,
    "bet_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "body" VARCHAR(280) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" UUID,

    CONSTRAINT "match_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_match_chat_bet_created" ON "match_chat_messages"("bet_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_match_chat_bet_deleted" ON "match_chat_messages"("bet_id", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_match_chat_user_created" ON "match_chat_messages"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "match_chat_messages" ADD CONSTRAINT "match_chat_messages_bet_id_fkey" FOREIGN KEY ("bet_id") REFERENCES "bets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_chat_messages" ADD CONSTRAINT "match_chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_chat_messages" ADD CONSTRAINT "match_chat_messages_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
