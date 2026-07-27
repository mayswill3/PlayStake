-- CreateEnum
CREATE TYPE "StreamChallengeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "stream_challenges" (
    "id" TEXT NOT NULL,
    "challenger_user_id" UUID NOT NULL,
    "streamer_user_id" UUID NOT NULL,
    "game_type" VARCHAR(50) NOT NULL,
    "stake_amount" INTEGER NOT NULL,
    "status" "StreamChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "challenger_lobby_entry_id" TEXT NOT NULL,
    "streamer_lobby_entry_id" TEXT NOT NULL,
    "bet_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stream_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stream_challenges_challenger_lobby_entry_id_key" ON "stream_challenges"("challenger_lobby_entry_id");
CREATE UNIQUE INDEX "stream_challenges_streamer_lobby_entry_id_key" ON "stream_challenges"("streamer_lobby_entry_id");
CREATE UNIQUE INDEX "stream_challenges_bet_id_key" ON "stream_challenges"("bet_id");
CREATE INDEX "idx_stream_challenge_challenger" ON "stream_challenges"("challenger_user_id", "status", "created_at");
CREATE INDEX "idx_stream_challenge_streamer" ON "stream_challenges"("streamer_user_id", "status", "expires_at");
CREATE INDEX "idx_stream_challenge_expiry" ON "stream_challenges"("status", "expires_at");

-- A viewer can have only one active outgoing stream challenge at a time.
CREATE UNIQUE INDEX "uq_stream_challenge_pending_challenger"
ON "stream_challenges"("challenger_user_id")
WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "stream_challenges" ADD CONSTRAINT "stream_challenges_challenger_user_id_fkey"
FOREIGN KEY ("challenger_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stream_challenges" ADD CONSTRAINT "stream_challenges_streamer_user_id_fkey"
FOREIGN KEY ("streamer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stream_challenges" ADD CONSTRAINT "stream_challenges_challenger_lobby_entry_id_fkey"
FOREIGN KEY ("challenger_lobby_entry_id") REFERENCES "lobby_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stream_challenges" ADD CONSTRAINT "stream_challenges_streamer_lobby_entry_id_fkey"
FOREIGN KEY ("streamer_lobby_entry_id") REFERENCES "lobby_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stream_challenges" ADD CONSTRAINT "stream_challenges_bet_id_fkey"
FOREIGN KEY ("bet_id") REFERENCES "bets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
