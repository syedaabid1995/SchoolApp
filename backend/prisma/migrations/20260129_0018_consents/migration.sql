CREATE TYPE "ConsentType" AS ENUM ('BIOMETRIC', 'DATA_PROCESSING');

CREATE TABLE "consent_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "version" text NOT NULL,
  "type" "ConsentType" NOT NULL,
  "text" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "consent_documents_version_type_key" ON "consent_documents" ("version", "type");

CREATE TABLE "consent_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL,
  "parent_id" uuid NOT NULL,
  "document_id" uuid NOT NULL,
  "status" text NOT NULL DEFAULT 'GRANTED',
  "granted_at" timestamptz NOT NULL DEFAULT now(),
  "withdrawn_at" timestamptz,
  CONSTRAINT "consent_records_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE,
  CONSTRAINT "consent_records_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parent_profiles" ("id") ON DELETE CASCADE,
  CONSTRAINT "consent_records_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "consent_documents" ("id") ON DELETE CASCADE
);

CREATE INDEX "consent_records_school_id_idx" ON "consent_records" ("school_id");
CREATE INDEX "consent_records_parent_id_idx" ON "consent_records" ("parent_id");
CREATE INDEX "consent_records_document_id_idx" ON "consent_records" ("document_id");
