-- AlterTable
ALTER TABLE "users" ADD COLUMN     "discoverable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "username" VARCHAR(20),
ADD COLUMN     "username_changed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "user_blocks" (
    "id" UUID NOT NULL,
    "blocker_id" UUID NOT NULL,
    "blocked_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_user_block_blocked" ON "user_blocks"("blocked_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_block" ON "user_blocks"("blocker_id", "blocked_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Give every existing account a username from its display name: lowercase
-- letters, digits and underscores, at most 14 characters. Names that are too
-- short become "player". Shared or reserved names get a suffix from the user
-- id so each is unique (at most 20 characters). People can change it later.
WITH base AS (
  SELECT id, left(lower(regexp_replace(display_name, '[^A-Za-z0-9_]', '', 'g')), 14) AS b
  FROM "users"
  WHERE username IS NULL
),
fixed AS (
  SELECT id, CASE WHEN length(b) < 3 THEN 'player' ELSE b END AS b FROM base
),
ranked AS (
  SELECT id, b, count(*) OVER (PARTITION BY b) AS n FROM fixed
)
UPDATE "users" u
SET username = CASE
  WHEN r.n = 1 AND r.b NOT IN ('admin', 'administrator', 'support', 'playstake', 'staff', 'moderator', 'mod', 'help', 'root', 'system', 'referee', 'official', 'player')
    AND NOT EXISTS (SELECT 1 FROM "users" o WHERE o.username = r.b)
    THEN r.b
  ELSE r.b || '_' || substr(replace(u.id::text, '-', ''), 1, 5)
END
FROM ranked r
WHERE u.id = r.id;
