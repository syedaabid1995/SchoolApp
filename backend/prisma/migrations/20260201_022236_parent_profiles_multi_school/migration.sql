-- Drop unique constraint on user_id to allow multiple school-scoped profiles
DROP INDEX IF EXISTS "parent_profiles_user_id_key";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'parent_profiles' AND column_name = 'school_id'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "parent_profiles_school_id_user_id_key"
    ON "parent_profiles" ("school_id", "user_id");
  END IF;
END $$;

-- Add lookup index for user_id
CREATE INDEX IF NOT EXISTS "parent_profiles_user_id_idx"
ON "parent_profiles" ("user_id");
