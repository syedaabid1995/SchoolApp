CREATE TYPE "StudentStatus" AS ENUM ('ENROLLED', 'TRANSFERRED', 'EXITED');

CREATE TABLE "students" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL,
  "admission_no" text NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "dob" timestamptz,
  "status" "StudentStatus" NOT NULL DEFAULT 'ENROLLED',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "students_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "students_school_id_admission_no_key" ON "students" ("school_id", "admission_no");
CREATE INDEX "students_school_id_idx" ON "students" ("school_id");

CREATE TABLE "parent_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL,
  "user_id" uuid,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "phone" text,
  "email" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "parent_profiles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE,
  CONSTRAINT "parent_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "parent_profiles_school_id_user_id_key" ON "parent_profiles" ("school_id", "user_id");
CREATE INDEX "parent_profiles_school_id_idx" ON "parent_profiles" ("school_id");

CREATE TABLE "student_parents" (
  "student_id" uuid NOT NULL,
  "parent_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "student_parents_pkey" PRIMARY KEY ("student_id", "parent_id"),
  CONSTRAINT "student_parents_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE,
  CONSTRAINT "student_parents_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parent_profiles" ("id") ON DELETE CASCADE
);

CREATE INDEX "student_parents_parent_id_idx" ON "student_parents" ("parent_id");

CREATE TABLE "student_status_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id" uuid NOT NULL,
  "status" "StudentStatus" NOT NULL,
  "reason" text,
  "changed_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "student_status_history_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE
);

CREATE INDEX "student_status_history_student_id_idx" ON "student_status_history" ("student_id");
