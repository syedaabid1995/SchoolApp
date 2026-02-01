-- DropForeignKey
ALTER TABLE "parent_profiles" DROP CONSTRAINT "parent_profiles_school_id_fkey";

-- DropIndex
DROP INDEX "parent_profiles_school_id_idx";

-- DropIndex
DROP INDEX "parent_profiles_school_id_user_id_key";

-- AlterTable
ALTER TABLE "parent_profiles" DROP COLUMN "school_id";

-- CreateIndex
CREATE UNIQUE INDEX "parent_profiles_user_id_key" ON "parent_profiles"("user_id");
