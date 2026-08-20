ALTER TABLE "parent_profiles"
  ADD COLUMN IF NOT EXISTS "phone_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "email_hash" TEXT;

CREATE INDEX IF NOT EXISTS "parent_profiles_phone_hash_idx"
  ON "parent_profiles"("phone_hash");

CREATE INDEX IF NOT EXISTS "parent_profiles_email_hash_idx"
  ON "parent_profiles"("email_hash");
