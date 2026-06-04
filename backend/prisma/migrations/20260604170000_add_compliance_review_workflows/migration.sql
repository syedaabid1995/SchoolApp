ALTER TYPE "DataJobStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "DataJobStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "DeletionStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TABLE "data_export_jobs"
  ADD COLUMN IF NOT EXISTS "reviewed_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "review_note" TEXT,
  ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);

ALTER TABLE "data_deletion_jobs"
  ADD COLUMN IF NOT EXISTS "reviewed_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "review_note" TEXT,
  ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "compliance_job_status_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "job_type" TEXT NOT NULL,
  "job_id" UUID NOT NULL,
  "old_status" TEXT NOT NULL,
  "new_status" TEXT NOT NULL,
  "actor_id" UUID NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "compliance_job_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "data_export_jobs_reviewed_by_id_idx" ON "data_export_jobs"("reviewed_by_id");
CREATE INDEX IF NOT EXISTS "data_deletion_jobs_reviewed_by_id_idx" ON "data_deletion_jobs"("reviewed_by_id");
CREATE INDEX IF NOT EXISTS "compliance_job_status_history_school_id_idx" ON "compliance_job_status_history"("school_id");
CREATE INDEX IF NOT EXISTS "compliance_job_status_history_job_type_job_id_idx" ON "compliance_job_status_history"("job_type", "job_id");
CREATE INDEX IF NOT EXISTS "compliance_job_status_history_actor_id_idx" ON "compliance_job_status_history"("actor_id");

ALTER TABLE "data_export_jobs"
  ADD CONSTRAINT "data_export_jobs_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "data_deletion_jobs"
  ADD CONSTRAINT "data_deletion_jobs_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "compliance_job_status_history"
  ADD CONSTRAINT "compliance_job_status_history_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "compliance_job_status_history"
  ADD CONSTRAINT "compliance_job_status_history_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
