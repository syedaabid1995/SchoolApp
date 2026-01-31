-- DropForeignKey
ALTER TABLE IF EXISTS "classes" DROP CONSTRAINT IF EXISTS "classes_academic_year_id_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "exams" DROP CONSTRAINT IF EXISTS "exams_class_id_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "exams" DROP CONSTRAINT IF EXISTS "exams_section_id_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "student_transfer_requests" DROP CONSTRAINT IF EXISTS "student_transfer_requests_decided_by_id_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "student_transfer_requests" DROP CONSTRAINT IF EXISTS "student_transfer_requests_from_school_id_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "student_transfer_requests" DROP CONSTRAINT IF EXISTS "student_transfer_requests_requested_by_id_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "student_transfer_requests" DROP CONSTRAINT IF EXISTS "student_transfer_requests_student_id_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "student_transfer_requests" DROP CONSTRAINT IF EXISTS "student_transfer_requests_to_school_id_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "subjects" DROP CONSTRAINT IF EXISTS "subjects_academic_year_id_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "subjects" DROP CONSTRAINT IF EXISTS "subjects_class_id_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "teacher_bank_details" DROP CONSTRAINT IF EXISTS "teacher_bank_details_teacher_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "academic_years_school_id_name_key";

-- AlterTable
ALTER TABLE IF EXISTS "exam_papers" ADD COLUMN     "pass_marks" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE IF EXISTS "student_transfer_requests" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "decided_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE IF EXISTS "teacher_bank_details" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'classes' AND column_name = 'academic_year_id'
  ) THEN
    ALTER TABLE "classes"
      ADD CONSTRAINT "classes_academic_year_id_fkey"
      FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subjects' AND column_name = 'class_id'
  ) THEN
    ALTER TABLE "subjects"
      ADD CONSTRAINT "subjects_class_id_fkey"
      FOREIGN KEY ("class_id") REFERENCES "classes"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subjects' AND column_name = 'academic_year_id'
  ) THEN
    ALTER TABLE "subjects"
      ADD CONSTRAINT "subjects_academic_year_id_fkey"
      FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_transfer_requests' AND column_name = 'student_id'
  ) THEN
    ALTER TABLE "student_transfer_requests"
      ADD CONSTRAINT "student_transfer_requests_student_id_fkey"
      FOREIGN KEY ("student_id") REFERENCES "students"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_transfer_requests' AND column_name = 'from_school_id'
  ) THEN
    ALTER TABLE "student_transfer_requests"
      ADD CONSTRAINT "student_transfer_requests_from_school_id_fkey"
      FOREIGN KEY ("from_school_id") REFERENCES "schools"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_transfer_requests' AND column_name = 'to_school_id'
  ) THEN
    ALTER TABLE "student_transfer_requests"
      ADD CONSTRAINT "student_transfer_requests_to_school_id_fkey"
      FOREIGN KEY ("to_school_id") REFERENCES "schools"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_transfer_requests' AND column_name = 'requested_by_id'
  ) THEN
    ALTER TABLE "student_transfer_requests"
      ADD CONSTRAINT "student_transfer_requests_requested_by_id_fkey"
      FOREIGN KEY ("requested_by_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_transfer_requests' AND column_name = 'decided_by_id'
  ) THEN
    ALTER TABLE "student_transfer_requests"
      ADD CONSTRAINT "student_transfer_requests_decided_by_id_fkey"
      FOREIGN KEY ("decided_by_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teacher_bank_details' AND column_name = 'teacher_id'
  ) THEN
    ALTER TABLE "teacher_bank_details"
      ADD CONSTRAINT "teacher_bank_details_teacher_id_fkey"
      FOREIGN KEY ("teacher_id") REFERENCES "teacher_profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exams' AND column_name = 'class_id'
  ) THEN
    ALTER TABLE "exams"
      ADD CONSTRAINT "exams_class_id_fkey"
      FOREIGN KEY ("class_id") REFERENCES "classes"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exams' AND column_name = 'section_id'
  ) THEN
    ALTER TABLE "exams"
      ADD CONSTRAINT "exams_section_id_fkey"
      FOREIGN KEY ("section_id") REFERENCES "sections"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
