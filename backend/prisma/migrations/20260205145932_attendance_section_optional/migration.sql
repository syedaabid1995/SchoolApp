-- DropForeignKey
ALTER TABLE "student_attendance_sessions" DROP CONSTRAINT "student_attendance_sessions_section_id_fkey";

-- AlterTable
ALTER TABLE "student_attendance_sessions" ALTER COLUMN "section_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "student_attendance_sessions" ADD CONSTRAINT "student_attendance_sessions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
