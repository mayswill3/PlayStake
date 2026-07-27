-- Human referee workflow, dispute hold, and append-only audit chain.

ALTER TYPE "TransactionType" ADD VALUE 'REFEREE_FEE';

CREATE TYPE "BetMatchType" AS ENUM ('GAME_LOBBY', 'STREAM_VS_STREAM');
CREATE TYPE "RefereeProfileStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE "RefereeAssignmentStatus" AS ENUM (
  'OPEN',
  'ASSIGNED',
  'READY',
  'IN_PROGRESS',
  'DECISION_SUBMITTED',
  'DISPUTED',
  'COMPLETED',
  'CANCELLED'
);

ALTER TABLE "bets"
ADD COLUMN "match_type" "BetMatchType" NOT NULL DEFAULT 'GAME_LOBBY';

CREATE TABLE "referee_profiles" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "RefereeProfileStatus" NOT NULL DEFAULT 'PENDING',
  "is_available" BOOLEAN NOT NULL DEFAULT false,
  "bio" VARCHAR(500),
  "matches_handled" INTEGER NOT NULL DEFAULT 0,
  "disputes_upheld" INTEGER NOT NULL DEFAULT 0,
  "approved_at" TIMESTAMP(3),
  "suspended_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "referee_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "referee_qualifications" (
  "id" UUID NOT NULL,
  "referee_profile_id" UUID NOT NULL,
  "game_id" UUID NOT NULL,
  CONSTRAINT "referee_qualifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "referee_assignments" (
  "id" UUID NOT NULL,
  "bet_id" UUID NOT NULL,
  "referee_profile_id" UUID,
  "status" "RefereeAssignmentStatus" NOT NULL DEFAULT 'OPEN',
  "reward_percent" DECIMAL(5,4) NOT NULL DEFAULT 0.10,
  "reward_amount" DECIMAL(12,2),
  "decision" "BetOutcome",
  "evidence" JSONB,
  "version" INTEGER NOT NULL DEFAULT 1,
  "claimed_at" TIMESTAMP(3),
  "ready_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "decision_submitted_at" TIMESTAMP(3),
  "dispute_deadline" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "referee_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "referee_audit_events" (
  "id" TEXT NOT NULL,
  "assignment_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "sequence" INTEGER NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "details" JSONB NOT NULL,
  "previous_hash" VARCHAR(64),
  "event_hash" VARCHAR(64) NOT NULL,
  "ip_hash" VARCHAR(64),
  "user_agent" VARCHAR(300),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "referee_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referee_profiles_user_id_key" ON "referee_profiles"("user_id");
CREATE INDEX "idx_referee_profile_available" ON "referee_profiles"("status", "is_available");
CREATE UNIQUE INDEX "uq_referee_qualification" ON "referee_qualifications"("referee_profile_id", "game_id");
CREATE INDEX "idx_referee_qualification_game" ON "referee_qualifications"("game_id");
CREATE UNIQUE INDEX "referee_assignments_bet_id_key" ON "referee_assignments"("bet_id");
CREATE INDEX "idx_referee_assignment_open" ON "referee_assignments"("status", "created_at");
CREATE INDEX "idx_referee_assignment_referee" ON "referee_assignments"("referee_profile_id", "status");
CREATE INDEX "idx_referee_assignment_dispute_deadline" ON "referee_assignments"("dispute_deadline");
CREATE UNIQUE INDEX "referee_audit_events_event_hash_key" ON "referee_audit_events"("event_hash");
CREATE UNIQUE INDEX "uq_referee_audit_sequence" ON "referee_audit_events"("assignment_id", "sequence");
CREATE INDEX "idx_referee_audit_assignment" ON "referee_audit_events"("assignment_id", "created_at");
CREATE INDEX "idx_referee_audit_actor" ON "referee_audit_events"("actor_user_id", "created_at");

ALTER TABLE "referee_profiles"
ADD CONSTRAINT "referee_profiles_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "referee_qualifications"
ADD CONSTRAINT "referee_qualifications_referee_profile_id_fkey"
FOREIGN KEY ("referee_profile_id") REFERENCES "referee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "referee_qualifications"
ADD CONSTRAINT "referee_qualifications_game_id_fkey"
FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "referee_assignments"
ADD CONSTRAINT "referee_assignments_bet_id_fkey"
FOREIGN KEY ("bet_id") REFERENCES "bets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "referee_assignments"
ADD CONSTRAINT "referee_assignments_referee_profile_id_fkey"
FOREIGN KEY ("referee_profile_id") REFERENCES "referee_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "referee_audit_events"
ADD CONSTRAINT "referee_audit_events_assignment_id_fkey"
FOREIGN KEY ("assignment_id") REFERENCES "referee_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "referee_audit_events"
ADD CONSTRAINT "referee_audit_events_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Audit records must remain immutable even if application code is changed.
CREATE OR REPLACE FUNCTION reject_referee_audit_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'referee audit events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "referee_audit_events_immutable"
BEFORE UPDATE OR DELETE ON "referee_audit_events"
FOR EACH ROW EXECUTE FUNCTION reject_referee_audit_mutation();
