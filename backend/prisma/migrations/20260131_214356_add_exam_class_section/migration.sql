ALTER TABLE "exams"
  ADD COLUMN "class_id" uuid,
  ADD COLUMN "section_id" uuid;

ALTER TABLE "exams"
  ADD CONSTRAINT "exams_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE SET NULL;

ALTER TABLE "exams"
  ADD CONSTRAINT "exams_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections" ("id") ON DELETE SET NULL;

CREATE INDEX "exams_class_id_idx" ON "exams" ("class_id");
CREATE INDEX "exams_section_id_idx" ON "exams" ("section_id");
