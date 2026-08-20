ALTER TABLE "employee_profiles"
  ADD COLUMN "phone_hash" TEXT,
  ADD COLUMN "emergency_mobile_hash" TEXT;

CREATE INDEX "employee_profiles_school_id_phone_hash_idx" ON "employee_profiles"("school_id", "phone_hash");
CREATE INDEX "employee_profiles_school_id_emergency_mobile_hash_idx" ON "employee_profiles"("school_id", "emergency_mobile_hash");
