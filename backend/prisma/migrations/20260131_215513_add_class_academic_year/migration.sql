ALTER TABLE "classes"
  ADD COLUMN "academic_year_id" uuid;

ALTER TABLE "classes"
  ADD CONSTRAINT "classes_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years" ("id") ON DELETE SET NULL;

CREATE INDEX "classes_academic_year_id_idx" ON "classes" ("academic_year_id");
