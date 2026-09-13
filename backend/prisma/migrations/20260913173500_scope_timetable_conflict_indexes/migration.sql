DROP INDEX IF EXISTS "uniq_teacher_active_schedule";
DROP INDEX IF EXISTS "uniq_room_active_schedule";

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_teacher_active_schedule_per_version"
ON "timetable_entries" (
  "timetable_version_id",
  "day_of_week",
  "attendance_period_id",
  "teacher_id"
)
WHERE "is_active" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_room_active_schedule_per_version"
ON "timetable_entries" (
  "timetable_version_id",
  "day_of_week",
  "attendance_period_id",
  "room"
)
WHERE "room" IS NOT NULL AND "is_active" = true;
