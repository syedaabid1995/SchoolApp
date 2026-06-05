ALTER TABLE "fee_payments"
ADD COLUMN IF NOT EXISTS "cheque_number" TEXT,
ADD COLUMN IF NOT EXISTS "bank_name" TEXT;

CREATE TABLE IF NOT EXISTS "fee_payment_allocations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "academic_session_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "allocated_amount" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_payment_allocations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fee_payment_allocations_payment_id_invoice_id_key"
ON "fee_payment_allocations"("payment_id", "invoice_id");

CREATE INDEX IF NOT EXISTS "fee_payment_allocations_school_id_academic_session_id_idx"
ON "fee_payment_allocations"("school_id", "academic_session_id");

CREATE INDEX IF NOT EXISTS "fee_payment_allocations_student_id_idx"
ON "fee_payment_allocations"("student_id");

CREATE INDEX IF NOT EXISTS "fee_payment_allocations_payment_id_idx"
ON "fee_payment_allocations"("payment_id");

CREATE INDEX IF NOT EXISTS "fee_payment_allocations_invoice_id_idx"
ON "fee_payment_allocations"("invoice_id");

DO $$
BEGIN
  ALTER TABLE "fee_payment_allocations"
    ADD CONSTRAINT "fee_payment_allocations_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "fee_payment_allocations"
    ADD CONSTRAINT "fee_payment_allocations_academic_session_id_fkey"
    FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "fee_payment_allocations"
    ADD CONSTRAINT "fee_payment_allocations_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "fee_payment_allocations"
    ADD CONSTRAINT "fee_payment_allocations_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "fee_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "fee_payment_allocations"
    ADD CONSTRAINT "fee_payment_allocations_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "fee_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
