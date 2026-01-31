ALTER TABLE "sections" DROP CONSTRAINT IF EXISTS "sections_academic_year_id_fkey";
ALTER TABLE "sections" DROP COLUMN IF EXISTS "academic_year_id";
DROP INDEX IF EXISTS "sections_academic_year_id_idx";

ALTER TABLE "classes"
  ADD COLUMN "academic_year_id" uuid;

ALTER TABLE "classes"
  ADD CONSTRAINT "classes_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years" ("id") ON DELETE SET NULL;

CREATE INDEX "classes_academic_year_id_idx" ON "classes" ("academic_year_id");

ALTER TABLE "subjects"
  ADD COLUMN "academic_year_id" uuid;

ALTER TABLE "subjects"
  ADD CONSTRAINT "subjects_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years" ("id") ON DELETE SET NULL;

CREATE INDEX "subjects_academic_year_id_idx" ON "subjects" ("academic_year_id");
