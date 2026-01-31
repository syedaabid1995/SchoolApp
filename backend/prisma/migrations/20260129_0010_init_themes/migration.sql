CREATE TYPE "ThemeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ROLLED_BACK');

CREATE TABLE "themes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL,
  "name" text NOT NULL,
  "tokens" jsonb NOT NULL,
  "status" "ThemeStatus" NOT NULL DEFAULT 'DRAFT',
  "version" int NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "themes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "themes_school_id_name_version_key" ON "themes" ("school_id", "name", "version");
CREATE INDEX "themes_school_id_idx" ON "themes" ("school_id");

CREATE TABLE "theme_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "theme_id" uuid NOT NULL,
  "snapshot" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "theme_history_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes" ("id") ON DELETE CASCADE
);

CREATE INDEX "theme_history_theme_id_idx" ON "theme_history" ("theme_id");
