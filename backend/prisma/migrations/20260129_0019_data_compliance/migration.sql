CREATE TYPE "DataJobStatus" AS ENUM ('REQUESTED', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "DeletionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "data_export_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL,
  "requested_by_id" uuid NOT NULL,
  "status" "DataJobStatus" NOT NULL DEFAULT 'REQUESTED',
  "file_path" text,
  "started_at" timestamptz,
  "finished_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "data_export_jobs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE,
  CONSTRAINT "data_export_jobs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT
);

CREATE INDEX "data_export_jobs_school_id_idx" ON "data_export_jobs" ("school_id");
CREATE INDEX "data_export_jobs_requested_by_id_idx" ON "data_export_jobs" ("requested_by_id");

CREATE TABLE "data_deletion_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL,
  "requested_by_id" uuid NOT NULL,
  "approved_by_id" uuid,
  "status" "DeletionStatus" NOT NULL DEFAULT 'REQUESTED',
  "reason" text,
  "scheduled_for" timestamptz,
  "started_at" timestamptz,
  "finished_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "data_deletion_jobs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE,
  CONSTRAINT "data_deletion_jobs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT,
  CONSTRAINT "data_deletion_jobs_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE INDEX "data_deletion_jobs_school_id_idx" ON "data_deletion_jobs" ("school_id");
CREATE INDEX "data_deletion_jobs_requested_by_id_idx" ON "data_deletion_jobs" ("requested_by_id");
CREATE INDEX "data_deletion_jobs_approved_by_id_idx" ON "data_deletion_jobs" ("approved_by_id");
