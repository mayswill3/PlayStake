-- AlterTable
ALTER TABLE "kick_accounts" ADD COLUMN     "declared_game_id" UUID;

-- CreateIndex
CREATE INDEX "idx_kick_account_declared_game" ON "kick_accounts"("declared_game_id");

-- AddForeignKey
ALTER TABLE "kick_accounts" ADD CONSTRAINT "kick_accounts_declared_game_id_fkey" FOREIGN KEY ("declared_game_id") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE CASCADE;
