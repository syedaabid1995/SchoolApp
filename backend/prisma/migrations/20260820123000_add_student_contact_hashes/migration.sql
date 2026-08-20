ALTER TABLE "students"
  ADD COLUMN "email_hash" TEXT,
  ADD COLUMN "phone_hash" TEXT,
  ADD COLUMN "father_phone_hash" TEXT,
  ADD COLUMN "mother_phone_hash" TEXT,
  ADD COLUMN "parent_phone_hash" TEXT,
  ADD COLUMN "parent_email_hash" TEXT,
  ADD COLUMN "emergency_contact_hash" TEXT,
  ADD COLUMN "doctor_contact_hash" TEXT;

CREATE INDEX "students_school_id_email_hash_idx" ON "students"("school_id", "email_hash");
CREATE INDEX "students_school_id_phone_hash_idx" ON "students"("school_id", "phone_hash");
CREATE INDEX "students_school_id_father_phone_hash_idx" ON "students"("school_id", "father_phone_hash");
CREATE INDEX "students_school_id_mother_phone_hash_idx" ON "students"("school_id", "mother_phone_hash");
CREATE INDEX "students_school_id_parent_phone_hash_idx" ON "students"("school_id", "parent_phone_hash");
CREATE INDEX "students_school_id_parent_email_hash_idx" ON "students"("school_id", "parent_email_hash");
CREATE INDEX "students_school_id_emergency_contact_hash_idx" ON "students"("school_id", "emergency_contact_hash");
CREATE INDEX "students_school_id_doctor_contact_hash_idx" ON "students"("school_id", "doctor_contact_hash");
