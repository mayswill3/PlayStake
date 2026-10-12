-- AlterTable
ALTER TABLE "users" ADD COLUMN     "follow_live_emails" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "streamer_follows" (
    "id" UUID NOT NULL,
    "follower_id" UUID NOT NULL,
    "streamer_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "streamer_follows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_streamer_follow_streamer" ON "streamer_follows"("streamer_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_streamer_follow" ON "streamer_follows"("follower_id", "streamer_id");

-- AddForeignKey
ALTER TABLE "streamer_follows" ADD CONSTRAINT "streamer_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streamer_follows" ADD CONSTRAINT "streamer_follows_streamer_id_fkey" FOREIGN KEY ("streamer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
