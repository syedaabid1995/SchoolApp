ALTER TYPE "FeeApprovalStatus" ADD VALUE IF NOT EXISTS 'DRAFT';

DO $$
BEGIN
  CREATE TYPE "FeeDiscountTargetType" AS ENUM ('STUDENT', 'CLASS', 'SECTION', 'CATEGORY', 'FEE_TYPE', 'ALL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "fee_discounts"
ADD COLUMN IF NOT EXISTS "discount_name" TEXT,
ADD COLUMN IF NOT EXISTS "target_type" "FeeDiscountTargetType" NOT NULL DEFAULT 'STUDENT',
ADD COLUMN IF NOT EXISTS "category_id" UUID,
ADD COLUMN IF NOT EXISTS "fee_type_id" UUID,
ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reason" TEXT,
ADD COLUMN IF NOT EXISTS "created_by_id" UUID,
ADD COLUMN IF NOT EXISTS "updated_by_id" UUID;

UPDATE "fee_discounts"
SET "target_type" = CASE
  WHEN "student_id" IS NOT NULL THEN 'STUDENT'::"FeeDiscountTargetType"
  WHEN "section_id" IS NOT NULL THEN 'SECTION'::"FeeDiscountTargetType"
  WHEN "class_id" IS NOT NULL THEN 'CLASS'::"FeeDiscountTargetType"
  ELSE 'ALL'::"FeeDiscountTargetType"
END
WHERE "target_type" = 'STUDENT'::"FeeDiscountTargetType";

UPDATE "fee_discounts"
SET "discount_name" = COALESCE("discount_name", REPLACE("discount_type"::TEXT, '_', ' '))
WHERE "discount_name" IS NULL;

CREATE INDEX IF NOT EXISTS "fee_discounts_category_id_idx" ON "fee_discounts"("category_id");
CREATE INDEX IF NOT EXISTS "fee_discounts_fee_type_id_idx" ON "fee_discounts"("fee_type_id");
CREATE INDEX IF NOT EXISTS "fee_discounts_target_type_idx" ON "fee_discounts"("target_type");
CREATE INDEX IF NOT EXISTS "fee_discounts_created_by_id_idx" ON "fee_discounts"("created_by_id");
CREATE INDEX IF NOT EXISTS "fee_discounts_updated_by_id_idx" ON "fee_discounts"("updated_by_id");

DO $$
BEGIN
  ALTER TABLE "fee_discounts"
    ADD CONSTRAINT "fee_discounts_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "student_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "fee_discounts"
    ADD CONSTRAINT "fee_discounts_fee_type_id_fkey"
    FOREIGN KEY ("fee_type_id") REFERENCES "fee_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
