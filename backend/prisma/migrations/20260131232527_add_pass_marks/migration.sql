-- DropForeignKey
ALTER TABLE "classes" DROP CONSTRAINT "classes_academic_year_id_fkey";

-- DropForeignKey
ALTER TABLE "exams" DROP CONSTRAINT "exams_class_id_fkey";

-- DropForeignKey
ALTER TABLE "exams" DROP CONSTRAINT "exams_section_id_fkey";

-- DropForeignKey
ALTER TABLE "student_transfer_requests" DROP CONSTRAINT "student_transfer_requests_decided_by_id_fkey";

-- DropForeignKey
ALTER TABLE "student_transfer_requests" DROP CONSTRAINT "student_transfer_requests_from_school_id_fkey";

-- DropForeignKey
ALTER TABLE "student_transfer_requests" DROP CONSTRAINT "student_transfer_requests_requested_by_id_fkey";

-- DropForeignKey
ALTER TABLE "student_transfer_requests" DROP CONSTRAINT "student_transfer_requests_student_id_fkey";

-- DropForeignKey
ALTER TABLE "student_transfer_requests" DROP CONSTRAINT "student_transfer_requests_to_school_id_fkey";

-- DropForeignKey
ALTER TABLE "subjects" DROP CONSTRAINT "subjects_academic_year_id_fkey";

-- DropForeignKey
ALTER TABLE "subjects" DROP CONSTRAINT "subjects_class_id_fkey";

-- DropForeignKey
ALTER TABLE "teacher_bank_details" DROP CONSTRAINT "teacher_bank_details_teacher_id_fkey";

-- DropIndex
DROP INDEX "academic_years_school_id_name_key";

-- AlterTable
ALTER TABLE "exam_papers" ADD COLUMN     "pass_marks" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "student_transfer_requests" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "decided_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "teacher_bank_details" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transfer_requests" ADD CONSTRAINT "student_transfer_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transfer_requests" ADD CONSTRAINT "student_transfer_requests_from_school_id_fkey" FOREIGN KEY ("from_school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transfer_requests" ADD CONSTRAINT "student_transfer_requests_to_school_id_fkey" FOREIGN KEY ("to_school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transfer_requests" ADD CONSTRAINT "student_transfer_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transfer_requests" ADD CONSTRAINT "student_transfer_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_bank_details" ADD CONSTRAINT "teacher_bank_details_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

