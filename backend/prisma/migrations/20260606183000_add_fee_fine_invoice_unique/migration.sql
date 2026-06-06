ALTER TABLE "fee_fines" ADD COLUMN "invoice_id" UUID;

ALTER TABLE "fee_fines"
  ADD CONSTRAINT "fee_fines_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "fee_invoices"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "unique_invoice_fine_rule"
  ON "fee_fines"("school_id", "academic_session_id", "invoice_id", "name", "fine_type");

CREATE INDEX "fee_fines_invoice_id_idx" ON "fee_fines"("invoice_id");
