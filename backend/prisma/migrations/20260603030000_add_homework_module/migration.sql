DO $$
BEGIN
  CREATE TYPE "HomeworkQualityStatus" AS ENUM ('GOOD', 'NOT_GOOD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "HomeworkCompletionStatus" AS ENUM ('COMPLETED', 'NOT_COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "homeworks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "class_id" UUID NOT NULL,
  "section_id" UUID NOT NULL,
  "subject_id" UUID NOT NULL,
  "homework_date" TIMESTAMP(3) NOT NULL,
  "submission_date" TIMESTAMP(3) NOT NULL,
  "marks" DECIMAL(10,2) NOT NULL,
  "description" TEXT NOT NULL,
  "attachment_url" TEXT,
  "attachment_name" TEXT,
  "evaluation_date" TIMESTAMP(3),
  "created_by_id" UUID NOT NULL,
  "evaluated_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "homeworks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "homeworks_school_id_idx" ON "homeworks"("school_id");
CREATE INDEX IF NOT EXISTS "homeworks_class_id_idx" ON "homeworks"("class_id");
CREATE INDEX IF NOT EXISTS "homeworks_section_id_idx" ON "homeworks"("section_id");
CREATE INDEX IF NOT EXISTS "homeworks_subject_id_idx" ON "homeworks"("subject_id");
CREATE INDEX IF NOT EXISTS "homeworks_created_by_id_idx" ON "homeworks"("created_by_id");
CREATE INDEX IF NOT EXISTS "homeworks_evaluated_by_id_idx" ON "homeworks"("evaluated_by_id");

DO $$
BEGIN
  ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_class_id_fkey"
    FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_section_id_fkey"
    FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_evaluated_by_id_fkey"
    FOREIGN KEY ("evaluated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "homework_evaluations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "homework_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "marks" DECIMAL(10,2),
  "comments" TEXT,
  "quality_status" "HomeworkQualityStatus" NOT NULL DEFAULT 'GOOD',
  "completion_status" "HomeworkCompletionStatus" NOT NULL DEFAULT 'COMPLETED',
  "evaluation_date" TIMESTAMP(3) NOT NULL,
  "evaluated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "homework_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "homework_evaluations_homework_id_student_id_key" ON "homework_evaluations"("homework_id", "student_id");
CREATE INDEX IF NOT EXISTS "homework_evaluations_school_id_idx" ON "homework_evaluations"("school_id");
CREATE INDEX IF NOT EXISTS "homework_evaluations_homework_id_idx" ON "homework_evaluations"("homework_id");
CREATE INDEX IF NOT EXISTS "homework_evaluations_student_id_idx" ON "homework_evaluations"("student_id");
CREATE INDEX IF NOT EXISTS "homework_evaluations_evaluated_by_id_idx" ON "homework_evaluations"("evaluated_by_id");
CREATE INDEX IF NOT EXISTS "homework_evaluations_completion_status_idx" ON "homework_evaluations"("completion_status");

DO $$
BEGIN
  ALTER TABLE "homework_evaluations" ADD CONSTRAINT "homework_evaluations_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "homework_evaluations" ADD CONSTRAINT "homework_evaluations_homework_id_fkey"
    FOREIGN KEY ("homework_id") REFERENCES "homeworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "homework_evaluations" ADD CONSTRAINT "homework_evaluations_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "homework_evaluations" ADD CONSTRAINT "homework_evaluations_evaluated_by_id_fkey"
    FOREIGN KEY ("evaluated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
