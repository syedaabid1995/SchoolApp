ALTER TABLE "attendance_sessions"
  ADD COLUMN "academic_year_id" UUID,
  ADD COLUMN "class_id" UUID,
  ADD COLUMN "section_id" UUID,
  ADD COLUMN "configuration_id" UUID,
  ADD COLUMN "mode" "AttendanceMode",
  ADD COLUMN "unit_type" "AttendanceUnitType",
  ADD COLUMN "slot_id" UUID,
  ADD COLUMN "locked_at" TIMESTAMP(3),
  ADD COLUMN "locked_by_id" UUID,
  ADD COLUMN "lock_reason" TEXT;

ALTER TABLE "attendance_sessions"
  ALTER COLUMN "period_id" DROP NOT NULL;

ALTER TABLE "attendance_sessions"
  DROP CONSTRAINT IF EXISTS "attendance_sessions_period_id_fkey";

ALTER TABLE "attendance_sessions"
  ADD CONSTRAINT "attendance_sessions_academic_year_id_fkey"
  FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_sessions"
  ADD CONSTRAINT "attendance_sessions_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_sessions"
  ADD CONSTRAINT "attendance_sessions_section_id_fkey"
  FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attendance_sessions"
  ADD CONSTRAINT "attendance_sessions_configuration_id_fkey"
  FOREIGN KEY ("configuration_id") REFERENCES "attendance_configurations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attendance_sessions"
  ADD CONSTRAINT "attendance_sessions_slot_id_fkey"
  FOREIGN KEY ("slot_id") REFERENCES "attendance_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attendance_sessions"
  ADD CONSTRAINT "attendance_sessions_period_id_fkey"
  FOREIGN KEY ("period_id") REFERENCES "attendance_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attendance_sessions"
  ADD CONSTRAINT "attendance_sessions_locked_by_id_fkey"
  FOREIGN KEY ("locked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
