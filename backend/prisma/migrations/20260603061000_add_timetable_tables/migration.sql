DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TimetableVersionStatus') THEN
    CREATE TYPE "TimetableVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "timetable_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "status" "TimetableVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMP(3),
  CONSTRAINT "timetable_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "timetable_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "timetable_version_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "class_id" UUID NOT NULL,
  "section_id" UUID,
  "attendance_period_id" UUID NOT NULL,
  "day_of_week" INTEGER NOT NULL,
  "subject_id" UUID NOT NULL,
  "teacher_id" UUID NOT NULL,
  "room" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "timetable_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "timetable_versions_school_id_academic_year_id_status_idx"
  ON "timetable_versions"("school_id", "academic_year_id", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "timetable_entries_timetable_version_id_class_id_section_id_day_of_week_attendance_period_id_key"
  ON "timetable_entries"("timetable_version_id", "class_id", "section_id", "day_of_week", "attendance_period_id");

CREATE INDEX IF NOT EXISTS "timetable_entries_school_id_teacher_id_day_of_week_idx"
  ON "timetable_entries"("school_id", "teacher_id", "day_of_week");

CREATE INDEX IF NOT EXISTS "timetable_entries_school_id_class_id_section_id_day_of_week_idx"
  ON "timetable_entries"("school_id", "class_id", "section_id", "day_of_week");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timetable_versions_school_id_fkey') THEN
    ALTER TABLE "timetable_versions"
      ADD CONSTRAINT "timetable_versions_school_id_fkey"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timetable_versions_academic_year_id_fkey') THEN
    ALTER TABLE "timetable_versions"
      ADD CONSTRAINT "timetable_versions_academic_year_id_fkey"
      FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timetable_versions_created_by_id_fkey') THEN
    ALTER TABLE "timetable_versions"
      ADD CONSTRAINT "timetable_versions_created_by_id_fkey"
      FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timetable_entries_school_id_fkey') THEN
    ALTER TABLE "timetable_entries"
      ADD CONSTRAINT "timetable_entries_school_id_fkey"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timetable_entries_timetable_version_id_fkey') THEN
    ALTER TABLE "timetable_entries"
      ADD CONSTRAINT "timetable_entries_timetable_version_id_fkey"
      FOREIGN KEY ("timetable_version_id") REFERENCES "timetable_versions"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timetable_entries_academic_year_id_fkey') THEN
    ALTER TABLE "timetable_entries"
      ADD CONSTRAINT "timetable_entries_academic_year_id_fkey"
      FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timetable_entries_class_id_fkey') THEN
    ALTER TABLE "timetable_entries"
      ADD CONSTRAINT "timetable_entries_class_id_fkey"
      FOREIGN KEY ("class_id") REFERENCES "classes"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timetable_entries_section_id_fkey') THEN
    ALTER TABLE "timetable_entries"
      ADD CONSTRAINT "timetable_entries_section_id_fkey"
      FOREIGN KEY ("section_id") REFERENCES "sections"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timetable_entries_attendance_period_id_fkey') THEN
    ALTER TABLE "timetable_entries"
      ADD CONSTRAINT "timetable_entries_attendance_period_id_fkey"
      FOREIGN KEY ("attendance_period_id") REFERENCES "attendance_periods"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timetable_entries_subject_id_fkey') THEN
    ALTER TABLE "timetable_entries"
      ADD CONSTRAINT "timetable_entries_subject_id_fkey"
      FOREIGN KEY ("subject_id") REFERENCES "subjects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timetable_entries_teacher_id_fkey') THEN
    ALTER TABLE "timetable_entries"
      ADD CONSTRAINT "timetable_entries_teacher_id_fkey"
      FOREIGN KEY ("teacher_id") REFERENCES "employee_profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "attendance_sessions"
  ADD COLUMN IF NOT EXISTS "timetable_entry_id" UUID;

CREATE INDEX IF NOT EXISTS "attendance_sessions_timetable_entry_id_idx"
  ON "attendance_sessions"("timetable_entry_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_sessions_timetable_entry_id_fkey') THEN
    ALTER TABLE "attendance_sessions"
      ADD CONSTRAINT "attendance_sessions_timetable_entry_id_fkey"
      FOREIGN KEY ("timetable_entry_id") REFERENCES "timetable_entries"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
