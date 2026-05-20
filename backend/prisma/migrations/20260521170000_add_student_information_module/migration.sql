ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "academic_session_id" UUID;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "roll_no" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "religion" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "caste" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "admission_date" TIMESTAMP(3);
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "height" DECIMAL(6,2);
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "weight" DECIMAL(6,2);
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "father_occupation" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "father_phone" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "father_photo_url" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "mother_occupation" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "mother_phone" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "mother_photo_url" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "guardian_photo_url" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "present_address" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "permanent_address" TEXT;

CREATE INDEX IF NOT EXISTS "students_academic_session_id_idx" ON "students"("academic_session_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_academic_session_id_fkey') THEN
    ALTER TABLE "students"
      ADD CONSTRAINT "students_academic_session_id_fkey"
      FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

WITH new_permissions(code, description) AS (
  VALUES
    ('student.view', 'View student information'),
    ('student.create', 'Create student admissions'),
    ('student.edit', 'Edit student information'),
    ('student.delete', 'Delete student records'),
    ('student.import', 'Bulk import students'),
    ('student.document.view', 'View student documents'),
    ('student.document.create', 'Upload student documents'),
    ('student.document.delete', 'Delete student documents'),
    ('student.timeline.view', 'View student timeline'),
    ('student.timeline.create', 'Create student timeline entries'),
    ('student.timeline.delete', 'Delete student timeline entries')
)
INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
SELECT gen_random_uuid(), code, description, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM new_permissions
ON CONFLICT ("code") DO UPDATE
SET "description" = EXCLUDED."description", "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."code" IN (
  'student.view',
  'student.create',
  'student.edit',
  'student.delete',
  'student.import',
  'student.document.view',
  'student.document.create',
  'student.document.delete',
  'student.timeline.view',
  'student.timeline.create',
  'student.timeline.delete'
)
WHERE r."name" IN ('SUPER_ADMIN', 'SCHOOL_ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO "subscription_plan_permissions" ("id", "plan_id", "permission_code", "enabled", "created_at", "updated_at")
SELECT gen_random_uuid(), sp."id", code, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "subscription_plans" sp
CROSS JOIN (
  VALUES
    ('student.view'),
    ('student.create'),
    ('student.edit'),
    ('student.delete'),
    ('student.import'),
    ('student.document.view'),
    ('student.document.create'),
    ('student.document.delete'),
    ('student.timeline.view'),
    ('student.timeline.create'),
    ('student.timeline.delete')
) AS codes(code)
ON CONFLICT ("plan_id", "permission_code") DO UPDATE
SET "enabled" = true, "updated_at" = CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "parent_guardians" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "occupation" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "photo_url" TEXT,
  "relation" TEXT,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "parent_guardians_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "student_enrollments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "academic_session_id" UUID NOT NULL,
  "class_id" UUID NOT NULL,
  "section_id" UUID NOT NULL,
  "roll_no" TEXT,
  "status" "StudentStatus" NOT NULL DEFAULT 'ENROLLED',
  "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "student_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "file_name" TEXT,
  "mime_type" TEXT,
  "size_bytes" INTEGER,
  "uploaded_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "student_timelines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "timeline_date" TIMESTAMP(3) NOT NULL,
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_timelines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "student_siblings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "sibling_student_id" UUID NOT NULL,
  "relation" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_siblings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "student_import_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "academic_session_id" UUID NOT NULL,
  "class_id" UUID NOT NULL,
  "section_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "file_name" TEXT NOT NULL,
  "status" "ImportStatus" NOT NULL DEFAULT 'COMPLETED',
  "total_rows" INTEGER NOT NULL DEFAULT 0,
  "success_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "report" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_import_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "parent_guardians_school_id_idx" ON "parent_guardians"("school_id");
CREATE INDEX IF NOT EXISTS "parent_guardians_student_id_idx" ON "parent_guardians"("student_id");
CREATE INDEX IF NOT EXISTS "parent_guardians_phone_idx" ON "parent_guardians"("phone");
CREATE INDEX IF NOT EXISTS "parent_guardians_email_idx" ON "parent_guardians"("email");

CREATE UNIQUE INDEX IF NOT EXISTS "student_enrollments_student_id_academic_session_id_key" ON "student_enrollments"("student_id", "academic_session_id");
CREATE UNIQUE INDEX IF NOT EXISTS "student_enrollments_school_id_academic_session_id_class_id_section_id_roll_no_key"
  ON "student_enrollments"("school_id", "academic_session_id", "class_id", "section_id", "roll_no");
CREATE INDEX IF NOT EXISTS "student_enrollments_school_id_idx" ON "student_enrollments"("school_id");
CREATE INDEX IF NOT EXISTS "student_enrollments_academic_session_id_idx" ON "student_enrollments"("academic_session_id");
CREATE INDEX IF NOT EXISTS "student_enrollments_class_id_idx" ON "student_enrollments"("class_id");
CREATE INDEX IF NOT EXISTS "student_enrollments_section_id_idx" ON "student_enrollments"("section_id");

CREATE INDEX IF NOT EXISTS "student_documents_school_id_idx" ON "student_documents"("school_id");
CREATE INDEX IF NOT EXISTS "student_documents_student_id_idx" ON "student_documents"("student_id");
CREATE INDEX IF NOT EXISTS "student_documents_uploaded_by_id_idx" ON "student_documents"("uploaded_by_id");

CREATE INDEX IF NOT EXISTS "student_timelines_school_id_idx" ON "student_timelines"("school_id");
CREATE INDEX IF NOT EXISTS "student_timelines_student_id_idx" ON "student_timelines"("student_id");
CREATE INDEX IF NOT EXISTS "student_timelines_created_by_id_idx" ON "student_timelines"("created_by_id");
CREATE INDEX IF NOT EXISTS "student_timelines_timeline_date_idx" ON "student_timelines"("timeline_date");

CREATE UNIQUE INDEX IF NOT EXISTS "student_siblings_student_id_sibling_student_id_key" ON "student_siblings"("student_id", "sibling_student_id");
CREATE INDEX IF NOT EXISTS "student_siblings_school_id_idx" ON "student_siblings"("school_id");
CREATE INDEX IF NOT EXISTS "student_siblings_sibling_student_id_idx" ON "student_siblings"("sibling_student_id");

CREATE INDEX IF NOT EXISTS "student_import_logs_school_id_idx" ON "student_import_logs"("school_id");
CREATE INDEX IF NOT EXISTS "student_import_logs_academic_session_id_idx" ON "student_import_logs"("academic_session_id");
CREATE INDEX IF NOT EXISTS "student_import_logs_class_id_idx" ON "student_import_logs"("class_id");
CREATE INDEX IF NOT EXISTS "student_import_logs_section_id_idx" ON "student_import_logs"("section_id");
CREATE INDEX IF NOT EXISTS "student_import_logs_created_by_id_idx" ON "student_import_logs"("created_by_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parent_guardians_school_id_fkey') THEN
    ALTER TABLE "parent_guardians" ADD CONSTRAINT "parent_guardians_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parent_guardians_student_id_fkey') THEN
    ALTER TABLE "parent_guardians" ADD CONSTRAINT "parent_guardians_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_enrollments_school_id_fkey') THEN
    ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_enrollments_student_id_fkey') THEN
    ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_enrollments_academic_session_id_fkey') THEN
    ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_enrollments_class_id_fkey') THEN
    ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_enrollments_section_id_fkey') THEN
    ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_documents_school_id_fkey') THEN
    ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_documents_student_id_fkey') THEN
    ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_documents_uploaded_by_id_fkey') THEN
    ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_timelines_school_id_fkey') THEN
    ALTER TABLE "student_timelines" ADD CONSTRAINT "student_timelines_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_timelines_student_id_fkey') THEN
    ALTER TABLE "student_timelines" ADD CONSTRAINT "student_timelines_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_timelines_created_by_id_fkey') THEN
    ALTER TABLE "student_timelines" ADD CONSTRAINT "student_timelines_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_siblings_school_id_fkey') THEN
    ALTER TABLE "student_siblings" ADD CONSTRAINT "student_siblings_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_siblings_student_id_fkey') THEN
    ALTER TABLE "student_siblings" ADD CONSTRAINT "student_siblings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_siblings_sibling_student_id_fkey') THEN
    ALTER TABLE "student_siblings" ADD CONSTRAINT "student_siblings_sibling_student_id_fkey" FOREIGN KEY ("sibling_student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_import_logs_school_id_fkey') THEN
    ALTER TABLE "student_import_logs" ADD CONSTRAINT "student_import_logs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_import_logs_academic_session_id_fkey') THEN
    ALTER TABLE "student_import_logs" ADD CONSTRAINT "student_import_logs_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_import_logs_class_id_fkey') THEN
    ALTER TABLE "student_import_logs" ADD CONSTRAINT "student_import_logs_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_import_logs_section_id_fkey') THEN
    ALTER TABLE "student_import_logs" ADD CONSTRAINT "student_import_logs_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_import_logs_created_by_id_fkey') THEN
    ALTER TABLE "student_import_logs" ADD CONSTRAINT "student_import_logs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
