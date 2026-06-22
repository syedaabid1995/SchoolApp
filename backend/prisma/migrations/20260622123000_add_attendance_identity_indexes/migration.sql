DROP INDEX IF EXISTS "attendance_sessions_school_id_period_id_date_key";
DROP INDEX IF EXISTS "attendance_sessions_period_id_idx";
DROP INDEX IF EXISTS "attendance_sessions_timetable_entry_id_idx";

CREATE INDEX IF NOT EXISTS "attendance_sessions_school_id_date_idx"
  ON "attendance_sessions"("school_id", "date");

CREATE INDEX IF NOT EXISTS "attendance_sessions_school_id_academic_year_id_date_idx"
  ON "attendance_sessions"("school_id", "academic_year_id", "date");

CREATE INDEX IF NOT EXISTS "attendance_sessions_school_id_class_id_section_id_date_idx"
  ON "attendance_sessions"("school_id", "class_id", "section_id", "date");

CREATE INDEX IF NOT EXISTS "attendance_sessions_school_id_mode_date_idx"
  ON "attendance_sessions"("school_id", "mode", "date");

CREATE INDEX IF NOT EXISTS "attendance_sessions_configuration_id_idx"
  ON "attendance_sessions"("configuration_id");

CREATE INDEX IF NOT EXISTS "attendance_sessions_slot_id_date_idx"
  ON "attendance_sessions"("slot_id", "date");

CREATE INDEX IF NOT EXISTS "attendance_sessions_period_id_date_idx"
  ON "attendance_sessions"("period_id", "date");

CREATE INDEX IF NOT EXISTS "attendance_sessions_timetable_entry_id_date_idx"
  ON "attendance_sessions"("timetable_entry_id", "date");

CREATE INDEX IF NOT EXISTS "attendance_sessions_approval_status_date_idx"
  ON "attendance_sessions"("approval_status", "date");

CREATE INDEX IF NOT EXISTS "attendance_sessions_locked_by_id_idx"
  ON "attendance_sessions"("locked_by_id");

CREATE INDEX IF NOT EXISTS "attendance_records_student_id_captured_at_idx"
  ON "attendance_records"("student_id", "captured_at");

CREATE INDEX IF NOT EXISTS "attendance_records_session_id_status_idx"
  ON "attendance_records"("session_id", "status");
