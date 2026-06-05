ALTER TYPE "FeeLedgerEntryType" ADD VALUE IF NOT EXISTS 'OPENING_BALANCE';
ALTER TYPE "FeeLedgerEntryType" ADD VALUE IF NOT EXISTS 'INVOICE_DEBIT';
ALTER TYPE "FeeLedgerEntryType" ADD VALUE IF NOT EXISTS 'DISCOUNT_CREDIT';
ALTER TYPE "FeeLedgerEntryType" ADD VALUE IF NOT EXISTS 'FINE_DEBIT';
ALTER TYPE "FeeLedgerEntryType" ADD VALUE IF NOT EXISTS 'PAYMENT_CREDIT';
ALTER TYPE "FeeLedgerEntryType" ADD VALUE IF NOT EXISTS 'CANCELLATION_REVERSAL';
ALTER TYPE "FeeLedgerEntryType" ADD VALUE IF NOT EXISTS 'FINE_WAIVER';
ALTER TYPE "FeeLedgerEntryType" ADD VALUE IF NOT EXISTS 'DISCOUNT_REVERSAL';

ALTER TABLE "fee_ledgers"
ADD COLUMN IF NOT EXISTS "receipt_id" UUID,
ADD COLUMN IF NOT EXISTS "created_by_id" UUID;

CREATE INDEX IF NOT EXISTS "fee_ledgers_receipt_id_idx" ON "fee_ledgers"("receipt_id");
CREATE INDEX IF NOT EXISTS "fee_ledgers_entry_type_idx" ON "fee_ledgers"("entry_type");
CREATE INDEX IF NOT EXISTS "fee_ledgers_created_by_id_idx" ON "fee_ledgers"("created_by_id");

DO $$
BEGIN
  ALTER TABLE "fee_ledgers"
    ADD CONSTRAINT "fee_ledgers_receipt_id_fkey"
    FOREIGN KEY ("receipt_id") REFERENCES "fee_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "fee_ledgers"
    ADD CONSTRAINT "fee_ledgers_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
