ALTER TABLE "parent_guardians"
  ADD COLUMN IF NOT EXISTS "phone_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "email_hash" TEXT;

CREATE INDEX IF NOT EXISTS "parent_guardians_school_id_phone_hash_idx"
  ON "parent_guardians"("school_id", "phone_hash");

CREATE INDEX IF NOT EXISTS "parent_guardians_school_id_email_hash_idx"
  ON "parent_guardians"("school_id", "email_hash");
