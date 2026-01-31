CREATE TYPE "BackupStatus" AS ENUM ('REQUESTED', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "RestoreStatus" AS ENUM ('REQUESTED', 'APPROVED', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "backup_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL,
  "status" "BackupStatus" NOT NULL DEFAULT 'REQUESTED',
  "storage_path" text,
  "requested_by_id" uuid NOT NULL,
  "reason" text,
  "started_at" timestamptz,
  "finished_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "backup_jobs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE,
  CONSTRAINT "backup_jobs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT
);

CREATE INDEX "backup_jobs_school_id_idx" ON "backup_jobs" ("school_id");
CREATE INDEX "backup_jobs_requested_by_id_idx" ON "backup_jobs" ("requested_by_id");

CREATE TABLE "restore_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "backup_id" uuid NOT NULL,
  "status" "RestoreStatus" NOT NULL DEFAULT 'REQUESTED',
  "approved_by_id" uuid,
  "requested_by_id" uuid NOT NULL,
  "reason" text,
  "started_at" timestamptz,
  "finished_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "restore_jobs_backup_id_fkey" FOREIGN KEY ("backup_id") REFERENCES "backup_jobs" ("id") ON DELETE CASCADE,
  CONSTRAINT "restore_jobs_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users" ("id") ON DELETE SET NULL,
  CONSTRAINT "restore_jobs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT
);

CREATE INDEX "restore_jobs_backup_id_idx" ON "restore_jobs" ("backup_id");
CREATE INDEX "restore_jobs_approved_by_id_idx" ON "restore_jobs" ("approved_by_id");
CREATE INDEX "restore_jobs_requested_by_id_idx" ON "restore_jobs" ("requested_by_id");
