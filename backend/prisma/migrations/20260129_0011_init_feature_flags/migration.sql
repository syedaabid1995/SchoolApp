CREATE TYPE "FeatureFlagStatus" AS ENUM ('DISABLED', 'ENABLED');

CREATE TABLE "feature_flags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" text NOT NULL,
  "status" "FeatureFlagStatus" NOT NULL DEFAULT 'DISABLED',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags" ("key");

CREATE TABLE "feature_flag_overrides" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "flag_id" uuid NOT NULL,
  "school_id" uuid,
  "user_id" uuid,
  "status" "FeatureFlagStatus" NOT NULL DEFAULT 'ENABLED',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "feature_flag_overrides_flag_id_fkey" FOREIGN KEY ("flag_id") REFERENCES "feature_flags" ("id") ON DELETE CASCADE,
  CONSTRAINT "feature_flag_overrides_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE,
  CONSTRAINT "feature_flag_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "feature_flag_overrides_flag_id_school_id_user_id_key" ON "feature_flag_overrides" ("flag_id", "school_id", "user_id");
CREATE INDEX "feature_flag_overrides_flag_id_idx" ON "feature_flag_overrides" ("flag_id");
CREATE INDEX "feature_flag_overrides_school_id_idx" ON "feature_flag_overrides" ("school_id");
CREATE INDEX "feature_flag_overrides_user_id_idx" ON "feature_flag_overrides" ("user_id");

CREATE TABLE "config_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" text NOT NULL,
  "value" jsonb NOT NULL,
  "version" int NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "config_entries_key_key" ON "config_entries" ("key");

CREATE TABLE "tenant_config_overrides" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "config_id" uuid NOT NULL,
  "school_id" uuid NOT NULL,
  "value" jsonb NOT NULL,
  "version" int NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_config_overrides_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "config_entries" ("id") ON DELETE CASCADE,
  CONSTRAINT "tenant_config_overrides_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "tenant_config_overrides_config_id_school_id_key" ON "tenant_config_overrides" ("config_id", "school_id");
CREATE INDEX "tenant_config_overrides_config_id_idx" ON "tenant_config_overrides" ("config_id");
CREATE INDEX "tenant_config_overrides_school_id_idx" ON "tenant_config_overrides" ("school_id");
