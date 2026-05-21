-- Add eSkooly-style student attendance, grouping, category, promotion, and disabled-student lifecycle records.

ALTER TYPE "StudentStatus" ADD VALUE IF NOT EXISTS 'DISABLED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StudentPromotionResult') THEN
    CREATE TYPE "StudentPromotionResult" AS ENUM ('PASS', 'FAIL');
  END IF;
END $$;

ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "student_group_id" UUID,
  ADD COLUMN IF NOT EXISTS "student_category_id" UUID;

CREATE TABLE IF NOT EXISTS "student_groups" (
  "id" UUID NOT NULL,
  "school_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "student_categories" (
  "id" UUID NOT NULL,
  "school_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "student_attendances" (
  "id" UUID NOT NULL,
  "school_id" UUID NOT NULL,
  "academic_session_id" UUID NOT NULL,
  "class_id" UUID NOT NULL,
  "section_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "attendance_date" TIMESTAMP(3) NOT NULL,
  "status" "StudentAttendanceStatus" NOT NULL,
  "note" TEXT,
  "marked_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_attendances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "attendance_holidays" (
  "id" UUID NOT NULL,
  "school_id" UUID NOT NULL,
  "academic_session_id" UUID NOT NULL,
  "class_id" UUID NOT NULL,
  "section_id" UUID NOT NULL,
  "holiday_date" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attendance_holidays_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "student_promotions" (
  "id" UUID NOT NULL,
  "school_id" UUID NOT NULL,
  "from_academic_session_id" UUID NOT NULL,
  "to_academic_session_id" UUID NOT NULL,
  "from_class_id" UUID NOT NULL,
  "to_class_id" UUID NOT NULL,
  "from_section_id" UUID,
  "to_section_id" UUID,
  "created_by_id" UUID,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_promotions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "student_promotion_histories" (
  "id" UUID NOT NULL,
  "school_id" UUID NOT NULL,
  "promotion_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "from_academic_session_id" UUID NOT NULL,
  "to_academic_session_id" UUID NOT NULL,
  "from_class_id" UUID NOT NULL,
  "to_class_id" UUID,
  "from_section_id" UUID,
  "to_section_id" UUID,
  "result" "StudentPromotionResult" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_promotion_histories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "disabled_student_logs" (
  "id" UUID NOT NULL,
  "school_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "actor_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "disabled_student_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_groups_school_id_name_key" ON "student_groups"("school_id", "name");
CREATE INDEX IF NOT EXISTS "student_groups_school_id_idx" ON "student_groups"("school_id");

CREATE UNIQUE INDEX IF NOT EXISTS "student_categories_school_id_name_key" ON "student_categories"("school_id", "name");
CREATE INDEX IF NOT EXISTS "student_categories_school_id_idx" ON "student_categories"("school_id");

CREATE UNIQUE INDEX IF NOT EXISTS "student_attendances_school_id_academic_session_id_student_id_attendance_date_key"
  ON "student_attendances"("school_id", "academic_session_id", "student_id", "attendance_date");
CREATE INDEX IF NOT EXISTS "student_attendances_school_id_academic_session_id_class_id_section_id_attendance_date_idx"
  ON "student_attendances"("school_id", "academic_session_id", "class_id", "section_id", "attendance_date");
CREATE INDEX IF NOT EXISTS "student_attendances_student_id_attendance_date_idx"
  ON "student_attendances"("student_id", "attendance_date");

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_holidays_school_id_academic_session_id_class_id_section_id_holiday_date_key"
  ON "attendance_holidays"("school_id", "academic_session_id", "class_id", "section_id", "holiday_date");
CREATE INDEX IF NOT EXISTS "attendance_holidays_school_id_academic_session_id_holiday_date_idx"
  ON "attendance_holidays"("school_id", "academic_session_id", "holiday_date");

CREATE INDEX IF NOT EXISTS "student_promotions_school_id_idx" ON "student_promotions"("school_id");
CREATE INDEX IF NOT EXISTS "student_promotions_from_academic_session_id_idx" ON "student_promotions"("from_academic_session_id");
CREATE INDEX IF NOT EXISTS "student_promotions_to_academic_session_id_idx" ON "student_promotions"("to_academic_session_id");

CREATE INDEX IF NOT EXISTS "student_promotion_histories_school_id_idx" ON "student_promotion_histories"("school_id");
CREATE INDEX IF NOT EXISTS "student_promotion_histories_student_id_idx" ON "student_promotion_histories"("student_id");
CREATE INDEX IF NOT EXISTS "student_promotion_histories_promotion_id_idx" ON "student_promotion_histories"("promotion_id");

CREATE INDEX IF NOT EXISTS "disabled_student_logs_school_id_idx" ON "disabled_student_logs"("school_id");
CREATE INDEX IF NOT EXISTS "disabled_student_logs_student_id_idx" ON "disabled_student_logs"("student_id");

CREATE INDEX IF NOT EXISTS "students_student_group_id_idx" ON "students"("student_group_id");
CREATE INDEX IF NOT EXISTS "students_student_category_id_idx" ON "students"("student_category_id");

ALTER TABLE "student_groups"
  ADD CONSTRAINT "student_groups_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_categories"
  ADD CONSTRAINT "student_categories_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "students"
  ADD CONSTRAINT "students_student_group_id_fkey" FOREIGN KEY ("student_group_id") REFERENCES "student_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "students_student_category_id_fkey" FOREIGN KEY ("student_category_id") REFERENCES "student_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_attendances"
  ADD CONSTRAINT "student_attendances_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "student_attendances_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "student_attendances_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "student_attendances_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "student_attendances_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_holidays"
  ADD CONSTRAINT "attendance_holidays_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "attendance_holidays_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "attendance_holidays_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "attendance_holidays_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_promotions"
  ADD CONSTRAINT "student_promotions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "student_promotions_from_academic_session_id_fkey" FOREIGN KEY ("from_academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "student_promotions_to_academic_session_id_fkey" FOREIGN KEY ("to_academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_promotion_histories"
  ADD CONSTRAINT "student_promotion_histories_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "student_promotion_histories_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "student_promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "student_promotion_histories_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "student_promotion_histories_from_academic_session_id_fkey" FOREIGN KEY ("from_academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "student_promotion_histories_to_academic_session_id_fkey" FOREIGN KEY ("to_academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "disabled_student_logs"
  ADD CONSTRAINT "disabled_student_logs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "disabled_student_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
