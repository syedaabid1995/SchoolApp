DO $$ BEGIN
  CREATE TYPE "StaffAttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'HOLIDAY', 'HALF_DAY', 'LEAVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PayrollStatus" AS ENUM ('GENERATED', 'PAID', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PayrollPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "departments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "departments_school_id_name_key" ON "departments"("school_id", "name");
CREATE INDEX IF NOT EXISTS "departments_school_id_idx" ON "departments"("school_id");

DO $$ BEGIN
  ALTER TABLE "departments" ADD CONSTRAINT "departments_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "designations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "designations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "designations_school_id_name_key" ON "designations"("school_id", "name");
CREATE INDEX IF NOT EXISTS "designations_school_id_idx" ON "designations"("school_id");

DO $$ BEGIN
  ALTER TABLE "designations" ADD CONSTRAINT "designations_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "employee_profiles"
  ADD COLUMN IF NOT EXISTS "role_name" "RoleName" NOT NULL DEFAULT 'TEACHER',
  ADD COLUMN IF NOT EXISTS "department_id" UUID,
  ADD COLUMN IF NOT EXISTS "designation_id" UUID,
  ADD COLUMN IF NOT EXISTS "father_name" TEXT,
  ADD COLUMN IF NOT EXISTS "mother_name" TEXT,
  ADD COLUMN IF NOT EXISTS "gender" TEXT,
  ADD COLUMN IF NOT EXISTS "date_of_birth" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "date_of_joining" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "emergency_mobile" TEXT,
  ADD COLUMN IF NOT EXISTS "photo_url" TEXT,
  ADD COLUMN IF NOT EXISTS "driving_license" TEXT,
  ADD COLUMN IF NOT EXISTS "current_address" TEXT,
  ADD COLUMN IF NOT EXISTS "permanent_address" TEXT,
  ADD COLUMN IF NOT EXISTS "qualifications" TEXT,
  ADD COLUMN IF NOT EXISTS "experience" TEXT,
  ADD COLUMN IF NOT EXISTS "marital_status" TEXT;

CREATE INDEX IF NOT EXISTS "employee_profiles_school_id_role_name_idx" ON "employee_profiles"("school_id", "role_name");
CREATE INDEX IF NOT EXISTS "employee_profiles_department_id_idx" ON "employee_profiles"("department_id");
CREATE INDEX IF NOT EXISTS "employee_profiles_designation_id_idx" ON "employee_profiles"("designation_id");

DO $$ BEGIN
  ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_designation_id_fkey"
    FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "staff_payroll_info" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "staff_id" UUID NOT NULL,
  "epf_no" TEXT,
  "basic_salary" DECIMAL(12,2),
  "contract_type" TEXT,
  "payment_mode" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_payroll_info_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "staff_payroll_info_staff_id_key" ON "staff_payroll_info"("staff_id");
CREATE INDEX IF NOT EXISTS "staff_payroll_info_staff_id_idx" ON "staff_payroll_info"("staff_id");

DO $$ BEGIN
  ALTER TABLE "staff_payroll_info" ADD CONSTRAINT "staff_payroll_info_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "staff_social_links" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "staff_id" UUID NOT NULL,
  "platform" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_social_links_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "staff_social_links_staff_id_idx" ON "staff_social_links"("staff_id");

DO $$ BEGIN
  ALTER TABLE "staff_social_links" ADD CONSTRAINT "staff_social_links_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "staff_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "staff_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "file_url" TEXT NOT NULL,
  "file_name" TEXT,
  "file_type" TEXT,
  "uploaded_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "staff_documents_school_id_idx" ON "staff_documents"("school_id");
CREATE INDEX IF NOT EXISTS "staff_documents_staff_id_idx" ON "staff_documents"("staff_id");
CREATE INDEX IF NOT EXISTS "staff_documents_uploaded_by_id_idx" ON "staff_documents"("uploaded_by_id");

DO $$ BEGIN
  ALTER TABLE "staff_documents" ADD CONSTRAINT "staff_documents_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_documents" ADD CONSTRAINT "staff_documents_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_documents" ADD CONSTRAINT "staff_documents_uploaded_by_id_fkey"
    FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "staff_timelines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "staff_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "timeline_at" TIMESTAMP(3) NOT NULL,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_timelines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "staff_timelines_school_id_idx" ON "staff_timelines"("school_id");
CREATE INDEX IF NOT EXISTS "staff_timelines_staff_id_idx" ON "staff_timelines"("staff_id");
CREATE INDEX IF NOT EXISTS "staff_timelines_created_by_id_idx" ON "staff_timelines"("created_by_id");

DO $$ BEGIN
  ALTER TABLE "staff_timelines" ADD CONSTRAINT "staff_timelines_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_timelines" ADD CONSTRAINT "staff_timelines_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_timelines" ADD CONSTRAINT "staff_timelines_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "staff_attendances" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "staff_id" UUID NOT NULL,
  "attendance_date" TIMESTAMP(3) NOT NULL,
  "status" "StaffAttendanceStatus" NOT NULL,
  "note" TEXT,
  "marked_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_attendances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "staff_attendances_school_id_staff_id_attendance_date_key" ON "staff_attendances"("school_id", "staff_id", "attendance_date");
CREATE INDEX IF NOT EXISTS "staff_attendances_school_id_attendance_date_idx" ON "staff_attendances"("school_id", "attendance_date");
CREATE INDEX IF NOT EXISTS "staff_attendances_staff_id_attendance_date_idx" ON "staff_attendances"("staff_id", "attendance_date");

DO $$ BEGIN
  ALTER TABLE "staff_attendances" ADD CONSTRAINT "staff_attendances_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_attendances" ADD CONSTRAINT "staff_attendances_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_attendances" ADD CONSTRAINT "staff_attendances_marked_by_id_fkey"
    FOREIGN KEY ("marked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "staff_attendance_holidays" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "role_name" "RoleName",
  "holiday_date" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_attendance_holidays_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "staff_attendance_holidays_school_id_role_name_holiday_date_key" ON "staff_attendance_holidays"("school_id", "role_name", "holiday_date");
CREATE INDEX IF NOT EXISTS "staff_attendance_holidays_school_id_holiday_date_idx" ON "staff_attendance_holidays"("school_id", "holiday_date");

DO $$ BEGIN
  ALTER TABLE "staff_attendance_holidays" ADD CONSTRAINT "staff_attendance_holidays_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_attendance_holidays" ADD CONSTRAINT "staff_attendance_holidays_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "payrolls" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "staff_id" UUID NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "payslip_no" TEXT NOT NULL,
  "basic_salary" DECIMAL(12,2) NOT NULL,
  "earnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "gross_salary" DECIMAL(12,2) NOT NULL,
  "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "net_salary" DECIMAL(12,2) NOT NULL,
  "payment_mode" TEXT,
  "status" "PayrollStatus" NOT NULL DEFAULT 'GENERATED',
  "generated_by_id" UUID NOT NULL,
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payrolls_school_id_staff_id_month_year_key" ON "payrolls"("school_id", "staff_id", "month", "year");
CREATE UNIQUE INDEX IF NOT EXISTS "payrolls_school_id_payslip_no_key" ON "payrolls"("school_id", "payslip_no");
CREATE INDEX IF NOT EXISTS "payrolls_school_id_month_year_idx" ON "payrolls"("school_id", "month", "year");
CREATE INDEX IF NOT EXISTS "payrolls_staff_id_idx" ON "payrolls"("staff_id");

DO $$ BEGIN
  ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_generated_by_id_fkey"
    FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "payroll_earnings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payroll_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_earnings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payroll_earnings_payroll_id_idx" ON "payroll_earnings"("payroll_id");

DO $$ BEGIN
  ALTER TABLE "payroll_earnings" ADD CONSTRAINT "payroll_earnings_payroll_id_fkey"
    FOREIGN KEY ("payroll_id") REFERENCES "payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "payroll_deductions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payroll_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_deductions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payroll_deductions_payroll_id_idx" ON "payroll_deductions"("payroll_id");

DO $$ BEGIN
  ALTER TABLE "payroll_deductions" ADD CONSTRAINT "payroll_deductions_payroll_id_fkey"
    FOREIGN KEY ("payroll_id") REFERENCES "payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "payroll_payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "payroll_id" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "method" TEXT,
  "reference" TEXT,
  "status" "PayrollPaymentStatus" NOT NULL DEFAULT 'PAID',
  "paid_at" TIMESTAMP(3) NOT NULL,
  "recorded_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payroll_payments_school_id_idx" ON "payroll_payments"("school_id");
CREATE INDEX IF NOT EXISTS "payroll_payments_payroll_id_idx" ON "payroll_payments"("payroll_id");
CREATE INDEX IF NOT EXISTS "payroll_payments_recorded_by_id_idx" ON "payroll_payments"("recorded_by_id");

DO $$ BEGIN
  ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_payroll_id_fkey"
    FOREIGN KEY ("payroll_id") REFERENCES "payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_recorded_by_id_fkey"
    FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
