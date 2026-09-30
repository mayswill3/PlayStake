-- CreateTable
CREATE TABLE "game_sessions" (
    "id" VARCHAR(16) NOT NULL,
    "game_type" VARCHAR(20) NOT NULL,
    "bet_id" UUID,
    "player_a_id" UUID NOT NULL,
    "player_b_id" UUID,
    "status" VARCHAR(10) NOT NULL,
    "winner" VARCHAR(4),
    "public_state" JSONB NOT NULL,
    "secret_state" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_events" (
    "id" UUID NOT NULL,
    "session_id" VARCHAR(16) NOT NULL,
    "seq" INTEGER NOT NULL,
    "actor_id" UUID,
    "type" VARCHAR(40) NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_game_session_bet" ON "game_sessions"("bet_id");

-- CreateIndex
CREATE INDEX "idx_game_session_status" ON "game_sessions"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_game_event_seq" ON "game_events"("session_id", "seq");

-- AddForeignKey
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Game events are the record of every draw and result: append-only.
CREATE OR REPLACE FUNCTION reject_game_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'game events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "game_events_immutable"
BEFORE UPDATE OR DELETE ON "game_events"
FOR EACH ROW EXECUTE FUNCTION reject_game_event_mutation();
