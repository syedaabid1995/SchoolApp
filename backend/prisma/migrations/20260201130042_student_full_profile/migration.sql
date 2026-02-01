-- AlterTable
ALTER TABLE "students" ADD COLUMN "address_line1" TEXT;
ALTER TABLE "students" ADD COLUMN "address_line2" TEXT;
ALTER TABLE "students" ADD COLUMN "allergies" TEXT;
ALTER TABLE "students" ADD COLUMN "blood_group" TEXT;
ALTER TABLE "students" ADD COLUMN "city" TEXT;
ALTER TABLE "students" ADD COLUMN "doc_aadhaar" TEXT;
ALTER TABLE "students" ADD COLUMN "doc_birth_cert" TEXT;
ALTER TABLE "students" ADD COLUMN "doc_report_card" TEXT;
ALTER TABLE "students" ADD COLUMN "doc_transfer_cert" TEXT;
ALTER TABLE "students" ADD COLUMN "doctor_contact" TEXT;
ALTER TABLE "students" ADD COLUMN "emergency_contact" TEXT;
ALTER TABLE "students" ADD COLUMN "father_name" TEXT;
ALTER TABLE "students" ADD COLUMN "full_name" TEXT;
ALTER TABLE "students" ADD COLUMN "gender" TEXT;
ALTER TABLE "students" ADD COLUMN "guardian_name" TEXT;
ALTER TABLE "students" ADD COLUMN "guardian_relationship" TEXT;
ALTER TABLE "students" ADD COLUMN "medical_conditions" TEXT;
ALTER TABLE "students" ADD COLUMN "mother_name" TEXT;
ALTER TABLE "students" ADD COLUMN "parent_email" TEXT;
ALTER TABLE "students" ADD COLUMN "parent_phone" TEXT;
ALTER TABLE "students" ADD COLUMN "photo_url" TEXT;
ALTER TABLE "students" ADD COLUMN "pincode" TEXT;
ALTER TABLE "students" ADD COLUMN "state" TEXT;

-- Backfill full_name for existing rows
UPDATE "students"
SET "full_name" = NULLIF(TRIM(COALESCE("first_name", '') || ' ' || COALESCE("last_name", '')), '');

-- Ensure full_name has a value
UPDATE "students"
SET "full_name" = COALESCE("full_name", "first_name", "last_name", "admission_no", 'Student');

-- Enforce not null
ALTER TABLE "students" ALTER COLUMN "full_name" SET NOT NULL;
