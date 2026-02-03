/*
  Warnings:

  - A unique constraint covering the columns `[user_id]` on the table `parent_profiles` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RoleName" ADD VALUE 'ACCOUNTANT';
ALTER TYPE "RoleName" ADD VALUE 'LIBRARIAN';
ALTER TYPE "RoleName" ADD VALUE 'STAFF';

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
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "teacher_bank_details" DROP CONSTRAINT "teacher_bank_details_teacher_id_fkey";

-- AlterTable
ALTER TABLE "student_photos" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "student_transfer_requests" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "decided_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subscription_plans" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subscriptions" ALTER COLUMN "paid_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "next_due_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "teacher_bank_details" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "employee_role_permissions" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "role_name" "RoleName" NOT NULL,
    "permission_code" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_role_permissions_school_id_role_name_idx" ON "employee_role_permissions"("school_id", "role_name");

-- CreateIndex
CREATE UNIQUE INDEX "employee_role_permissions_school_id_role_name_permission_co_key" ON "employee_role_permissions"("school_id", "role_name", "permission_code");

-- CreateIndex
CREATE UNIQUE INDEX "parent_profiles_user_id_key" ON "parent_profiles"("user_id");

-- AddForeignKey
ALTER TABLE "employee_role_permissions" ADD CONSTRAINT "employee_role_permissions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
