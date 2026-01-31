ALTER TABLE "teacher_profiles" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true;

CREATE TABLE "teacher_class_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "teacher_id" uuid NOT NULL,
  "class_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "teacher_class_assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teacher_profiles" ("id") ON DELETE CASCADE,
  CONSTRAINT "teacher_class_assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "teacher_class_assignments_teacher_id_class_id_key" ON "teacher_class_assignments" ("teacher_id", "class_id");
CREATE INDEX "teacher_class_assignments_teacher_id_idx" ON "teacher_class_assignments" ("teacher_id");
CREATE INDEX "teacher_class_assignments_class_id_idx" ON "teacher_class_assignments" ("class_id");

CREATE TABLE "teacher_subject_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "teacher_id" uuid NOT NULL,
  "subject_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "teacher_subject_assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teacher_profiles" ("id") ON DELETE CASCADE,
  CONSTRAINT "teacher_subject_assignments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "teacher_subject_assignments_teacher_id_subject_id_key" ON "teacher_subject_assignments" ("teacher_id", "subject_id");
CREATE INDEX "teacher_subject_assignments_teacher_id_idx" ON "teacher_subject_assignments" ("teacher_id");
CREATE INDEX "teacher_subject_assignments_subject_id_idx" ON "teacher_subject_assignments" ("subject_id");
