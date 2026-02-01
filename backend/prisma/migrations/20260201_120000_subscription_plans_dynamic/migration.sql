-- Create subscription plans table
CREATE TABLE IF NOT EXISTS "subscription_plans" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "student_limit" INTEGER NOT NULL,
  "teacher_limit" INTEGER NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed default plans (if missing)
INSERT INTO "subscription_plans" ("name", "status", "student_limit", "teacher_limit")
VALUES
  ('STARTER', 'ACTIVE', 500, 50),
  ('STANDARD', 'ACTIVE', 2000, 200),
  ('PREMIUM', 'ACTIVE', 10000, 1000)
ON CONFLICT ("name") DO NOTHING;

-- Add plan_id to subscriptions (if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE "subscriptions" ADD COLUMN "plan_id" UUID;
  END IF;
END $$;

-- Backfill plan_id from plan_name
UPDATE "subscriptions" s
SET "plan_id" = p."id"
FROM "subscription_plans" p
WHERE s."plan_id" IS NULL AND p."name" = s."plan_name";

-- Ensure plan_id index and FK
CREATE INDEX IF NOT EXISTS "subscriptions_plan_id_idx" ON "subscriptions" ("plan_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'subscriptions_plan_id_fkey'
  ) THEN
    ALTER TABLE "subscriptions"
    ADD CONSTRAINT "subscriptions_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE SET NULL;
  END IF;
END $$;
