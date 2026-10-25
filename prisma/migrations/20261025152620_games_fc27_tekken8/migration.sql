-- PlayStake now offers two games, both refereed stream matches:
-- EA SPORTS FC 27 and Tekken 8. The on-site games (Tic-Tac-Toe, Darts 301)
-- and the other console titles are withdrawn. Their Game rows are kept
-- (past bets, game sessions and audit records point at them) but switched off.

-- 1. The two games, owned by the product catalogue profile.
INSERT INTO "games" (
  "id", "developer_profile_id", "name", "slug", "description", "is_active",
  "min_bet_amount", "max_bet_amount", "platform_fee_percent", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(), profile."id", catalogue."name", catalogue."slug", catalogue."description", true,
  1, 500, 0.05, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "developer_profiles" AS profile
CROSS JOIN (
  VALUES
    ('EA SPORTS FC 27', 'ea-sports-fc-27', 'Referee-monitored online friendlies streamed live on Kick.'),
    ('Tekken 8', 'tekken-8', 'Referee-monitored first-to-3 sets streamed live on Kick.')
) AS catalogue("name", "slug", "description")
WHERE profile."user_id" = (SELECT "id" FROM "users" WHERE "email" = 'catalog@playstake.org')
ON CONFLICT ("slug") DO UPDATE SET "is_active" = true;

-- 2. Referees approved for FC 26 keep officiating its successor.
INSERT INTO "referee_qualifications" ("id", "referee_profile_id", "game_id")
SELECT gen_random_uuid(), q."referee_profile_id", fc27."id"
FROM "referee_qualifications" q
JOIN "games" old ON old."id" = q."game_id" AND old."slug" = 'ea-sports-fc-26'
CROSS JOIN (SELECT "id" FROM "games" WHERE "slug" = 'ea-sports-fc-27') AS fc27
ON CONFLICT ("referee_profile_id", "game_id") DO NOTHING;

-- 3. Streamers who had declared a withdrawn game go back to "no game".
UPDATE "kick_accounts"
SET "declared_game_id" = NULL
WHERE "declared_game_id" IN (
  SELECT "id" FROM "games"
  WHERE "slug" IN ('tic-tac-toe', 'darts-301', 'higher-lower', 'call-of-duty', 'grand-theft-auto-v',
                   'ea-sports-fc-26', 'fortnite', 'nba-2k26', 'minecraft', 'rocket-league', 'apex-legends')
);

-- 4. Switch the withdrawn games off.
UPDATE "games"
SET "is_active" = false, "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" IN ('tic-tac-toe', 'darts-301', 'higher-lower', 'call-of-duty', 'grand-theft-auto-v',
                 'ea-sports-fc-26', 'fortnite', 'nba-2k26', 'minecraft', 'rocket-league', 'apex-legends');
