CREATE TYPE "FeeRecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "FeeParticularType" AS ENUM ('CHARGE', 'DISCOUNT', 'FINE', 'PREVIOUS_BALANCE', 'TRANSPORT', 'HOSTEL');
CREATE TYPE "FeeCollectionSchedule" AS ENUM ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'ONE_TIME');
CREATE TYPE "FeeStructureStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "StudentFeeAssignmentStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "FeeInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');
CREATE TYPE "FeePaymentMode" AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE_GATEWAY');
CREATE TYPE "FeePaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
CREATE TYPE "FeeDiscountType" AS ENUM ('SCHOLARSHIP', 'SIBLING_DISCOUNT', 'STAFF_CHILD_DISCOUNT', 'SPECIAL_DISCOUNT');
CREATE TYPE "FeeValueType" AS ENUM ('PERCENTAGE', 'FIXED');
CREATE TYPE "FeeApprovalStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE');
CREATE TYPE "FeeFineType" AS ENUM ('FIXED', 'DAILY', 'MONTHLY');
CREATE TYPE "FeeLedgerEntryType" AS ENUM ('INVOICE', 'PAYMENT', 'DISCOUNT', 'FINE', 'REFUND', 'ADJUSTMENT');
CREATE TYPE "FeeNotificationType" AS ENUM ('INVOICE_GENERATED', 'FEE_DUE_REMINDER', 'PAYMENT_SUCCESS', 'OUTSTANDING_ALERT');
CREATE TYPE "FeeNotificationChannel" AS ENUM ('SMS', 'WHATSAPP', 'EMAIL', 'IN_APP');
CREATE TYPE "FeeNotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

CREATE TABLE "fee_particulars" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "academic_session_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" "FeeParticularType" NOT NULL DEFAULT 'CHARGE',
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "is_system_generated" BOOLEAN NOT NULL DEFAULT false,
    "status" "FeeRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fee_particulars_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fee_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "academic_session_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "schedule" "FeeCollectionSchedule" NOT NULL,
    "description" TEXT,
    "status" "FeeRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fee_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fee_structures" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "academic_session_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "section_id" UUID,
    "fee_type_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "status" "FeeStructureStatus" NOT NULL DEFAULT 'ACTIVE',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fee_structures_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fee_structure_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "structure_id" UUID NOT NULL,
    "particular_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fee_structure_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_fee_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "academic_session_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "fee_structure_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StudentFeeAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "auto_assigned" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "student_fee_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fee_invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "academic_session_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "class_id" UUID,
    "section_id" UUID,
    "fee_structure_id" UUID,
    "fee_type_id" UUID,
    "invoice_number" TEXT NOT NULL,
    "fee_month" TEXT,
    "issue_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3),
    "previous_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fine_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "due_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "FeeInvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "pdf_url" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fee_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fee_invoice_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoice_id" UUID NOT NULL,
    "particular_id" UUID,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fine_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(12,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fee_invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fee_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "academic_session_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "payment_number" TEXT NOT NULL,
    "payment_mode" "FeePaymentMode" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "transaction_reference" TEXT,
    "gateway" TEXT,
    "gateway_payment_id" TEXT,
    "status" "FeePaymentStatus" NOT NULL DEFAULT 'SUCCESS',
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "collected_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fee_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fee_receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "academic_session_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "receipt_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdf_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fee_receipts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fee_discounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "academic_session_id" UUID NOT NULL,
    "student_id" UUID,
    "class_id" UUID,
    "section_id" UUID,
    "particular_id" UUID,
    "discount_type" "FeeDiscountType" NOT NULL,
    "value_type" "FeeValueType" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2),
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "approval_status" "FeeApprovalStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approved_by_id" UUID,
    "note" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fee_discounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fee_fines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "academic_session_id" UUID NOT NULL,
    "particular_id" UUID,
    "name" TEXT NOT NULL,
    "fine_type" "FeeFineType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "grace_days" INTEGER NOT NULL DEFAULT 0,
    "status" "FeeRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fee_fines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fee_ledgers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "academic_session_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "invoice_id" UUID,
    "payment_id" UUID,
    "discount_id" UUID,
    "fine_id" UUID,
    "entry_type" "FeeLedgerEntryType" NOT NULL,
    "description" TEXT NOT NULL,
    "debit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "entry_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fee_ledgers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fee_notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "academic_session_id" UUID NOT NULL,
    "student_id" UUID,
    "invoice_id" UUID,
    "type" "FeeNotificationType" NOT NULL,
    "channel" "FeeNotificationChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "status" "FeeNotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fee_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fee_particulars_school_id_academic_session_id_code_key" ON "fee_particulars"("school_id", "academic_session_id", "code");
CREATE INDEX "fee_particulars_school_id_academic_session_id_idx" ON "fee_particulars"("school_id", "academic_session_id");
CREATE INDEX "fee_particulars_status_idx" ON "fee_particulars"("status");
CREATE INDEX "fee_particulars_deleted_at_idx" ON "fee_particulars"("deleted_at");

CREATE UNIQUE INDEX "fee_types_school_id_academic_session_id_code_key" ON "fee_types"("school_id", "academic_session_id", "code");
CREATE INDEX "fee_types_school_id_academic_session_id_idx" ON "fee_types"("school_id", "academic_session_id");
CREATE INDEX "fee_types_status_idx" ON "fee_types"("status");
CREATE INDEX "fee_types_deleted_at_idx" ON "fee_types"("deleted_at");

CREATE UNIQUE INDEX "fee_structures_school_id_academic_session_id_class_id_section_id_fee_type_id_key" ON "fee_structures"("school_id", "academic_session_id", "class_id", "section_id", "fee_type_id");
CREATE INDEX "fee_structures_school_id_academic_session_id_idx" ON "fee_structures"("school_id", "academic_session_id");
CREATE INDEX "fee_structures_class_id_idx" ON "fee_structures"("class_id");
CREATE INDEX "fee_structures_section_id_idx" ON "fee_structures"("section_id");
CREATE INDEX "fee_structures_fee_type_id_idx" ON "fee_structures"("fee_type_id");
CREATE INDEX "fee_structures_deleted_at_idx" ON "fee_structures"("deleted_at");

CREATE UNIQUE INDEX "fee_structure_items_structure_id_particular_id_key" ON "fee_structure_items"("structure_id", "particular_id");
CREATE INDEX "fee_structure_items_particular_id_idx" ON "fee_structure_items"("particular_id");

CREATE UNIQUE INDEX "student_fee_assignments_student_id_fee_structure_id_key" ON "student_fee_assignments"("student_id", "fee_structure_id");
CREATE INDEX "student_fee_assignments_school_id_academic_session_id_idx" ON "student_fee_assignments"("school_id", "academic_session_id");
CREATE INDEX "student_fee_assignments_student_id_idx" ON "student_fee_assignments"("student_id");
CREATE INDEX "student_fee_assignments_fee_structure_id_idx" ON "student_fee_assignments"("fee_structure_id");
CREATE INDEX "student_fee_assignments_deleted_at_idx" ON "student_fee_assignments"("deleted_at");

CREATE UNIQUE INDEX "fee_invoices_school_id_invoice_number_key" ON "fee_invoices"("school_id", "invoice_number");
CREATE INDEX "fee_invoices_school_id_academic_session_id_idx" ON "fee_invoices"("school_id", "academic_session_id");
CREATE INDEX "fee_invoices_student_id_idx" ON "fee_invoices"("student_id");
CREATE INDEX "fee_invoices_class_id_idx" ON "fee_invoices"("class_id");
CREATE INDEX "fee_invoices_section_id_idx" ON "fee_invoices"("section_id");
CREATE INDEX "fee_invoices_status_idx" ON "fee_invoices"("status");
CREATE INDEX "fee_invoices_deleted_at_idx" ON "fee_invoices"("deleted_at");

CREATE INDEX "fee_invoice_items_invoice_id_idx" ON "fee_invoice_items"("invoice_id");
CREATE INDEX "fee_invoice_items_particular_id_idx" ON "fee_invoice_items"("particular_id");

CREATE UNIQUE INDEX "fee_payments_school_id_payment_number_key" ON "fee_payments"("school_id", "payment_number");
CREATE INDEX "fee_payments_school_id_academic_session_id_idx" ON "fee_payments"("school_id", "academic_session_id");
CREATE INDEX "fee_payments_student_id_idx" ON "fee_payments"("student_id");
CREATE INDEX "fee_payments_invoice_id_idx" ON "fee_payments"("invoice_id");
CREATE INDEX "fee_payments_status_idx" ON "fee_payments"("status");

CREATE UNIQUE INDEX "fee_receipts_payment_id_key" ON "fee_receipts"("payment_id");
CREATE UNIQUE INDEX "fee_receipts_school_id_receipt_number_key" ON "fee_receipts"("school_id", "receipt_number");
CREATE INDEX "fee_receipts_school_id_academic_session_id_idx" ON "fee_receipts"("school_id", "academic_session_id");
CREATE INDEX "fee_receipts_student_id_idx" ON "fee_receipts"("student_id");
CREATE INDEX "fee_receipts_invoice_id_idx" ON "fee_receipts"("invoice_id");

CREATE INDEX "fee_discounts_school_id_academic_session_id_idx" ON "fee_discounts"("school_id", "academic_session_id");
CREATE INDEX "fee_discounts_student_id_idx" ON "fee_discounts"("student_id");
CREATE INDEX "fee_discounts_class_id_idx" ON "fee_discounts"("class_id");
CREATE INDEX "fee_discounts_section_id_idx" ON "fee_discounts"("section_id");
CREATE INDEX "fee_discounts_approval_status_idx" ON "fee_discounts"("approval_status");
CREATE INDEX "fee_discounts_deleted_at_idx" ON "fee_discounts"("deleted_at");

CREATE INDEX "fee_fines_school_id_academic_session_id_idx" ON "fee_fines"("school_id", "academic_session_id");
CREATE INDEX "fee_fines_status_idx" ON "fee_fines"("status");
CREATE INDEX "fee_fines_deleted_at_idx" ON "fee_fines"("deleted_at");

CREATE INDEX "fee_ledgers_school_id_academic_session_id_idx" ON "fee_ledgers"("school_id", "academic_session_id");
CREATE INDEX "fee_ledgers_student_id_idx" ON "fee_ledgers"("student_id");
CREATE INDEX "fee_ledgers_invoice_id_idx" ON "fee_ledgers"("invoice_id");
CREATE INDEX "fee_ledgers_entry_date_idx" ON "fee_ledgers"("entry_date");

CREATE INDEX "fee_notifications_school_id_academic_session_id_idx" ON "fee_notifications"("school_id", "academic_session_id");
CREATE INDEX "fee_notifications_student_id_idx" ON "fee_notifications"("student_id");
CREATE INDEX "fee_notifications_invoice_id_idx" ON "fee_notifications"("invoice_id");
CREATE INDEX "fee_notifications_status_idx" ON "fee_notifications"("status");

ALTER TABLE "fee_particulars" ADD CONSTRAINT "fee_particulars_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_particulars" ADD CONSTRAINT "fee_particulars_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fee_types" ADD CONSTRAINT "fee_types_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_types" ADD CONSTRAINT "fee_types_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_fee_type_id_fkey" FOREIGN KEY ("fee_type_id") REFERENCES "fee_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fee_structure_items" ADD CONSTRAINT "fee_structure_items_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "fee_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_structure_items" ADD CONSTRAINT "fee_structure_items_particular_id_fkey" FOREIGN KEY ("particular_id") REFERENCES "fee_particulars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_fee_structure_id_fkey" FOREIGN KEY ("fee_structure_id") REFERENCES "fee_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_fee_structure_id_fkey" FOREIGN KEY ("fee_structure_id") REFERENCES "fee_structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_fee_type_id_fkey" FOREIGN KEY ("fee_type_id") REFERENCES "fee_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fee_invoice_items" ADD CONSTRAINT "fee_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "fee_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_invoice_items" ADD CONSTRAINT "fee_invoice_items_particular_id_fkey" FOREIGN KEY ("particular_id") REFERENCES "fee_particulars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "fee_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fee_receipts" ADD CONSTRAINT "fee_receipts_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_receipts" ADD CONSTRAINT "fee_receipts_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_receipts" ADD CONSTRAINT "fee_receipts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_receipts" ADD CONSTRAINT "fee_receipts_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "fee_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_receipts" ADD CONSTRAINT "fee_receipts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "fee_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fee_discounts" ADD CONSTRAINT "fee_discounts_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_discounts" ADD CONSTRAINT "fee_discounts_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_discounts" ADD CONSTRAINT "fee_discounts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_discounts" ADD CONSTRAINT "fee_discounts_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_discounts" ADD CONSTRAINT "fee_discounts_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_discounts" ADD CONSTRAINT "fee_discounts_particular_id_fkey" FOREIGN KEY ("particular_id") REFERENCES "fee_particulars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fee_fines" ADD CONSTRAINT "fee_fines_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_fines" ADD CONSTRAINT "fee_fines_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_fines" ADD CONSTRAINT "fee_fines_particular_id_fkey" FOREIGN KEY ("particular_id") REFERENCES "fee_particulars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fee_ledgers" ADD CONSTRAINT "fee_ledgers_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_ledgers" ADD CONSTRAINT "fee_ledgers_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_ledgers" ADD CONSTRAINT "fee_ledgers_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_ledgers" ADD CONSTRAINT "fee_ledgers_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "fee_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_ledgers" ADD CONSTRAINT "fee_ledgers_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "fee_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_ledgers" ADD CONSTRAINT "fee_ledgers_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "fee_discounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_ledgers" ADD CONSTRAINT "fee_ledgers_fine_id_fkey" FOREIGN KEY ("fine_id") REFERENCES "fee_fines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fee_notifications" ADD CONSTRAINT "fee_notifications_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_notifications" ADD CONSTRAINT "fee_notifications_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_notifications" ADD CONSTRAINT "fee_notifications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_notifications" ADD CONSTRAINT "fee_notifications_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "fee_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
