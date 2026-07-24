CREATE TABLE "student_leave_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "parent_id" UUID NOT NULL,
  "leave_type" TEXT NOT NULL,
  "from_date" DATE NOT NULL,
  "to_date" DATE NOT NULL,
  "requested_days" INTEGER NOT NULL,
  "working_days" INTEGER NOT NULL,
  "skipped_days" JSONB NOT NULL DEFAULT '[]',
  "reason" TEXT NOT NULL,
  "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "review_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "student_leave_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "student_leave_requests_school_id_status_created_at_idx" ON "student_leave_requests"("school_id", "status", "created_at");
CREATE INDEX "student_leave_requests_student_id_status_from_date_idx" ON "student_leave_requests"("student_id", "status", "from_date");
CREATE INDEX "student_leave_requests_parent_id_created_at_idx" ON "student_leave_requests"("parent_id", "created_at");

ALTER TABLE "student_leave_requests"
  ADD CONSTRAINT "student_leave_requests_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_leave_requests"
  ADD CONSTRAINT "student_leave_requests_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_leave_requests"
  ADD CONSTRAINT "student_leave_requests_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "parent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_leave_requests"
  ADD CONSTRAINT "student_leave_requests_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
