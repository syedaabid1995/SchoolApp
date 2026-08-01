CREATE TABLE "homework_notification_receipts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "homework_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "parent_profile_id" UUID NOT NULL,
  "parent_user_id" UUID,
  "notification_log_id" UUID,
  "viewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "homework_notification_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "homework_receipt_homework_student_parent_key"
  ON "homework_notification_receipts"("homework_id", "student_id", "parent_profile_id");

CREATE INDEX "homework_notification_receipts_school_id_idx"
  ON "homework_notification_receipts"("school_id");

CREATE INDEX "homework_notification_receipts_homework_id_idx"
  ON "homework_notification_receipts"("homework_id");

CREATE INDEX "homework_notification_receipts_student_id_idx"
  ON "homework_notification_receipts"("student_id");

CREATE INDEX "homework_notification_receipts_parent_profile_id_idx"
  ON "homework_notification_receipts"("parent_profile_id");

CREATE INDEX "homework_notification_receipts_parent_user_id_idx"
  ON "homework_notification_receipts"("parent_user_id");

CREATE INDEX "homework_notification_receipts_notification_log_id_idx"
  ON "homework_notification_receipts"("notification_log_id");

CREATE INDEX "homework_notification_receipts_viewed_at_idx"
  ON "homework_notification_receipts"("viewed_at");

ALTER TABLE "homework_notification_receipts"
  ADD CONSTRAINT "homework_notification_receipts_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "homework_notification_receipts"
  ADD CONSTRAINT "homework_notification_receipts_homework_id_fkey"
  FOREIGN KEY ("homework_id") REFERENCES "homeworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "homework_notification_receipts"
  ADD CONSTRAINT "homework_notification_receipts_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "homework_notification_receipts"
  ADD CONSTRAINT "homework_notification_receipts_parent_profile_id_fkey"
  FOREIGN KEY ("parent_profile_id") REFERENCES "parent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "homework_notification_receipts"
  ADD CONSTRAINT "homework_notification_receipts_parent_user_id_fkey"
  FOREIGN KEY ("parent_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "homework_notification_receipts"
  ADD CONSTRAINT "homework_notification_receipts_notification_log_id_fkey"
  FOREIGN KEY ("notification_log_id") REFERENCES "notification_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
