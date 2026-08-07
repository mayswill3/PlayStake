-- Product-owned catalogue records for refereed console/PC stream challenges.
-- A dedicated non-login developer profile keeps these records separate from
-- third-party developer integrations while satisfying the existing Game FK.

INSERT INTO "users" (
  "id",
  "email",
  "role",
  "display_name",
  "email_verified",
  "created_at",
  "updated_at"
)
VALUES (
  '00000000-0000-4000-8000-000000000100',
  'catalog@playstake.org',
  'DEVELOPER',
  'PlayStake Game Catalogue',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO NOTHING;

INSERT INTO "developer_profiles" (
  "id",
  "user_id",
  "company_name",
  "website_url",
  "contact_email",
  "rev_share_percent",
  "is_approved",
  "created_at",
  "updated_at"
)
SELECT
  '00000000-0000-4000-8000-000000000101',
  "id",
  'PlayStake Game Catalogue',
  'https://playstake.org',
  'support@playstake.org',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users"
WHERE "email" = 'catalog@playstake.org'
ON CONFLICT ("user_id") DO NOTHING;

INSERT INTO "games" (
  "id",
  "developer_profile_id",
  "name",
  "slug",
  "description",
  "is_active",
  "min_bet_amount",
  "max_bet_amount",
  "platform_fee_percent",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  profile."id",
  catalogue."name",
  catalogue."slug",
  catalogue."description",
  true,
  1,
  500,
  0.05,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "developer_profiles" AS profile
CROSS JOIN (
  VALUES
    ('Call of Duty', 'call-of-duty', 'Referee-monitored matches streamed live on Kick.'),
    ('Grand Theft Auto V / GTA Online', 'grand-theft-auto-v', 'Referee-monitored matches streamed live on Kick.'),
    ('EA SPORTS FC 26', 'ea-sports-fc-26', 'Referee-monitored matches streamed live on Kick.'),
    ('Fortnite', 'fortnite', 'Referee-monitored matches streamed live on Kick.'),
    ('NBA 2K26', 'nba-2k26', 'Referee-monitored matches streamed live on Kick.'),
    ('Minecraft', 'minecraft', 'Referee-monitored matches streamed live on Kick.'),
    ('Rocket League', 'rocket-league', 'Referee-monitored matches streamed live on Kick.'),
    ('Apex Legends', 'apex-legends', 'Referee-monitored matches streamed live on Kick.')
) AS catalogue("name", "slug", "description")
WHERE profile."user_id" = (
  SELECT "id" FROM "users" WHERE "email" = 'catalog@playstake.org'
)
ON CONFLICT ("slug") DO NOTHING;
