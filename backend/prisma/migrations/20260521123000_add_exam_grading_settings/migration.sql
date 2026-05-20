CREATE TABLE "exam_grading_settings" (
  "id" UUID NOT NULL,
  "school_id" UUID NOT NULL,
  "grade_scale" JSONB NOT NULL,
  "fail_criteria" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "exam_grading_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exam_grading_settings_school_id_key" ON "exam_grading_settings"("school_id");
CREATE INDEX "exam_grading_settings_school_id_idx" ON "exam_grading_settings"("school_id");

ALTER TABLE "exam_grading_settings"
  ADD CONSTRAINT "exam_grading_settings_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
