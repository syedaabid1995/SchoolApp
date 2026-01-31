DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'parent_profiles_school_id_user_id_key') THEN
    EXECUTE 'DROP INDEX "parent_profiles_school_id_user_id_key"';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "parent_profiles_user_id_key" ON "parent_profiles" ("user_id");

CREATE TABLE "teacher_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "employee_no" text,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "phone" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "teacher_profiles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE,
  CONSTRAINT "teacher_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "teacher_profiles_user_id_key" ON "teacher_profiles" ("user_id");
CREATE UNIQUE INDEX "teacher_profiles_school_id_employee_no_key" ON "teacher_profiles" ("school_id", "employee_no");
CREATE INDEX "teacher_profiles_school_id_idx" ON "teacher_profiles" ("school_id");

CREATE TYPE "ImportType" AS ENUM ('STUDENT', 'TEACHER');
CREATE TYPE "ImportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "import_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL,
  "created_by_id" uuid NOT NULL,
  "type" "ImportType" NOT NULL,
  "status" "ImportStatus" NOT NULL DEFAULT 'QUEUED',
  "file_path" text NOT NULL,
  "original_name" text NOT NULL,
  "total_rows" int NOT NULL DEFAULT 0,
  "processed_rows" int NOT NULL DEFAULT 0,
  "success_count" int NOT NULL DEFAULT 0,
  "error_count" int NOT NULL DEFAULT 0,
  "dry_run" boolean NOT NULL DEFAULT false,
  "started_at" timestamptz,
  "finished_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "import_jobs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE,
  CONSTRAINT "import_jobs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT
);

CREATE INDEX "import_jobs_school_id_idx" ON "import_jobs" ("school_id");
CREATE INDEX "import_jobs_created_by_id_idx" ON "import_jobs" ("created_by_id");

CREATE TABLE "import_row_errors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "import_job_id" uuid NOT NULL,
  "row_number" int NOT NULL,
  "field" text,
  "message" text NOT NULL,
  "raw_data" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "import_row_errors_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs" ("id") ON DELETE CASCADE
);

CREATE INDEX "import_row_errors_import_job_id_idx" ON "import_row_errors" ("import_job_id");
