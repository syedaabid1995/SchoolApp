INSERT INTO "attendance_configurations" (
  "id",
  "school_id",
  "scope",
  "mode",
  "effective_from",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  school."id",
  'SCHOOL'::"AttendanceConfigurationScope",
  'TWICE_DAILY'::"AttendanceMode",
  DATE '2000-01-01',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "schools" AS school
WHERE NOT EXISTS (
  SELECT 1
  FROM "attendance_configurations" AS configuration
  WHERE configuration."school_id" = school."id"
    AND configuration."scope" = 'SCHOOL'::"AttendanceConfigurationScope"
    AND configuration."academic_year_id" IS NULL
    AND configuration."class_id" IS NULL
    AND configuration."section_id" IS NULL
    AND configuration."is_active" = true
);

INSERT INTO "staff_attendance_configurations" (
  "id",
  "school_id",
  "role_name",
  "mode",
  "effective_from",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  school."id",
  NULL,
  'TWICE_DAILY'::"AttendanceMode",
  DATE '2000-01-01',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "schools" AS school
WHERE NOT EXISTS (
  SELECT 1
  FROM "staff_attendance_configurations" AS configuration
  WHERE configuration."school_id" = school."id"
    AND configuration."role_name" IS NULL
    AND configuration."is_active" = true
);
