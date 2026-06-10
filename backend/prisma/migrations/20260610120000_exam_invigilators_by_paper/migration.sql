ALTER TABLE "exam_invigilator_assignments"
  ADD COLUMN "exam_paper_id" UUID;

UPDATE "exam_invigilator_assignments" assignment
SET "exam_paper_id" = paper."id"
FROM "exam_papers" paper
WHERE paper."exam_id" = assignment."exam_id"
  AND (
    SELECT COUNT(*)
    FROM "exam_papers" paper_count
    WHERE paper_count."exam_id" = assignment."exam_id"
  ) = 1;

DROP INDEX IF EXISTS "exam_invigilator_assignments_exam_id_teacher_id_key";
DROP INDEX IF EXISTS "exam_invigilator_assignments_exam_id_room_id_key";

CREATE UNIQUE INDEX "exam_invigilator_assignments_exam_paper_id_teacher_id_key"
  ON "exam_invigilator_assignments"("exam_paper_id", "teacher_id");

CREATE UNIQUE INDEX "exam_invigilator_assignments_exam_paper_id_room_id_key"
  ON "exam_invigilator_assignments"("exam_paper_id", "room_id");

CREATE INDEX "exam_invigilator_assignments_exam_paper_id_idx"
  ON "exam_invigilator_assignments"("exam_paper_id");

ALTER TABLE "exam_invigilator_assignments"
  ADD CONSTRAINT "exam_invigilator_assignments_exam_paper_id_fkey"
  FOREIGN KEY ("exam_paper_id") REFERENCES "exam_papers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
