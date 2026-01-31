-- Drop unique constraint on user_id to allow multiple school-scoped profiles
DROP INDEX IF EXISTS "parent_profiles_user_id_key";

-- Add school-scoped uniqueness for parent profile per user
CREATE UNIQUE INDEX IF NOT EXISTS "parent_profiles_school_id_user_id_key"
ON "parent_profiles" ("school_id", "user_id");

-- Add lookup index for user_id
CREATE INDEX IF NOT EXISTS "parent_profiles_user_id_idx"
ON "parent_profiles" ("user_id");
