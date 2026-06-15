-- CreateEnum
CREATE TYPE "FeeFineRuleType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'CUMULATIVE');

-- CreateEnum
CREATE TYPE "FeeAssignmentSource" AS ENUM ('ADMISSION', 'MANUAL', 'PROMOTION', 'TRANSPORT');

-- CreateEnum
CREATE TYPE "FeeCarryForwardStatus" AS ENUM ('PENDING', 'GENERATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FeeInvoiceGenerationJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FeePaymentStatus" ADD VALUE 'PARTIALLY_REVERSED';
ALTER TYPE "FeePaymentStatus" ADD VALUE 'REVERSED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FeeDiscountTargetType" ADD VALUE 'FEE_GROUP';
ALTER TYPE "FeeDiscountTargetType" ADD VALUE 'FEE_MASTER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FeeLedgerEntryType" ADD VALUE 'PAYMENT_REVERSAL';
ALTER TYPE "FeeLedgerEntryType" ADD VALUE 'CARRY_FORWARD_DEBIT';

-- AlterEnum
ALTER TYPE "NumberSequenceType" ADD VALUE 'REVERSAL';

-- AlterTable
ALTER TABLE "fee_invoices" ADD COLUMN     "fee_group_id" UUID;

-- AlterTable
ALTER TABLE "fee_invoice_items" ADD COLUMN     "fee_master_id" UUID;

-- AlterTable
ALTER TABLE "fee_discounts" ADD COLUMN     "code" TEXT,
ADD COLUMN     "deleted_by_id" UUID,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "expiry_date" TIMESTAMP(3),
ADD COLUMN     "fee_group_id" UUID,
ADD COLUMN     "fee_master_id" UUID;

-- AlterTable
ALTER TABLE "fee_ledgers" ADD COLUMN     "carry_forward_id" UUID,
ADD COLUMN     "payment_reversal_id" UUID;

-- CreateTable
CREATE TABLE "fee_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "academic_session_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "description" TEXT,
    "status" "FeeRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_masters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "academic_session_id" UUID NOT NULL,
    "fee_group_id" UUID NOT NULL,
    "fee_type_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "due_date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "is_legacy" BOOLEAN NOT NULL DEFAULT false,
    "legacy_structure_id" UUID,
    "status" "FeeRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_fine_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "academic_session_id" UUID NOT NULL,
    "fee_master_id" UUID NOT NULL,
    "fine_type" "FeeFineRuleType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "days_from" INTEGER NOT NULL,
    "days_to" INTEGER,
    "status" "FeeRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_fine_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_fee_group_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "academic_session_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "fee_group_id" UUID NOT NULL,
    "source" "FeeAssignmentSource" NOT NULL DEFAULT 'MANUAL',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StudentFeeAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_by_id" UUID,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_fee_group_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_discount_installments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "academic_session_id" UUID NOT NULL,
    "discount_id" UUID NOT NULL,
    "fee_master_id" UUID NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_discount_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_payment_reversals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "academic_session_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "reversal_number" TEXT NOT NULL,
    "reversed_amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "reversed_by_id" UUID NOT NULL,
    "reversed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_payment_reversals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_carry_forwards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "from_academic_session_id" UUID NOT NULL,
    "to_academic_session_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "generated_invoice_id" UUID,
    "status" "FeeCarryForwardStatus" NOT NULL DEFAULT 'PENDING',
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_carry_forwards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_carry_forward_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "carry_forward_id" UUID NOT NULL,
    "source_invoice_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_carry_forward_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_invoice_generation_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "academic_session_id" UUID NOT NULL,
    "student_id" UUID,
    "source" "FeeAssignmentSource" NOT NULL,
    "status" "FeeInvoiceGenerationJobStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_invoice_generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fee_groups_school_id_academic_session_id_idx" ON "fee_groups"("school_id", "academic_session_id");

-- CreateIndex
CREATE INDEX "fee_groups_status_idx" ON "fee_groups"("status");

-- CreateIndex
CREATE INDEX "fee_groups_deleted_at_idx" ON "fee_groups"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "fee_groups_school_id_academic_session_id_normalized_name_key" ON "fee_groups"("school_id", "academic_session_id", "normalized_name");

-- CreateIndex
CREATE INDEX "fee_masters_school_id_academic_session_id_idx" ON "fee_masters"("school_id", "academic_session_id");

-- CreateIndex
CREATE INDEX "fee_masters_fee_group_id_idx" ON "fee_masters"("fee_group_id");

-- CreateIndex
CREATE INDEX "fee_masters_fee_type_id_idx" ON "fee_masters"("fee_type_id");

-- CreateIndex
CREATE INDEX "fee_masters_due_date_idx" ON "fee_masters"("due_date");

-- CreateIndex
CREATE INDEX "fee_masters_effective_from_effective_to_idx" ON "fee_masters"("effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "fee_masters_legacy_structure_id_idx" ON "fee_masters"("legacy_structure_id");

-- CreateIndex
CREATE INDEX "fee_masters_status_idx" ON "fee_masters"("status");

-- CreateIndex
CREATE INDEX "fee_masters_deleted_at_idx" ON "fee_masters"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "fee_masters_school_id_academic_session_id_fee_group_id_code_key" ON "fee_masters"("school_id", "academic_session_id", "fee_group_id", "code");

-- CreateIndex
CREATE INDEX "fee_fine_rules_school_id_academic_session_id_idx" ON "fee_fine_rules"("school_id", "academic_session_id");

-- CreateIndex
CREATE INDEX "fee_fine_rules_fee_master_id_idx" ON "fee_fine_rules"("fee_master_id");

-- CreateIndex
CREATE INDEX "fee_fine_rules_fine_type_idx" ON "fee_fine_rules"("fine_type");

-- CreateIndex
CREATE INDEX "fee_fine_rules_days_from_days_to_idx" ON "fee_fine_rules"("days_from", "days_to");

-- CreateIndex
CREATE INDEX "fee_fine_rules_status_idx" ON "fee_fine_rules"("status");

-- CreateIndex
CREATE INDEX "fee_fine_rules_deleted_at_idx" ON "fee_fine_rules"("deleted_at");

-- CreateIndex
CREATE INDEX "student_fee_group_assignments_school_id_academic_session_id_idx" ON "student_fee_group_assignments"("school_id", "academic_session_id");

-- CreateIndex
CREATE INDEX "student_fee_group_assignments_student_id_idx" ON "student_fee_group_assignments"("student_id");

-- CreateIndex
CREATE INDEX "student_fee_group_assignments_fee_group_id_idx" ON "student_fee_group_assignments"("fee_group_id");

-- CreateIndex
CREATE INDEX "student_fee_group_assignments_source_idx" ON "student_fee_group_assignments"("source");

-- CreateIndex
CREATE INDEX "student_fee_group_assignments_status_idx" ON "student_fee_group_assignments"("status");

-- CreateIndex
CREATE INDEX "student_fee_group_assignments_deleted_at_idx" ON "student_fee_group_assignments"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "student_fee_group_assignments_active_unique" ON "student_fee_group_assignments"("school_id", "academic_session_id", "student_id", "fee_group_id") WHERE "deleted_at" IS NULL;

-- CreateIndex
CREATE INDEX "fee_discount_installments_school_id_academic_session_id_idx" ON "fee_discount_installments"("school_id", "academic_session_id");

-- CreateIndex
CREATE INDEX "fee_discount_installments_discount_id_idx" ON "fee_discount_installments"("discount_id");

-- CreateIndex
CREATE INDEX "fee_discount_installments_fee_master_id_idx" ON "fee_discount_installments"("fee_master_id");

-- CreateIndex
CREATE INDEX "fee_discount_installments_deleted_at_idx" ON "fee_discount_installments"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "fee_discount_installments_active_unique" ON "fee_discount_installments"("discount_id", "fee_master_id") WHERE "deleted_at" IS NULL;

-- CreateIndex
CREATE INDEX "fee_payment_reversals_school_id_academic_session_id_idx" ON "fee_payment_reversals"("school_id", "academic_session_id");

-- CreateIndex
CREATE INDEX "fee_payment_reversals_payment_id_idx" ON "fee_payment_reversals"("payment_id");

-- CreateIndex
CREATE INDEX "fee_payment_reversals_student_id_idx" ON "fee_payment_reversals"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "fee_payment_reversals_school_id_reversal_number_key" ON "fee_payment_reversals"("school_id", "reversal_number");

-- CreateIndex
CREATE INDEX "fee_carry_forwards_school_id_idx" ON "fee_carry_forwards"("school_id");

-- CreateIndex
CREATE INDEX "fee_carry_forwards_from_academic_session_id_idx" ON "fee_carry_forwards"("from_academic_session_id");

-- CreateIndex
CREATE INDEX "fee_carry_forwards_to_academic_session_id_idx" ON "fee_carry_forwards"("to_academic_session_id");

-- CreateIndex
CREATE INDEX "fee_carry_forwards_student_id_idx" ON "fee_carry_forwards"("student_id");

-- CreateIndex
CREATE INDEX "fee_carry_forwards_generated_invoice_id_idx" ON "fee_carry_forwards"("generated_invoice_id");

-- CreateIndex
CREATE INDEX "fee_carry_forwards_status_idx" ON "fee_carry_forwards"("status");

-- CreateIndex
CREATE INDEX "fee_carry_forward_items_carry_forward_id_idx" ON "fee_carry_forward_items"("carry_forward_id");

-- CreateIndex
CREATE INDEX "fee_carry_forward_items_source_invoice_id_idx" ON "fee_carry_forward_items"("source_invoice_id");

-- CreateIndex
CREATE INDEX "fee_invoice_generation_jobs_school_id_academic_session_id_idx" ON "fee_invoice_generation_jobs"("school_id", "academic_session_id");

-- CreateIndex
CREATE INDEX "fee_invoice_generation_jobs_student_id_idx" ON "fee_invoice_generation_jobs"("student_id");

-- CreateIndex
CREATE INDEX "fee_invoice_generation_jobs_source_idx" ON "fee_invoice_generation_jobs"("source");

-- CreateIndex
CREATE INDEX "fee_invoice_generation_jobs_status_idx" ON "fee_invoice_generation_jobs"("status");

-- CreateIndex
CREATE INDEX "fee_invoices_fee_group_id_idx" ON "fee_invoices"("fee_group_id");

-- CreateIndex
CREATE INDEX "fee_invoice_items_fee_master_id_idx" ON "fee_invoice_items"("fee_master_id");

-- CreateIndex
CREATE INDEX "fee_discounts_fee_group_id_idx" ON "fee_discounts"("fee_group_id");

-- CreateIndex
CREATE INDEX "fee_discounts_fee_master_id_idx" ON "fee_discounts"("fee_master_id");

-- CreateIndex
CREATE INDEX "fee_ledgers_payment_reversal_id_idx" ON "fee_ledgers"("payment_reversal_id");

-- CreateIndex
CREATE INDEX "fee_ledgers_carry_forward_id_idx" ON "fee_ledgers"("carry_forward_id");

-- AddForeignKey
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_fee_group_id_fkey" FOREIGN KEY ("fee_group_id") REFERENCES "fee_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_invoice_items" ADD CONSTRAINT "fee_invoice_items_fee_master_id_fkey" FOREIGN KEY ("fee_master_id") REFERENCES "fee_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_discounts" ADD CONSTRAINT "fee_discounts_fee_group_id_fkey" FOREIGN KEY ("fee_group_id") REFERENCES "fee_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_discounts" ADD CONSTRAINT "fee_discounts_fee_master_id_fkey" FOREIGN KEY ("fee_master_id") REFERENCES "fee_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_groups" ADD CONSTRAINT "fee_groups_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_groups" ADD CONSTRAINT "fee_groups_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_masters" ADD CONSTRAINT "fee_masters_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_masters" ADD CONSTRAINT "fee_masters_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_masters" ADD CONSTRAINT "fee_masters_fee_group_id_fkey" FOREIGN KEY ("fee_group_id") REFERENCES "fee_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_masters" ADD CONSTRAINT "fee_masters_fee_type_id_fkey" FOREIGN KEY ("fee_type_id") REFERENCES "fee_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_masters" ADD CONSTRAINT "fee_masters_legacy_structure_id_fkey" FOREIGN KEY ("legacy_structure_id") REFERENCES "fee_structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_fine_rules" ADD CONSTRAINT "fee_fine_rules_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_fine_rules" ADD CONSTRAINT "fee_fine_rules_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_fine_rules" ADD CONSTRAINT "fee_fine_rules_fee_master_id_fkey" FOREIGN KEY ("fee_master_id") REFERENCES "fee_masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_group_assignments" ADD CONSTRAINT "student_fee_group_assignments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_group_assignments" ADD CONSTRAINT "student_fee_group_assignments_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_group_assignments" ADD CONSTRAINT "student_fee_group_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_group_assignments" ADD CONSTRAINT "student_fee_group_assignments_fee_group_id_fkey" FOREIGN KEY ("fee_group_id") REFERENCES "fee_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_discount_installments" ADD CONSTRAINT "fee_discount_installments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_discount_installments" ADD CONSTRAINT "fee_discount_installments_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_discount_installments" ADD CONSTRAINT "fee_discount_installments_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "fee_discounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_discount_installments" ADD CONSTRAINT "fee_discount_installments_fee_master_id_fkey" FOREIGN KEY ("fee_master_id") REFERENCES "fee_masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_ledgers" ADD CONSTRAINT "fee_ledgers_payment_reversal_id_fkey" FOREIGN KEY ("payment_reversal_id") REFERENCES "fee_payment_reversals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_ledgers" ADD CONSTRAINT "fee_ledgers_carry_forward_id_fkey" FOREIGN KEY ("carry_forward_id") REFERENCES "fee_carry_forwards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payment_reversals" ADD CONSTRAINT "fee_payment_reversals_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payment_reversals" ADD CONSTRAINT "fee_payment_reversals_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payment_reversals" ADD CONSTRAINT "fee_payment_reversals_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "fee_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payment_reversals" ADD CONSTRAINT "fee_payment_reversals_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_carry_forwards" ADD CONSTRAINT "fee_carry_forwards_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_carry_forwards" ADD CONSTRAINT "fee_carry_forwards_from_academic_session_id_fkey" FOREIGN KEY ("from_academic_session_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_carry_forwards" ADD CONSTRAINT "fee_carry_forwards_to_academic_session_id_fkey" FOREIGN KEY ("to_academic_session_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_carry_forwards" ADD CONSTRAINT "fee_carry_forwards_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_carry_forwards" ADD CONSTRAINT "fee_carry_forwards_generated_invoice_id_fkey" FOREIGN KEY ("generated_invoice_id") REFERENCES "fee_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_carry_forward_items" ADD CONSTRAINT "fee_carry_forward_items_carry_forward_id_fkey" FOREIGN KEY ("carry_forward_id") REFERENCES "fee_carry_forwards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_carry_forward_items" ADD CONSTRAINT "fee_carry_forward_items_source_invoice_id_fkey" FOREIGN KEY ("source_invoice_id") REFERENCES "fee_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_invoice_generation_jobs" ADD CONSTRAINT "fee_invoice_generation_jobs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_invoice_generation_jobs" ADD CONSTRAINT "fee_invoice_generation_jobs_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_invoice_generation_jobs" ADD CONSTRAINT "fee_invoice_generation_jobs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
