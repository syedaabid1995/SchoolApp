CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'OVERRIDE');

CREATE TABLE "attendance_audits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "record_id" uuid NOT NULL,
  "actor_id" uuid NOT NULL,
  "action" "AuditAction" NOT NULL,
  "previous_value" jsonb,
  "new_value" jsonb,
  "reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "attendance_audits_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "attendance_records" ("id") ON DELETE CASCADE,
  CONSTRAINT "attendance_audits_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users" ("id") ON DELETE RESTRICT
);

CREATE INDEX "attendance_audits_record_id_idx" ON "attendance_audits" ("record_id");
CREATE INDEX "attendance_audits_actor_id_idx" ON "attendance_audits" ("actor_id");

CREATE TABLE "attendance_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "record_id" uuid NOT NULL,
  "image_url" text,
  "confidence" double precision,
  "model_version" text,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "attendance_evidence_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "attendance_records" ("id") ON DELETE CASCADE
);

CREATE INDEX "attendance_evidence_record_id_idx" ON "attendance_evidence" ("record_id");
