DROP INDEX IF EXISTS "subjects_school_id_name_key";
CREATE UNIQUE INDEX "subjects_school_id_name_class_id_academic_year_id_key"
  ON "subjects" ("school_id", "name", "class_id", "academic_year_id");
