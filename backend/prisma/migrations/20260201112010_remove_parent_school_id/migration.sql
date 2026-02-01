-- DropForeignKey
ALTER TABLE "parent_profiles" DROP CONSTRAINT IF EXISTS "parent_profiles_school_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "parent_profiles_school_id_idx";

-- DropIndex
DROP INDEX IF EXISTS "parent_profiles_school_id_user_id_key";

-- AlterTable
ALTER TABLE "parent_profiles" DROP COLUMN "school_id";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "parent_profiles_user_id_key" ON "parent_profiles"("user_id");
