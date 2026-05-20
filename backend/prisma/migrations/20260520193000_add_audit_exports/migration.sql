CREATE TABLE "audit_exports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "requested_by_id" uuid NOT NULL,
  "school_id" uuid,
  "format" text NOT NULL,
  "filters" jsonb,
  "reason" text,
  "status" text NOT NULL DEFAULT 'PENDING',
  "row_count" integer,
  "file_url" text,
  "file_key" text,
  "error_message" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz,
  CONSTRAINT "audit_exports_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "audit_exports_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "audit_exports_requested_by_id_idx" ON "audit_exports" ("requested_by_id");
CREATE INDEX "audit_exports_school_id_idx" ON "audit_exports" ("school_id");
CREATE INDEX "audit_exports_status_idx" ON "audit_exports" ("status");
CREATE INDEX "audit_exports_created_at_idx" ON "audit_exports" ("created_at");
