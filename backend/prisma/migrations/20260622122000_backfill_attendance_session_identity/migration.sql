UPDATE "attendance_sessions" AS s
SET
  "mode" = 'PERIOD_WISE',
  "unit_type" = CASE
    WHEN s."timetable_entry_id" IS NOT NULL THEN 'TIMETABLE_ENTRY'::"AttendanceUnitType"
    ELSE 'PERIOD'::"AttendanceUnitType"
  END
WHERE s."mode" IS NULL
   OR s."unit_type" IS NULL;

UPDATE "attendance_sessions" AS s
SET
  "academic_year_id" = COALESCE(s."academic_year_id", te."academic_year_id"),
  "class_id" = COALESCE(s."class_id", te."class_id"),
  "section_id" = COALESCE(s."section_id", te."section_id"),
  "period_id" = COALESCE(s."period_id", te."attendance_period_id"),
  "unit_type" = 'TIMETABLE_ENTRY'::"AttendanceUnitType"
FROM "timetable_entries" AS te
WHERE s."timetable_entry_id" = te."id";

UPDATE "attendance_sessions" AS s
SET "academic_year_id" = COALESCE(s."academic_year_id", c."academic_year_id")
FROM "classes" AS c
WHERE s."class_id" = c."id"
  AND s."academic_year_id" IS NULL
  AND c."academic_year_id" IS NOT NULL;
