-- CreateTable
CREATE TABLE "teacher_attendance_substitutions" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "section_id" UUID,
    "date" TIMESTAMP(3) NOT NULL,
    "original_teacher_id" UUID,
    "substitute_teacher_id" UUID NOT NULL,
    "reason" TEXT,
    "created_by_id" UUID NOT NULL,
    "canceled_at" TIMESTAMP(3),
    "canceled_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_attendance_substitutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teacher_attendance_substitutions_school_id_date_idx" ON "teacher_attendance_substitutions"("school_id", "date");

-- CreateIndex
CREATE INDEX "teacher_attendance_substitutions_school_id_class_id_section_idx" ON "teacher_attendance_substitutions"("school_id", "class_id", "section_id", "date");

-- CreateIndex
CREATE INDEX "teacher_attendance_substitutions_substitute_teacher_id_date_idx" ON "teacher_attendance_substitutions"("substitute_teacher_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_attendance_substitutions_school_id_academic_year_id_key" ON "teacher_attendance_substitutions"("school_id", "academic_year_id", "class_id", "section_id", "date");

-- AddForeignKey
ALTER TABLE "teacher_attendance_substitutions" ADD CONSTRAINT "teacher_attendance_substitutions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_attendance_substitutions" ADD CONSTRAINT "teacher_attendance_substitutions_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_attendance_substitutions" ADD CONSTRAINT "teacher_attendance_substitutions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_attendance_substitutions" ADD CONSTRAINT "teacher_attendance_substitutions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_attendance_substitutions" ADD CONSTRAINT "teacher_attendance_substitutions_original_teacher_id_fkey" FOREIGN KEY ("original_teacher_id") REFERENCES "teacher_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_attendance_substitutions" ADD CONSTRAINT "teacher_attendance_substitutions_substitute_teacher_id_fkey" FOREIGN KEY ("substitute_teacher_id") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_attendance_substitutions" ADD CONSTRAINT "teacher_attendance_substitutions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_attendance_substitutions" ADD CONSTRAINT "teacher_attendance_substitutions_canceled_by_id_fkey" FOREIGN KEY ("canceled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed permission for substitution management
INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'attendance.substitute.manage', 'Manage temporary attendance substitutions', NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, NOW()
FROM "roles" r
JOIN "permissions" p ON p.code = 'attendance.substitute.manage'
WHERE r.name IN ('SCHOOL_ADMIN')
ON CONFLICT DO NOTHING;
