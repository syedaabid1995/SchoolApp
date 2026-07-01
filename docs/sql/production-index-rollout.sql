/*
  Academify Phase 2E production index rollout.

  Run this file manually against an existing PostgreSQL database after staging
  validation. Do not run it through Prisma migrate: CREATE INDEX CONCURRENTLY
  cannot run inside Prisma's transaction wrapper.

  Guidance:
  - Run one statement at a time during a low-traffic window.
  - Watch pg_stat_activity, lock waits, CPU, disk IO, and application latency.
  - Run EXPLAIN (ANALYZE, BUFFERS) for the affected list/report queries before
    and after rollout.
  - Run ANALYZE on touched tables if autovacuum does not refresh statistics.
  - Roll back only when needed using DROP INDEX CONCURRENTLY IF EXISTS.

  Nothing in this file should be applied automatically by CI.
*/

CREATE INDEX CONCURRENTLY IF NOT EXISTS "students_school_id_status_created_at_idx"
  ON "students"("school_id", "status", "created_at");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "employee_profiles_school_id_is_active_created_at_idx"
  ON "employee_profiles"("school_id", "is_active", "created_at");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "student_parents_parent_id_created_at_idx"
  ON "student_parents"("parent_id", "created_at");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "import_jobs_school_id_created_at_idx"
  ON "import_jobs"("school_id", "created_at");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "import_jobs_school_id_status_created_at_idx"
  ON "import_jobs"("school_id", "status", "created_at");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "import_row_errors_import_job_id_row_number_idx"
  ON "import_row_errors"("import_job_id", "row_number");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "homeworks_school_id_homework_date_idx"
  ON "homeworks"("school_id", "homework_date");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "homeworks_school_id_created_at_idx"
  ON "homeworks"("school_id", "created_at");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "marks_student_id_status_created_at_idx"
  ON "marks"("student_id", "status", "created_at");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "notification_logs_school_id_created_at_idx"
  ON "notification_logs"("school_id", "created_at");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "notification_logs_school_id_status_created_at_idx"
  ON "notification_logs"("school_id", "status", "created_at");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "notification_logs_user_id_created_at_idx"
  ON "notification_logs"("user_id", "created_at");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_logs_school_id_created_at_idx"
  ON "audit_logs"("school_id", "created_at");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_logs_school_id_entity_type_created_at_idx"
  ON "audit_logs"("school_id", "entity_type", "created_at");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_logs_actor_id_created_at_idx"
  ON "audit_logs"("actor_id", "created_at");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "fee_invoices_school_id_student_id_status_issue_date_idx"
  ON "fee_invoices"("school_id", "student_id", "status", "issue_date");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "fee_invoices_school_id_academic_session_id_status_issue_date_idx"
  ON "fee_invoices"("school_id", "academic_session_id", "status", "issue_date");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "fee_payments_school_id_student_id_paid_at_idx"
  ON "fee_payments"("school_id", "student_id", "paid_at");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "fee_payments_school_id_academic_session_id_status_paid_at_idx"
  ON "fee_payments"("school_id", "academic_session_id", "status", "paid_at");

/*
  Optional rollback examples. Run only if a specific index causes a verified
  issue and after checking no query currently depends on it:

  DROP INDEX CONCURRENTLY IF EXISTS "students_school_id_status_created_at_idx";
  DROP INDEX CONCURRENTLY IF EXISTS "employee_profiles_school_id_is_active_created_at_idx";
*/
