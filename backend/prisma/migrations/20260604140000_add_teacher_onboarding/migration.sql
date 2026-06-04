CREATE TABLE "teacher_onboardings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "teacher_id" UUID NOT NULL,
  "account_created" BOOLEAN NOT NULL DEFAULT false,
  "temporary_password_shared" BOOLEAN NOT NULL DEFAULT false,
  "manual_share_confirmed" BOOLEAN NOT NULL DEFAULT false,
  "first_login_completed" BOOLEAN NOT NULL DEFAULT false,
  "password_changed" BOOLEAN NOT NULL DEFAULT false,
  "profile_completed" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "class_assigned" BOOLEAN NOT NULL DEFAULT false,
  "subject_assigned" BOOLEAN NOT NULL DEFAULT false,
  "timetable_assigned" BOOLEAN NOT NULL DEFAULT false,
  "attendance_enabled" BOOLEAN NOT NULL DEFAULT false,
  "readiness_status" TEXT NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "teacher_onboardings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "teacher_onboardings_teacher_id_key"
  ON "teacher_onboardings"("teacher_id");

CREATE INDEX "teacher_onboardings_school_id_idx"
  ON "teacher_onboardings"("school_id");

ALTER TABLE "teacher_onboardings"
  ADD CONSTRAINT "teacher_onboardings_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "teacher_onboardings"
  ADD CONSTRAINT "teacher_onboardings_teacher_id_fkey"
  FOREIGN KEY ("teacher_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
