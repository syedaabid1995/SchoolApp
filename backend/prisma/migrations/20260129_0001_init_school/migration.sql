CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "SchoolStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE "schools" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "code" text NOT NULL,
  "status" "SchoolStatus" NOT NULL DEFAULT 'ACTIVE',
  "subscription_plan" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "schools_code_key" ON "schools" ("code");
