ALTER TABLE "beta_signups"
ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "idx_beta_signup_demo_created_at"
ON "beta_signups"("is_demo", "created_at");
