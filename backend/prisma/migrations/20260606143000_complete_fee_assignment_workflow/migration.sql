DO $$
BEGIN
  CREATE TYPE "FeeAssignmentTargetType" AS ENUM ('CLASS', 'SECTION', 'STUDENT', 'GROUP', 'CATEGORY', 'TRANSPORT_ROUTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "student_fee_assignments"
ADD COLUMN IF NOT EXISTS "target_type" "FeeAssignmentTargetType" NOT NULL DEFAULT 'STUDENT',
ADD COLUMN IF NOT EXISTS "class_id" UUID,
ADD COLUMN IF NOT EXISTS "section_id" UUID,
ADD COLUMN IF NOT EXISTS "group_id" UUID,
ADD COLUMN IF NOT EXISTS "category_id" UUID,
ADD COLUMN IF NOT EXISTS "transport_route_id" UUID,
ADD COLUMN IF NOT EXISTS "override_amount" DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS "start_month" TEXT NOT NULL DEFAULT 'CURRENT',
ADD COLUMN IF NOT EXISTS "end_month" TEXT,
ADD COLUMN IF NOT EXISTS "created_by_id" UUID,
ADD COLUMN IF NOT EXISTS "updated_by_id" UUID;

UPDATE "student_fee_assignments" AS sfa
SET
  "target_type" = 'STUDENT'::"FeeAssignmentTargetType",
  "class_id" = COALESCE(sfa."class_id", s."class_id"),
  "section_id" = COALESCE(sfa."section_id", s."section_id")
FROM "students" AS s
WHERE sfa."student_id" = s."id";

ALTER TABLE "student_fee_assignments" ALTER COLUMN "student_id" DROP NOT NULL;

ALTER TABLE "student_fee_assignments" DROP CONSTRAINT IF EXISTS "student_fee_assignments_student_id_fee_structure_id_key";

CREATE INDEX IF NOT EXISTS "student_fee_assignments_target_type_idx" ON "student_fee_assignments"("target_type");
CREATE INDEX IF NOT EXISTS "student_fee_assignments_class_id_idx" ON "student_fee_assignments"("class_id");
CREATE INDEX IF NOT EXISTS "student_fee_assignments_section_id_idx" ON "student_fee_assignments"("section_id");
CREATE INDEX IF NOT EXISTS "student_fee_assignments_group_id_idx" ON "student_fee_assignments"("group_id");
CREATE INDEX IF NOT EXISTS "student_fee_assignments_category_id_idx" ON "student_fee_assignments"("category_id");
CREATE INDEX IF NOT EXISTS "student_fee_assignments_transport_route_id_idx" ON "student_fee_assignments"("transport_route_id");
CREATE INDEX IF NOT EXISTS "student_fee_assignments_status_idx" ON "student_fee_assignments"("status");
CREATE INDEX IF NOT EXISTS "student_fee_assignments_start_month_idx" ON "student_fee_assignments"("start_month");
CREATE INDEX IF NOT EXISTS "student_fee_assignments_created_by_id_idx" ON "student_fee_assignments"("created_by_id");
CREATE INDEX IF NOT EXISTS "student_fee_assignments_updated_by_id_idx" ON "student_fee_assignments"("updated_by_id");

DO $$
BEGIN
  ALTER TABLE "student_fee_assignments"
    ADD CONSTRAINT "student_fee_assignments_class_id_fkey"
    FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "student_fee_assignments"
    ADD CONSTRAINT "student_fee_assignments_section_id_fkey"
    FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "student_fee_assignments"
    ADD CONSTRAINT "student_fee_assignments_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "student_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "student_fee_assignments"
    ADD CONSTRAINT "student_fee_assignments_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "student_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "student_fee_assignments"
    ADD CONSTRAINT "student_fee_assignments_transport_route_id_fkey"
    FOREIGN KEY ("transport_route_id") REFERENCES "transport_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
