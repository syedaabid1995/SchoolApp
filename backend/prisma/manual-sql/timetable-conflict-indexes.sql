-- Apply after running the Prisma migration that creates timetable_entries.
-- These partial unique indexes enforce conflict protection for active schedules.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_teacher_active_schedule
ON timetable_entries (
  school_id,
  academic_year_id,
  day_of_week,
  attendance_period_id,
  teacher_id
)
WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_room_active_schedule
ON timetable_entries (
  school_id,
  academic_year_id,
  day_of_week,
  attendance_period_id,
  room
)
WHERE room IS NOT NULL AND is_active = true;
