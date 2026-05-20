DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubjectType') THEN
    CREATE TYPE "SubjectType" AS ENUM ('THEORY', 'PRACTICAL');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TimePeriodType') THEN
    CREATE TYPE "TimePeriodType" AS ENUM ('CLASS_TIME', 'EXAM_TIME', 'BREAK');
  END IF;
END $$;

ALTER TABLE "sections" ADD COLUMN IF NOT EXISTS "school_id" UUID;
UPDATE "sections" s
SET "school_id" = c."school_id"
FROM "classes" c
WHERE s."class_id" = c."id" AND s."school_id" IS NULL;
ALTER TABLE "sections" ALTER COLUMN "school_id" SET NOT NULL;
ALTER TABLE "sections" ALTER COLUMN "class_id" DROP NOT NULL;

ALTER TABLE "subjects" ADD COLUMN IF NOT EXISTS "type" "SubjectType" NOT NULL DEFAULT 'THEORY';

CREATE TABLE IF NOT EXISTS "class_sections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "class_id" UUID NOT NULL,
  "section_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "class_sections_pkey" PRIMARY KEY ("id")
);

INSERT INTO "class_sections" ("school_id", "class_id", "section_id")
SELECT c."school_id", s."class_id", s."id"
FROM "sections" s
JOIN "classes" c ON c."id" = s."class_id"
WHERE s."class_id" IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS "class_rooms" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "room_number" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "class_rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "time_periods" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "type" "TimePeriodType" NOT NULL,
  "name" TEXT NOT NULL,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "time_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "assign_subjects" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "class_id" UUID NOT NULL,
  "section_id" UUID NOT NULL,
  "subject_id" UUID NOT NULL,
  "teacher_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assign_subjects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "class_teachers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "class_id" UUID NOT NULL,
  "section_id" UUID NOT NULL,
  "teacher_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "class_teachers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "class_routines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "class_id" UUID NOT NULL,
  "section_id" UUID NOT NULL,
  "time_period_id" UUID NOT NULL,
  "day_of_week" INTEGER NOT NULL,
  "subject_id" UUID NOT NULL,
  "teacher_id" UUID NOT NULL,
  "class_room_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "class_routines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sections_school_id_idx" ON "sections"("school_id");

CREATE UNIQUE INDEX IF NOT EXISTS "class_sections_class_id_section_id_key" ON "class_sections"("class_id", "section_id");
CREATE INDEX IF NOT EXISTS "class_sections_school_id_idx" ON "class_sections"("school_id");
CREATE INDEX IF NOT EXISTS "class_sections_section_id_idx" ON "class_sections"("section_id");

CREATE UNIQUE INDEX IF NOT EXISTS "class_rooms_school_id_room_number_key" ON "class_rooms"("school_id", "room_number");
CREATE INDEX IF NOT EXISTS "class_rooms_school_id_idx" ON "class_rooms"("school_id");

CREATE UNIQUE INDEX IF NOT EXISTS "time_periods_school_id_type_name_key" ON "time_periods"("school_id", "type", "name");
CREATE INDEX IF NOT EXISTS "time_periods_school_id_idx" ON "time_periods"("school_id");

CREATE UNIQUE INDEX IF NOT EXISTS "assign_subjects_class_id_section_id_subject_id_key" ON "assign_subjects"("class_id", "section_id", "subject_id");
CREATE INDEX IF NOT EXISTS "assign_subjects_school_id_idx" ON "assign_subjects"("school_id");
CREATE INDEX IF NOT EXISTS "assign_subjects_teacher_id_idx" ON "assign_subjects"("teacher_id");

CREATE UNIQUE INDEX IF NOT EXISTS "class_teachers_class_id_section_id_key" ON "class_teachers"("class_id", "section_id");
CREATE INDEX IF NOT EXISTS "class_teachers_school_id_idx" ON "class_teachers"("school_id");
CREATE INDEX IF NOT EXISTS "class_teachers_teacher_id_idx" ON "class_teachers"("teacher_id");

CREATE UNIQUE INDEX IF NOT EXISTS "class_routines_school_id_class_id_section_id_day_of_week_time_period_id_key"
  ON "class_routines"("school_id", "class_id", "section_id", "day_of_week", "time_period_id");
CREATE INDEX IF NOT EXISTS "class_routines_school_id_idx" ON "class_routines"("school_id");
CREATE INDEX IF NOT EXISTS "class_routines_teacher_id_idx" ON "class_routines"("teacher_id");
CREATE INDEX IF NOT EXISTS "class_routines_class_room_id_idx" ON "class_routines"("class_room_id");

ALTER TABLE "sections"
  ADD CONSTRAINT "sections_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "class_sections"
  ADD CONSTRAINT "class_sections_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_sections"
  ADD CONSTRAINT "class_sections_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "classes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_sections"
  ADD CONSTRAINT "class_sections_section_id_fkey"
  FOREIGN KEY ("section_id") REFERENCES "sections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "class_rooms"
  ADD CONSTRAINT "class_rooms_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "time_periods"
  ADD CONSTRAINT "time_periods_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assign_subjects"
  ADD CONSTRAINT "assign_subjects_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assign_subjects"
  ADD CONSTRAINT "assign_subjects_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "classes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assign_subjects"
  ADD CONSTRAINT "assign_subjects_section_id_fkey"
  FOREIGN KEY ("section_id") REFERENCES "sections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assign_subjects"
  ADD CONSTRAINT "assign_subjects_subject_id_fkey"
  FOREIGN KEY ("subject_id") REFERENCES "subjects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assign_subjects"
  ADD CONSTRAINT "assign_subjects_teacher_id_fkey"
  FOREIGN KEY ("teacher_id") REFERENCES "employee_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "class_teachers"
  ADD CONSTRAINT "class_teachers_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_teachers"
  ADD CONSTRAINT "class_teachers_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "classes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_teachers"
  ADD CONSTRAINT "class_teachers_section_id_fkey"
  FOREIGN KEY ("section_id") REFERENCES "sections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_teachers"
  ADD CONSTRAINT "class_teachers_teacher_id_fkey"
  FOREIGN KEY ("teacher_id") REFERENCES "employee_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "class_routines"
  ADD CONSTRAINT "class_routines_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_routines"
  ADD CONSTRAINT "class_routines_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "classes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_routines"
  ADD CONSTRAINT "class_routines_section_id_fkey"
  FOREIGN KEY ("section_id") REFERENCES "sections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_routines"
  ADD CONSTRAINT "class_routines_time_period_id_fkey"
  FOREIGN KEY ("time_period_id") REFERENCES "time_periods"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_routines"
  ADD CONSTRAINT "class_routines_subject_id_fkey"
  FOREIGN KEY ("subject_id") REFERENCES "subjects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_routines"
  ADD CONSTRAINT "class_routines_teacher_id_fkey"
  FOREIGN KEY ("teacher_id") REFERENCES "employee_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_routines"
  ADD CONSTRAINT "class_routines_class_room_id_fkey"
  FOREIGN KEY ("class_room_id") REFERENCES "class_rooms"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
