-- Add section_id to teacher_class_assignments
ALTER TABLE "teacher_class_assignments" ADD COLUMN "section_id" UUID;

-- Drop old unique index if present
DROP INDEX IF EXISTS "teacher_class_assignments_teacher_id_class_id_key";

-- Add new indexes
CREATE INDEX "teacher_class_assignments_section_id_idx" ON "teacher_class_assignments"("section_id");
CREATE UNIQUE INDEX "teacher_class_assignments_teacher_id_class_id_section_id_key" ON "teacher_class_assignments"("teacher_id", "class_id", "section_id");

-- Add foreign key for section
ALTER TABLE "teacher_class_assignments" ADD CONSTRAINT "teacher_class_assignments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
