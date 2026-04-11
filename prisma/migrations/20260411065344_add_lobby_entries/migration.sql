-- CreateEnum
CREATE TYPE "LobbyRole" AS ENUM ('PLAYER_A', 'PLAYER_B');

-- CreateEnum
CREATE TYPE "LobbyStatus" AS ENUM ('WAITING', 'INVITED', 'MATCHED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "lobby_entries" (
    "id" TEXT NOT NULL,
    "game_type" VARCHAR(50) NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "LobbyRole" NOT NULL,
    "stake_amount" INTEGER NOT NULL,
    "status" "LobbyStatus" NOT NULL DEFAULT 'WAITING',
    "invited_by_id" UUID,
    "bet_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "invite_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lobby_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_lobby_match" ON "lobby_entries"("game_type", "role", "status", "expires_at");

-- CreateIndex
CREATE INDEX "idx_lobby_user" ON "lobby_entries"("user_id", "status");

-- AddForeignKey
ALTER TABLE "lobby_entries" ADD CONSTRAINT "lobby_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lobby_entries" ADD CONSTRAINT "lobby_entries_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
