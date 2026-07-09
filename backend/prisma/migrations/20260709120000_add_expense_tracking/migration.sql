CREATE TYPE "ExpensePaymentMode" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'UPI', 'CARD', 'OTHER');
CREATE TYPE "ExpenseChangeRequestType" AS ENUM ('UPDATE', 'DELETE');
CREATE TYPE "ExpenseChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "expense_categories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "normalized_name" TEXT NOT NULL,
  "description" TEXT,
  "status" "FeeRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expenses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "expense_date" TIMESTAMP(3) NOT NULL,
  "payment_mode" "ExpensePaymentMode" NOT NULL,
  "paid_to" TEXT,
  "reference_number" TEXT,
  "description" TEXT,
  "receipt_url" TEXT,
  "receipt_key" TEXT,
  "receipt_file_name" TEXT,
  "receipt_content_type" TEXT,
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "deleted_at" TIMESTAMP(3),
  "deleted_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expense_change_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "expense_id" UUID NOT NULL,
  "request_type" "ExpenseChangeRequestType" NOT NULL,
  "proposed_data" JSONB,
  "reason" TEXT,
  "status" "ExpenseChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requested_by_id" UUID,
  "reviewed_by_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "review_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "expense_change_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "unique_expense_category_normalized_name" ON "expense_categories"("school_id", "normalized_name");
CREATE INDEX "expense_categories_school_id_idx" ON "expense_categories"("school_id");
CREATE INDEX "expense_categories_status_idx" ON "expense_categories"("status");
CREATE INDEX "expense_categories_deleted_at_idx" ON "expense_categories"("deleted_at");

CREATE INDEX "expenses_school_id_expense_date_idx" ON "expenses"("school_id", "expense_date");
CREATE INDEX "expenses_category_id_idx" ON "expenses"("category_id");
CREATE INDEX "expenses_payment_mode_idx" ON "expenses"("payment_mode");
CREATE INDEX "expenses_created_by_id_idx" ON "expenses"("created_by_id");
CREATE INDEX "expenses_deleted_at_idx" ON "expenses"("deleted_at");

CREATE INDEX "expense_change_requests_school_id_status_idx" ON "expense_change_requests"("school_id", "status");
CREATE INDEX "expense_change_requests_expense_id_idx" ON "expense_change_requests"("expense_id");
CREATE INDEX "expense_change_requests_requested_by_id_idx" ON "expense_change_requests"("requested_by_id");
CREATE INDEX "expense_change_requests_reviewed_by_id_idx" ON "expense_change_requests"("reviewed_by_id");

ALTER TABLE "expense_categories"
  ADD CONSTRAINT "expense_categories_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expense_change_requests"
  ADD CONSTRAINT "expense_change_requests_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "expense_change_requests"
  ADD CONSTRAINT "expense_change_requests_expense_id_fkey"
  FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

WITH expense_permissions(code, description) AS (
  VALUES
    ('expenses.view', 'View school expenses'),
    ('expenses.create', 'Create school expenses'),
    ('expenses.edit', 'Edit school expenses or request edits'),
    ('expenses.delete', 'Delete school expenses or request deletion'),
    ('expenses.approve', 'Approve expense edit and delete requests'),
    ('expenses.categories.view', 'View expense categories'),
    ('expenses.categories.create', 'Create expense categories'),
    ('expenses.categories.edit', 'Edit expense categories'),
    ('expenses.categories.delete', 'Delete expense categories'),
    ('expenses.reports.view', 'View expense reports'),
    ('expenses.reports.export', 'Export expense reports')
)
INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
SELECT gen_random_uuid(), code, description, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM expense_permissions
ON CONFLICT ("code") DO UPDATE
SET "description" = EXCLUDED."description",
    "updated_at" = CURRENT_TIMESTAMP;

WITH expense_permissions(code) AS (
  VALUES
    ('expenses.view'),
    ('expenses.create'),
    ('expenses.edit'),
    ('expenses.delete'),
    ('expenses.approve'),
    ('expenses.categories.view'),
    ('expenses.categories.create'),
    ('expenses.categories.edit'),
    ('expenses.categories.delete'),
    ('expenses.reports.view'),
    ('expenses.reports.export')
)
INSERT INTO "subscription_plan_permissions" ("id", "plan_id", "permission_code", "enabled", "created_at", "updated_at")
SELECT gen_random_uuid(), plans."id", expense_permissions.code, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "subscription_plans" plans
CROSS JOIN expense_permissions
ON CONFLICT ("plan_id", "permission_code") DO UPDATE
SET "enabled" = true,
    "updated_at" = CURRENT_TIMESTAMP;

WITH expense_permissions(code) AS (
  VALUES
    ('expenses.view'),
    ('expenses.create'),
    ('expenses.edit'),
    ('expenses.delete'),
    ('expenses.approve'),
    ('expenses.categories.view'),
    ('expenses.categories.create'),
    ('expenses.categories.edit'),
    ('expenses.categories.delete'),
    ('expenses.reports.view'),
    ('expenses.reports.export')
)
INSERT INTO "employee_role_permissions" ("id", "school_id", "role_name", "permission_code", "enabled", "created_at", "updated_at")
SELECT gen_random_uuid(), schools."id", 'SCHOOL_ADMIN'::"RoleName", expense_permissions.code, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "schools" schools
CROSS JOIN expense_permissions
ON CONFLICT ("school_id", "role_name", "permission_code") DO UPDATE
SET "enabled" = true,
    "updated_at" = CURRENT_TIMESTAMP;

WITH accountant_permissions(code) AS (
  VALUES
    ('expenses.view'),
    ('expenses.create'),
    ('expenses.edit'),
    ('expenses.delete'),
    ('expenses.categories.view'),
    ('expenses.categories.create'),
    ('expenses.categories.edit'),
    ('expenses.categories.delete'),
    ('expenses.reports.view'),
    ('expenses.reports.export')
)
INSERT INTO "employee_role_permissions" ("id", "school_id", "role_name", "permission_code", "enabled", "created_at", "updated_at")
SELECT gen_random_uuid(), schools."id", 'ACCOUNTANT'::"RoleName", accountant_permissions.code, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "schools" schools
CROSS JOIN accountant_permissions
ON CONFLICT ("school_id", "role_name", "permission_code") DO UPDATE
SET "enabled" = true,
    "updated_at" = CURRENT_TIMESTAMP;

WITH default_categories(name, normalized_name, sort_order) AS (
  VALUES
    ('Salary', 'salary', 10),
    ('Transport', 'transport', 20),
    ('Maintenance', 'maintenance', 30),
    ('Utilities', 'utilities', 40),
    ('Stationery', 'stationery', 50),
    ('Rent', 'rent', 60),
    ('Events', 'events', 70),
    ('Exam', 'exam', 80),
    ('Library', 'library', 90),
    ('Other', 'other', 100)
)
INSERT INTO "expense_categories" ("id", "school_id", "name", "normalized_name", "status", "is_default", "sort_order", "created_at", "updated_at")
SELECT gen_random_uuid(), schools."id", default_categories.name, default_categories.normalized_name, 'ACTIVE'::"FeeRecordStatus", true, default_categories.sort_order, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "schools" schools
CROSS JOIN default_categories
ON CONFLICT ("school_id", "normalized_name") DO NOTHING;
