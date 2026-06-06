CREATE TYPE "SubscriptionInvoiceStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED');

CREATE TYPE "SubscriptionPaymentMode" AS ENUM ('CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'CHEQUE', 'OTHER');

ALTER TABLE "subscription_plans"
  ADD COLUMN "trial_days" INTEGER NOT NULL DEFAULT 14;

CREATE TABLE "subscription_invoices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "subscription_id" UUID NOT NULL,
  "plan_id" UUID,
  "invoice_number" TEXT NOT NULL,
  "billing_period_start" TIMESTAMP(3) NOT NULL,
  "billing_period_end" TIMESTAMP(3) NOT NULL,
  "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "balance_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "status" "SubscriptionInvoiceStatus" NOT NULL DEFAULT 'UNPAID',
  "due_date" TIMESTAMP(3) NOT NULL,
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscription_payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "subscription_id" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "payment_mode" "SubscriptionPaymentMode" NOT NULL,
  "reference_number" TEXT,
  "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "proof_url" TEXT,
  "received_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_invoices_school_id_invoice_number_key"
  ON "subscription_invoices"("school_id", "invoice_number");

CREATE INDEX "subscription_invoices_school_id_idx" ON "subscription_invoices"("school_id");
CREATE INDEX "subscription_invoices_subscription_id_idx" ON "subscription_invoices"("subscription_id");
CREATE INDEX "subscription_invoices_plan_id_idx" ON "subscription_invoices"("plan_id");
CREATE INDEX "subscription_invoices_status_idx" ON "subscription_invoices"("status");
CREATE INDEX "subscription_invoices_due_date_idx" ON "subscription_invoices"("due_date");
CREATE INDEX "subscription_invoices_school_id_subscription_id_billing_period_start_billing_period_end_idx"
  ON "subscription_invoices"("school_id", "subscription_id", "billing_period_start", "billing_period_end");

CREATE INDEX "subscription_payments_school_id_idx" ON "subscription_payments"("school_id");
CREATE INDEX "subscription_payments_invoice_id_idx" ON "subscription_payments"("invoice_id");
CREATE INDEX "subscription_payments_subscription_id_idx" ON "subscription_payments"("subscription_id");
CREATE INDEX "subscription_payments_received_by_user_id_idx" ON "subscription_payments"("received_by_user_id");
CREATE INDEX "subscription_payments_payment_date_idx" ON "subscription_payments"("payment_date");

ALTER TABLE "subscription_invoices"
  ADD CONSTRAINT "subscription_invoices_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscription_invoices"
  ADD CONSTRAINT "subscription_invoices_subscription_id_fkey"
  FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscription_invoices"
  ADD CONSTRAINT "subscription_invoices_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "subscription_payments"
  ADD CONSTRAINT "subscription_payments_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscription_payments"
  ADD CONSTRAINT "subscription_payments_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "subscription_invoices"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscription_payments"
  ADD CONSTRAINT "subscription_payments_subscription_id_fkey"
  FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscription_payments"
  ADD CONSTRAINT "subscription_payments_received_by_user_id_fkey"
  FOREIGN KEY ("received_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
