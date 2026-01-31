ALTER TABLE "subjects"
  ADD COLUMN "class_id" uuid;

ALTER TABLE "subjects"
  ADD CONSTRAINT "subjects_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE SET NULL;

CREATE INDEX "subjects_class_id_idx" ON "subjects" ("class_id");
