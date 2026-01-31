CREATE TYPE "ExamType" AS ENUM ('MIDTERM', 'FINAL', 'QUIZ', 'ASSIGNMENT');
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

CREATE TABLE "exams" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL,
  "academic_year_id" uuid NOT NULL,
  "term_id" uuid,
  "name" text NOT NULL,
  "type" "ExamType" NOT NULL,
  "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduled_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "exams_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE,
  CONSTRAINT "exams_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years" ("id") ON DELETE CASCADE,
  CONSTRAINT "exams_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms" ("id") ON DELETE SET NULL
);

CREATE INDEX "exams_school_id_idx" ON "exams" ("school_id");
CREATE INDEX "exams_academic_year_id_idx" ON "exams" ("academic_year_id");
CREATE INDEX "exams_term_id_idx" ON "exams" ("term_id");

CREATE TABLE "exam_papers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "exam_id" uuid NOT NULL,
  "subject_id" uuid NOT NULL,
  "class_id" uuid NOT NULL,
  "max_marks" double precision NOT NULL,
  "weightage" double precision NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "exam_papers_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams" ("id") ON DELETE CASCADE,
  CONSTRAINT "exam_papers_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects" ("id") ON DELETE CASCADE,
  CONSTRAINT "exam_papers_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "exam_papers_exam_id_subject_id_class_id_key" ON "exam_papers" ("exam_id", "subject_id", "class_id");
CREATE INDEX "exam_papers_exam_id_idx" ON "exam_papers" ("exam_id");
CREATE INDEX "exam_papers_subject_id_idx" ON "exam_papers" ("subject_id");
CREATE INDEX "exam_papers_class_id_idx" ON "exam_papers" ("class_id");

CREATE TABLE "marks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "exam_paper_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "marks" double precision NOT NULL,
  "grade" text,
  "moderated" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "marks_exam_paper_id_fkey" FOREIGN KEY ("exam_paper_id") REFERENCES "exam_papers" ("id") ON DELETE CASCADE,
  CONSTRAINT "marks_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "marks_exam_paper_id_student_id_key" ON "marks" ("exam_paper_id", "student_id");
CREATE INDEX "marks_exam_paper_id_idx" ON "marks" ("exam_paper_id");
CREATE INDEX "marks_student_id_idx" ON "marks" ("student_id");

CREATE TABLE "mark_moderations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "mark_id" uuid NOT NULL,
  "adjusted_marks" double precision NOT NULL,
  "reason" text,
  "approved_by_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "mark_moderations_mark_id_fkey" FOREIGN KEY ("mark_id") REFERENCES "marks" ("id") ON DELETE CASCADE,
  CONSTRAINT "mark_moderations_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT
);

CREATE INDEX "mark_moderations_mark_id_idx" ON "mark_moderations" ("mark_id");
CREATE INDEX "mark_moderations_approved_by_id_idx" ON "mark_moderations" ("approved_by_id");

CREATE TABLE "mark_revaluations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "mark_id" uuid NOT NULL,
  "requested_by_id" uuid NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING',
  "remarks" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "mark_revaluations_mark_id_fkey" FOREIGN KEY ("mark_id") REFERENCES "marks" ("id") ON DELETE CASCADE,
  CONSTRAINT "mark_revaluations_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT
);

CREATE INDEX "mark_revaluations_mark_id_idx" ON "mark_revaluations" ("mark_id");
CREATE INDEX "mark_revaluations_requested_by_id_idx" ON "mark_revaluations" ("requested_by_id");
