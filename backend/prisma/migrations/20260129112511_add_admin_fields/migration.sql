-- CreateEnum
CREATE TYPE "AttendanceApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "academic_years" DROP CONSTRAINT "academic_years_school_id_fkey";

-- DropForeignKey
ALTER TABLE "attendance_audits" DROP CONSTRAINT "attendance_audits_actor_id_fkey";

-- DropForeignKey
ALTER TABLE "attendance_audits" DROP CONSTRAINT "attendance_audits_record_id_fkey";

-- DropForeignKey
ALTER TABLE "attendance_evidence" DROP CONSTRAINT "attendance_evidence_record_id_fkey";

-- DropForeignKey
ALTER TABLE "attendance_periods" DROP CONSTRAINT "attendance_periods_school_id_fkey";

-- DropForeignKey
ALTER TABLE "attendance_records" DROP CONSTRAINT "attendance_records_session_id_fkey";

-- DropForeignKey
ALTER TABLE "attendance_records" DROP CONSTRAINT "attendance_records_student_id_fkey";

-- DropForeignKey
ALTER TABLE "attendance_sessions" DROP CONSTRAINT "attendance_sessions_period_id_fkey";

-- DropForeignKey
ALTER TABLE "attendance_sessions" DROP CONSTRAINT "attendance_sessions_school_id_fkey";

-- DropForeignKey
ALTER TABLE "attendance_sessions" DROP CONSTRAINT "attendance_sessions_started_by_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actor_id_fkey";

-- DropForeignKey
ALTER TABLE "backup_jobs" DROP CONSTRAINT "backup_jobs_requested_by_id_fkey";

-- DropForeignKey
ALTER TABLE "backup_jobs" DROP CONSTRAINT "backup_jobs_school_id_fkey";

-- DropForeignKey
ALTER TABLE "classes" DROP CONSTRAINT "classes_school_id_fkey";

-- DropForeignKey
ALTER TABLE "consent_records" DROP CONSTRAINT "consent_records_document_id_fkey";

-- DropForeignKey
ALTER TABLE "consent_records" DROP CONSTRAINT "consent_records_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "consent_records" DROP CONSTRAINT "consent_records_school_id_fkey";

-- DropForeignKey
ALTER TABLE "data_deletion_jobs" DROP CONSTRAINT "data_deletion_jobs_approved_by_id_fkey";

-- DropForeignKey
ALTER TABLE "data_deletion_jobs" DROP CONSTRAINT "data_deletion_jobs_requested_by_id_fkey";

-- DropForeignKey
ALTER TABLE "data_deletion_jobs" DROP CONSTRAINT "data_deletion_jobs_school_id_fkey";

-- DropForeignKey
ALTER TABLE "data_export_jobs" DROP CONSTRAINT "data_export_jobs_requested_by_id_fkey";

-- DropForeignKey
ALTER TABLE "data_export_jobs" DROP CONSTRAINT "data_export_jobs_school_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_papers" DROP CONSTRAINT "exam_papers_class_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_papers" DROP CONSTRAINT "exam_papers_exam_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_papers" DROP CONSTRAINT "exam_papers_subject_id_fkey";

-- DropForeignKey
ALTER TABLE "exams" DROP CONSTRAINT "exams_academic_year_id_fkey";

-- DropForeignKey
ALTER TABLE "exams" DROP CONSTRAINT "exams_school_id_fkey";

-- DropForeignKey
ALTER TABLE "exams" DROP CONSTRAINT "exams_term_id_fkey";

-- DropForeignKey
ALTER TABLE "face_profiles" DROP CONSTRAINT "face_profiles_approved_by_id_fkey";

-- DropForeignKey
ALTER TABLE "face_profiles" DROP CONSTRAINT "face_profiles_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "face_profiles" DROP CONSTRAINT "face_profiles_school_id_fkey";

-- DropForeignKey
ALTER TABLE "face_profiles" DROP CONSTRAINT "face_profiles_student_id_fkey";

-- DropForeignKey
ALTER TABLE "face_samples" DROP CONSTRAINT "face_samples_face_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "feature_flag_overrides" DROP CONSTRAINT "feature_flag_overrides_flag_id_fkey";

-- DropForeignKey
ALTER TABLE "feature_flag_overrides" DROP CONSTRAINT "feature_flag_overrides_school_id_fkey";

-- DropForeignKey
ALTER TABLE "feature_flag_overrides" DROP CONSTRAINT "feature_flag_overrides_user_id_fkey";

-- DropForeignKey
ALTER TABLE "import_jobs" DROP CONSTRAINT "import_jobs_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "import_jobs" DROP CONSTRAINT "import_jobs_school_id_fkey";

-- DropForeignKey
ALTER TABLE "import_row_errors" DROP CONSTRAINT "import_row_errors_import_job_id_fkey";

-- DropForeignKey
ALTER TABLE "mark_moderations" DROP CONSTRAINT "mark_moderations_approved_by_id_fkey";

-- DropForeignKey
ALTER TABLE "mark_moderations" DROP CONSTRAINT "mark_moderations_mark_id_fkey";

-- DropForeignKey
ALTER TABLE "mark_revaluations" DROP CONSTRAINT "mark_revaluations_mark_id_fkey";

-- DropForeignKey
ALTER TABLE "mark_revaluations" DROP CONSTRAINT "mark_revaluations_requested_by_id_fkey";

-- DropForeignKey
ALTER TABLE "marks" DROP CONSTRAINT "marks_exam_paper_id_fkey";

-- DropForeignKey
ALTER TABLE "marks" DROP CONSTRAINT "marks_student_id_fkey";

-- DropForeignKey
ALTER TABLE "notification_logs" DROP CONSTRAINT "notification_logs_school_id_fkey";

-- DropForeignKey
ALTER TABLE "notification_logs" DROP CONSTRAINT "notification_logs_template_id_fkey";

-- DropForeignKey
ALTER TABLE "notification_logs" DROP CONSTRAINT "notification_logs_user_id_fkey";

-- DropForeignKey
ALTER TABLE "otp_codes" DROP CONSTRAINT "otp_codes_school_id_fkey";

-- DropForeignKey
ALTER TABLE "parent_profiles" DROP CONSTRAINT "parent_profiles_school_id_fkey";

-- DropForeignKey
ALTER TABLE "parent_profiles" DROP CONSTRAINT "parent_profiles_user_id_fkey";

-- DropForeignKey
ALTER TABLE "restore_jobs" DROP CONSTRAINT "restore_jobs_approved_by_id_fkey";

-- DropForeignKey
ALTER TABLE "restore_jobs" DROP CONSTRAINT "restore_jobs_backup_id_fkey";

-- DropForeignKey
ALTER TABLE "restore_jobs" DROP CONSTRAINT "restore_jobs_requested_by_id_fkey";

-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_role_id_fkey";

-- DropForeignKey
ALTER TABLE "sections" DROP CONSTRAINT "sections_class_id_fkey";

-- DropForeignKey
ALTER TABLE "student_parents" DROP CONSTRAINT "student_parents_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "student_parents" DROP CONSTRAINT "student_parents_student_id_fkey";

-- DropForeignKey
ALTER TABLE "student_status_history" DROP CONSTRAINT "student_status_history_student_id_fkey";

-- DropForeignKey
ALTER TABLE "students" DROP CONSTRAINT "students_school_id_fkey";

-- DropForeignKey
ALTER TABLE "subjects" DROP CONSTRAINT "subjects_school_id_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_school_id_fkey";

-- DropForeignKey
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_school_id_fkey";

-- DropForeignKey
ALTER TABLE "teacher_class_assignments" DROP CONSTRAINT "teacher_class_assignments_class_id_fkey";

-- DropForeignKey
ALTER TABLE "teacher_class_assignments" DROP CONSTRAINT "teacher_class_assignments_teacher_id_fkey";

-- DropForeignKey
ALTER TABLE "teacher_profiles" DROP CONSTRAINT "teacher_profiles_school_id_fkey";

-- DropForeignKey
ALTER TABLE "teacher_profiles" DROP CONSTRAINT "teacher_profiles_user_id_fkey";

-- DropForeignKey
ALTER TABLE "teacher_subject_assignments" DROP CONSTRAINT "teacher_subject_assignments_subject_id_fkey";

-- DropForeignKey
ALTER TABLE "teacher_subject_assignments" DROP CONSTRAINT "teacher_subject_assignments_teacher_id_fkey";

-- DropForeignKey
ALTER TABLE "tenant_config_overrides" DROP CONSTRAINT "tenant_config_overrides_config_id_fkey";

-- DropForeignKey
ALTER TABLE "tenant_config_overrides" DROP CONSTRAINT "tenant_config_overrides_school_id_fkey";

-- DropForeignKey
ALTER TABLE "terms" DROP CONSTRAINT "terms_academic_year_id_fkey";

-- DropForeignKey
ALTER TABLE "theme_history" DROP CONSTRAINT "theme_history_theme_id_fkey";

-- DropForeignKey
ALTER TABLE "themes" DROP CONSTRAINT "themes_school_id_fkey";

-- DropForeignKey
ALTER TABLE "usage_counters" DROP CONSTRAINT "usage_counters_school_id_fkey";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_role_id_fkey";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_user_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_school_id_fkey";

-- AlterTable
ALTER TABLE "academic_years" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "start_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "end_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "attendance_audits" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "attendance_evidence" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "attendance_periods" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "attendance_records" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "captured_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "attendance_sessions" ADD COLUMN     "approval_reason" TEXT,
ADD COLUMN     "approval_status" "AttendanceApprovalStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "backup_jobs" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "started_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "finished_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "classes" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "config_entries" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "consent_documents" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "consent_records" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "granted_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "withdrawn_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "data_deletion_jobs" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "scheduled_for" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "started_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "finished_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "data_export_jobs" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "started_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "finished_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "exam_papers" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "exams" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "scheduled_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "face_profiles" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "approved_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "face_samples" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "feature_flag_overrides" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "feature_flags" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "import_jobs" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "started_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "finished_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "import_row_errors" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "mark_moderations" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "mark_revaluations" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "marks" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notification_logs" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "sent_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notification_templates" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "otp_codes" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "verified_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "parent_profiles" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "permissions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "restore_jobs" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "started_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "finished_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "role_permissions" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "active_users_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "last_login_at" TIMESTAMP(3),
ADD COLUMN     "status_reason" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sections" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "student_parents" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "student_status_history" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "changed_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "class_id" UUID,
ADD COLUMN     "section_id" UUID,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "dob" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subjects" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subscriptions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "starts_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "ends_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "support_tickets" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "sla_due_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "teacher_class_assignments" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "teacher_profiles" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "teacher_subject_assignments" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenant_config_overrides" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "terms" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "start_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "end_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "theme_history" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "themes" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "usage_counters" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user_roles" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "students_class_id_idx" ON "students"("class_id");

-- CreateIndex
CREATE INDEX "students_section_id_idx" ON "students"("section_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms" ADD CONSTRAINT "terms_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_profiles" ADD CONSTRAINT "parent_profiles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_profiles" ADD CONSTRAINT "parent_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_class_assignments" ADD CONSTRAINT "teacher_class_assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_class_assignments" ADD CONSTRAINT "teacher_class_assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_subject_assignments" ADD CONSTRAINT "teacher_subject_assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_subject_assignments" ADD CONSTRAINT "teacher_subject_assignments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_parents" ADD CONSTRAINT "student_parents_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_parents" ADD CONSTRAINT "student_parents_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_status_history" ADD CONSTRAINT "student_status_history_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_row_errors" ADD CONSTRAINT "import_row_errors_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_profiles" ADD CONSTRAINT "face_profiles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_profiles" ADD CONSTRAINT "face_profiles_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_profiles" ADD CONSTRAINT "face_profiles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_profiles" ADD CONSTRAINT "face_profiles_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_samples" ADD CONSTRAINT "face_samples_face_profile_id_fkey" FOREIGN KEY ("face_profile_id") REFERENCES "face_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_periods" ADD CONSTRAINT "attendance_periods_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "attendance_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_started_by_id_fkey" FOREIGN KEY ("started_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_audits" ADD CONSTRAINT "attendance_audits_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_audits" ADD CONSTRAINT "attendance_audits_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_evidence" ADD CONSTRAINT "attendance_evidence_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_papers" ADD CONSTRAINT "exam_papers_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_papers" ADD CONSTRAINT "exam_papers_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_papers" ADD CONSTRAINT "exam_papers_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks" ADD CONSTRAINT "marks_exam_paper_id_fkey" FOREIGN KEY ("exam_paper_id") REFERENCES "exam_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks" ADD CONSTRAINT "marks_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_moderations" ADD CONSTRAINT "mark_moderations_mark_id_fkey" FOREIGN KEY ("mark_id") REFERENCES "marks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_moderations" ADD CONSTRAINT "mark_moderations_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_revaluations" ADD CONSTRAINT "mark_revaluations_mark_id_fkey" FOREIGN KEY ("mark_id") REFERENCES "marks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_revaluations" ADD CONSTRAINT "mark_revaluations_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "themes" ADD CONSTRAINT "themes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "theme_history" ADD CONSTRAINT "theme_history_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flag_overrides" ADD CONSTRAINT "feature_flag_overrides_flag_id_fkey" FOREIGN KEY ("flag_id") REFERENCES "feature_flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flag_overrides" ADD CONSTRAINT "feature_flag_overrides_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flag_overrides" ADD CONSTRAINT "feature_flag_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_config_overrides" ADD CONSTRAINT "tenant_config_overrides_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "config_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_config_overrides" ADD CONSTRAINT "tenant_config_overrides_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restore_jobs" ADD CONSTRAINT "restore_jobs_backup_id_fkey" FOREIGN KEY ("backup_id") REFERENCES "backup_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restore_jobs" ADD CONSTRAINT "restore_jobs_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restore_jobs" ADD CONSTRAINT "restore_jobs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "consent_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_export_jobs" ADD CONSTRAINT "data_export_jobs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_export_jobs" ADD CONSTRAINT "data_export_jobs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_deletion_jobs" ADD CONSTRAINT "data_deletion_jobs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_deletion_jobs" ADD CONSTRAINT "data_deletion_jobs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_deletion_jobs" ADD CONSTRAINT "data_deletion_jobs_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
