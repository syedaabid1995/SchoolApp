DO $$ BEGIN
  CREATE TYPE "LeaveApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "leave_types" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "total_days" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "leave_types_school_id_name_key" ON "leave_types"("school_id", "name");
CREATE INDEX IF NOT EXISTS "leave_types_school_id_idx" ON "leave_types"("school_id");

DO $$ BEGIN
  ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "leave_defines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "role_name" "RoleName" NOT NULL,
  "leave_type_id" UUID NOT NULL,
  "days" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leave_defines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "leave_defines_school_id_role_name_leave_type_id_key" ON "leave_defines"("school_id", "role_name", "leave_type_id");
CREATE INDEX IF NOT EXISTS "leave_defines_school_id_role_name_idx" ON "leave_defines"("school_id", "role_name");
CREATE INDEX IF NOT EXISTS "leave_defines_leave_type_id_idx" ON "leave_defines"("leave_type_id");

DO $$ BEGIN
  ALTER TABLE "leave_defines" ADD CONSTRAINT "leave_defines_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_defines" ADD CONSTRAINT "leave_defines_leave_type_id_fkey"
    FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "leave_applications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "staff_id" UUID NOT NULL,
  "leave_type_id" UUID NOT NULL,
  "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "from_date" TIMESTAMP(3) NOT NULL,
  "to_date" TIMESTAMP(3) NOT NULL,
  "duration_days" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "LeaveApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "review_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leave_applications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "leave_applications_school_id_status_applied_at_idx" ON "leave_applications"("school_id", "status", "applied_at");
CREATE INDEX IF NOT EXISTS "leave_applications_staff_id_status_from_date_idx" ON "leave_applications"("staff_id", "status", "from_date");
CREATE INDEX IF NOT EXISTS "leave_applications_leave_type_id_idx" ON "leave_applications"("leave_type_id");

DO $$ BEGIN
  ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_leave_type_id_fkey"
    FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "leave_attachments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "leave_application_id" UUID NOT NULL,
  "file_url" TEXT NOT NULL,
  "file_name" TEXT,
  "file_type" TEXT,
  "size_bytes" INTEGER,
  "uploaded_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leave_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "leave_attachments_leave_application_id_idx" ON "leave_attachments"("leave_application_id");
CREATE INDEX IF NOT EXISTS "leave_attachments_uploaded_by_id_idx" ON "leave_attachments"("uploaded_by_id");

DO $$ BEGIN
  ALTER TABLE "leave_attachments" ADD CONSTRAINT "leave_attachments_leave_application_id_fkey"
    FOREIGN KEY ("leave_application_id") REFERENCES "leave_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_attachments" ADD CONSTRAINT "leave_attachments_uploaded_by_id_fkey"
    FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "leave_balances" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "staff_id" UUID NOT NULL,
  "leave_type_id" UUID NOT NULL,
  "total_days" INTEGER NOT NULL,
  "used_days" INTEGER NOT NULL DEFAULT 0,
  "extra_taken_days" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "leave_balances_school_id_staff_id_leave_type_id_key" ON "leave_balances"("school_id", "staff_id", "leave_type_id");
CREATE INDEX IF NOT EXISTS "leave_balances_school_id_staff_id_idx" ON "leave_balances"("school_id", "staff_id");
CREATE INDEX IF NOT EXISTS "leave_balances_leave_type_id_idx" ON "leave_balances"("leave_type_id");

DO $$ BEGIN
  ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_fkey"
    FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "leave_status_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "leave_application_id" UUID NOT NULL,
  "from_status" "LeaveApplicationStatus",
  "to_status" "LeaveApplicationStatus" NOT NULL,
  "note" TEXT,
  "changed_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leave_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "leave_status_history_school_id_idx" ON "leave_status_history"("school_id");
CREATE INDEX IF NOT EXISTS "leave_status_history_leave_application_id_idx" ON "leave_status_history"("leave_application_id");
CREATE INDEX IF NOT EXISTS "leave_status_history_changed_by_id_idx" ON "leave_status_history"("changed_by_id");

DO $$ BEGIN
  ALTER TABLE "leave_status_history" ADD CONSTRAINT "leave_status_history_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_status_history" ADD CONSTRAINT "leave_status_history_leave_application_id_fkey"
    FOREIGN KEY ("leave_application_id") REFERENCES "leave_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_status_history" ADD CONSTRAINT "leave_status_history_changed_by_id_fkey"
    FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
