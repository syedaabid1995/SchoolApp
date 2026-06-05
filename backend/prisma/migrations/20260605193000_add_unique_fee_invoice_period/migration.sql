CREATE UNIQUE INDEX IF NOT EXISTS "unique_student_fee_invoice_period"
ON "fee_invoices" (
  "school_id",
  "academic_session_id",
  "student_id",
  "fee_structure_id",
  "fee_type_id",
  "fee_month"
);
