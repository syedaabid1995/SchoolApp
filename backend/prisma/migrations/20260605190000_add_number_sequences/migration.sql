DO $$
BEGIN
  CREATE TYPE "NumberSequenceType" AS ENUM ('INVOICE', 'PAYMENT', 'RECEIPT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "number_sequences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "academic_session_id" UUID,
  "type" "NumberSequenceType" NOT NULL,
  "year" INTEGER NOT NULL,
  "prefix" TEXT NOT NULL,
  "last_number" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "number_sequences_school_id_type_year_key" ON "number_sequences"("school_id", "type", "year");
CREATE INDEX IF NOT EXISTS "number_sequences_school_id_type_year_idx" ON "number_sequences"("school_id", "type", "year");
CREATE INDEX IF NOT EXISTS "number_sequences_academic_session_id_idx" ON "number_sequences"("academic_session_id");

ALTER TABLE "number_sequences"
  ADD CONSTRAINT "number_sequences_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "number_sequences"
  ADD CONSTRAINT "number_sequences_academic_session_id_fkey"
  FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

WITH parsed AS (
  SELECT
    "school_id",
    (regexp_match("invoice_number", '^([A-Z]+)-([0-9]{4})-([0-9]+)$'))[1] AS "prefix",
    ((regexp_match("invoice_number", '^([A-Z]+)-([0-9]{4})-([0-9]+)$'))[2])::INTEGER AS "year",
    ((regexp_match("invoice_number", '^([A-Z]+)-([0-9]{4})-([0-9]+)$'))[3])::INTEGER AS "number"
  FROM "fee_invoices"
  WHERE "invoice_number" ~ '^([A-Z]+)-([0-9]{4})-([0-9]+)$'
)
INSERT INTO "number_sequences" ("id", "school_id", "type", "year", "prefix", "last_number", "created_at", "updated_at")
SELECT gen_random_uuid(), "school_id", 'INVOICE'::"NumberSequenceType", "year", "prefix", MAX("number"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM parsed
GROUP BY "school_id", "year", "prefix"
ON CONFLICT ("school_id", "type", "year") DO UPDATE
SET "last_number" = GREATEST("number_sequences"."last_number", EXCLUDED."last_number"),
    "prefix" = EXCLUDED."prefix",
    "updated_at" = CURRENT_TIMESTAMP;

WITH parsed AS (
  SELECT
    "school_id",
    (regexp_match("payment_number", '^([A-Z]+)-([0-9]{4})-([0-9]+)$'))[1] AS "prefix",
    ((regexp_match("payment_number", '^([A-Z]+)-([0-9]{4})-([0-9]+)$'))[2])::INTEGER AS "year",
    ((regexp_match("payment_number", '^([A-Z]+)-([0-9]{4})-([0-9]+)$'))[3])::INTEGER AS "number"
  FROM "fee_payments"
  WHERE "payment_number" ~ '^([A-Z]+)-([0-9]{4})-([0-9]+)$'
)
INSERT INTO "number_sequences" ("id", "school_id", "type", "year", "prefix", "last_number", "created_at", "updated_at")
SELECT gen_random_uuid(), "school_id", 'PAYMENT'::"NumberSequenceType", "year", "prefix", MAX("number"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM parsed
GROUP BY "school_id", "year", "prefix"
ON CONFLICT ("school_id", "type", "year") DO UPDATE
SET "last_number" = GREATEST("number_sequences"."last_number", EXCLUDED."last_number"),
    "prefix" = EXCLUDED."prefix",
    "updated_at" = CURRENT_TIMESTAMP;

WITH parsed AS (
  SELECT
    "school_id",
    (regexp_match("receipt_number", '^([A-Z]+)-([0-9]{4})-([0-9]+)$'))[1] AS "prefix",
    ((regexp_match("receipt_number", '^([A-Z]+)-([0-9]{4})-([0-9]+)$'))[2])::INTEGER AS "year",
    ((regexp_match("receipt_number", '^([A-Z]+)-([0-9]{4})-([0-9]+)$'))[3])::INTEGER AS "number"
  FROM "fee_receipts"
  WHERE "receipt_number" ~ '^([A-Z]+)-([0-9]{4})-([0-9]+)$'
)
INSERT INTO "number_sequences" ("id", "school_id", "type", "year", "prefix", "last_number", "created_at", "updated_at")
SELECT gen_random_uuid(), "school_id", 'RECEIPT'::"NumberSequenceType", "year", "prefix", MAX("number"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM parsed
GROUP BY "school_id", "year", "prefix"
ON CONFLICT ("school_id", "type", "year") DO UPDATE
SET "last_number" = GREATEST("number_sequences"."last_number", EXCLUDED."last_number"),
    "prefix" = EXCLUDED."prefix",
    "updated_at" = CURRENT_TIMESTAMP;
