ALTER TABLE "classes" DROP CONSTRAINT IF EXISTS "classes_academic_year_id_fkey";
ALTER TABLE "classes" DROP COLUMN IF EXISTS "academic_year_id";
DROP INDEX IF EXISTS "classes_academic_year_id_idx";

ALTER TABLE "sections"
  ADD COLUMN "academic_year_id" uuid;

ALTER TABLE "sections"
  ADD CONSTRAINT "sections_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years" ("id") ON DELETE SET NULL;

CREATE INDEX "sections_academic_year_id_idx" ON "sections" ("academic_year_id");
