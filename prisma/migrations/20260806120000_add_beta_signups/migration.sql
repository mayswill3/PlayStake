CREATE TABLE "beta_signups" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "game" VARCHAR(100) NOT NULL,
    "player_type" VARCHAR(50) NOT NULL,
    "consented_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beta_signups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "beta_signups_email_key" ON "beta_signups"("email");
CREATE INDEX "idx_beta_signup_created_at" ON "beta_signups"("created_at");
