ALTER TABLE "fee_payments"
ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "unique_school_fee_payment_idempotency"
ON "fee_payments" ("school_id", "idempotency_key");
