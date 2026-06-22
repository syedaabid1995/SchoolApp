CREATE TABLE IF NOT EXISTS "staff_attendance_configurations" (
  "id" UUID NOT NULL,
  "school_id" UUID NOT NULL,
  "role_name" "RoleName",
  "mode" "AttendanceMode" NOT NULL,
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_attendance_configurations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "staff_attendance_configurations"
  ADD CONSTRAINT "staff_attendance_configurations_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "staff_attendance_configurations"
  ADD CONSTRAINT "staff_attendance_configurations_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "staff_attendance_configurations"
  ADD CONSTRAINT "staff_attendance_configurations_updated_by_id_fkey"
  FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "staff_attendance_configurations_school_id_role_name_is_active_idx"
  ON "staff_attendance_configurations"("school_id", "role_name", "is_active");

CREATE INDEX IF NOT EXISTS "staff_attendance_configurations_school_id_effective_from_effective_to_idx"
  ON "staff_attendance_configurations"("school_id", "effective_from", "effective_to");

CREATE INDEX IF NOT EXISTS "staff_attendance_configurations_created_by_id_idx"
  ON "staff_attendance_configurations"("created_by_id");

CREATE INDEX IF NOT EXISTS "staff_attendance_configurations_updated_by_id_idx"
  ON "staff_attendance_configurations"("updated_by_id");

ALTER TABLE "staff_attendances"
  ADD COLUMN IF NOT EXISTS "mode" "AttendanceMode" NOT NULL DEFAULT 'DAILY',
  ADD COLUMN IF NOT EXISTS "unit_type" "AttendanceUnitType" NOT NULL DEFAULT 'DAY',
  ADD COLUMN IF NOT EXISTS "slot_type" "AttendanceSlotType",
  ADD COLUMN IF NOT EXISTS "period_id" UUID,
  ADD COLUMN IF NOT EXISTS "unit_key" TEXT NOT NULL DEFAULT 'DAY';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_attendances_period_id_fkey'
  ) THEN
    ALTER TABLE "staff_attendances"
      ADD CONSTRAINT "staff_attendances_period_id_fkey"
      FOREIGN KEY ("period_id") REFERENCES "attendance_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DROP INDEX IF EXISTS "staff_attendances_school_id_staff_id_attendance_date_key";

CREATE UNIQUE INDEX IF NOT EXISTS "staff_attendances_school_id_staff_id_attendance_date_unit_key_key"
  ON "staff_attendances"("school_id", "staff_id", "attendance_date", "unit_key");

CREATE INDEX IF NOT EXISTS "staff_attendances_school_id_attendance_date_unit_key_idx"
  ON "staff_attendances"("school_id", "attendance_date", "unit_key");

CREATE INDEX IF NOT EXISTS "staff_attendances_period_id_idx"
  ON "staff_attendances"("period_id");
