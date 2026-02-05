-- CreateEnum
CREATE TYPE "StudentAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY');

-- CreateEnum
CREATE TYPE "StudentAttendanceSessionStatus" AS ENUM ('DRAFT', 'LOCKED');

-- CreateEnum
CREATE TYPE "TeacherSelfAttendanceStatus" AS ENUM ('PRESENT', 'LEAVE');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "student_attendance_sessions" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "StudentAttendanceSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID NOT NULL,
    "locked_at" TIMESTAMP(3),
    "locked_by_id" UUID,
    "lock_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_attendance_records" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" "StudentAttendanceStatus" NOT NULL,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_leave_requests" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "from_date" TIMESTAMP(3) NOT NULL,
    "to_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_self_attendances" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "TeacherSelfAttendanceStatus" NOT NULL,
    "leave_request_id" UUID,
    "override_reason" TEXT,
    "created_by_id" UUID NOT NULL,
    "overridden_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_self_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_attendance_sessions_school_id_date_idx" ON "student_attendance_sessions"("school_id", "date");

-- CreateIndex
CREATE INDEX "student_attendance_sessions_class_id_section_id_date_idx" ON "student_attendance_sessions"("class_id", "section_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "student_attendance_sessions_school_id_class_id_section_id_d_key" ON "student_attendance_sessions"("school_id", "class_id", "section_id", "date");

-- CreateIndex
CREATE INDEX "student_attendance_records_student_id_created_at_idx" ON "student_attendance_records"("student_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "student_attendance_records_session_id_student_id_key" ON "student_attendance_records"("session_id", "student_id");

-- CreateIndex
CREATE INDEX "teacher_leave_requests_school_id_status_created_at_idx" ON "teacher_leave_requests"("school_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "teacher_leave_requests_teacher_id_status_from_date_idx" ON "teacher_leave_requests"("teacher_id", "status", "from_date");

-- CreateIndex
CREATE INDEX "teacher_self_attendances_school_id_date_idx" ON "teacher_self_attendances"("school_id", "date");

-- CreateIndex
CREATE INDEX "teacher_self_attendances_teacher_id_date_idx" ON "teacher_self_attendances"("teacher_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_self_attendances_school_id_teacher_id_date_key" ON "teacher_self_attendances"("school_id", "teacher_id", "date");

-- AddForeignKey
ALTER TABLE "student_attendance_sessions" ADD CONSTRAINT "student_attendance_sessions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_sessions" ADD CONSTRAINT "student_attendance_sessions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_sessions" ADD CONSTRAINT "student_attendance_sessions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_sessions" ADD CONSTRAINT "student_attendance_sessions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_sessions" ADD CONSTRAINT "student_attendance_sessions_locked_by_id_fkey" FOREIGN KEY ("locked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_records" ADD CONSTRAINT "student_attendance_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "student_attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_records" ADD CONSTRAINT "student_attendance_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_leave_requests" ADD CONSTRAINT "teacher_leave_requests_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_leave_requests" ADD CONSTRAINT "teacher_leave_requests_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_leave_requests" ADD CONSTRAINT "teacher_leave_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_self_attendances" ADD CONSTRAINT "teacher_self_attendances_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_self_attendances" ADD CONSTRAINT "teacher_self_attendances_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_self_attendances" ADD CONSTRAINT "teacher_self_attendances_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "teacher_leave_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_self_attendances" ADD CONSTRAINT "teacher_self_attendances_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_self_attendances" ADD CONSTRAINT "teacher_self_attendances_overridden_by_id_fkey" FOREIGN KEY ("overridden_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
