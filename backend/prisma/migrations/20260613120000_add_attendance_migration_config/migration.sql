DO $$
BEGIN
  CREATE TYPE "AttendanceMigrationMode" AS ENUM ('LEGACY_DAILY', 'P1_SESSION', 'PERIOD_DEVICE', 'HYBRID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "attendance_migration_configs" (
  "school_id" UUID NOT NULL,
  "mode" "AttendanceMigrationMode" NOT NULL DEFAULT 'LEGACY_DAILY',
  "dual_write_enabled" BOOLEAN NOT NULL DEFAULT false,
  "read_parity_enabled" BOOLEAN NOT NULL DEFAULT false,
  "migration_started_at" TIMESTAMP(3),
  "migration_completed_at" TIMESTAMP(3),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_migration_configs_pkey" PRIMARY KEY ("school_id")
);

DO $$
BEGIN
  ALTER TABLE "attendance_migration_configs"
    ADD CONSTRAINT "attendance_migration_configs_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
