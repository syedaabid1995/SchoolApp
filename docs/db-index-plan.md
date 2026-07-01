# Database Index Plan

Phase 2D reviewed Prisma indexes for the highest-volume Academify paths.

No Prisma migration was created in Phase 2D. The Prisma schema now declares the recommended indexes so new migrations can be generated deliberately, but existing production databases should add these indexes concurrently and out of band.

Phase 2E adds the reviewed manual rollout file at `docs/sql/production-index-rollout.sql`. Do not apply that file through Prisma migrate.

## Existing Useful Indexes

Already present before Phase 2D:

- `students(school_id)` and `students(school_id, admission_no)` unique.
- `employee_profiles(school_id)` and `employee_profiles(school_id, role_name)`.
- `attendance_sessions(school_id, date)` and several attendance identity indexes.
- `staff_attendances(school_id, attendance_date)`.
- `teacher_leave_requests(school_id, status, created_at)`.
- `leave_applications(school_id, status, applied_at)`.
- `fee_invoices(school_id, academic_session_id)`.
- `fee_payments(school_id, academic_session_id)`.
- `audit_exports(school_id)`, `audit_exports(status)`, `audit_exports(created_at)`.
- `student_documents(school_id)`, `student_documents(student_id)`.
- `homeworks(school_id)`.

## Schema Indexes Added

| Model | Index | Why |
| --- | --- | --- |
| `Student` | `[schoolId, status, createdAt]` | Student list default filter/order |
| `TeacherProfile` | `[schoolId, isActive, createdAt]` on `employee_profiles` | Staff/teacher active lists |
| `StudentParent` | `[parentId, createdAt]` | Parent portal child resolution and parent-linked lists |
| `ImportJob` | `[schoolId, createdAt]`, `[schoolId, status, createdAt]` | Import history browsing |
| `ImportRowError` | `[importJobId, rowNumber]` | Paginated import error rows |
| `Homework` | `[schoolId, homeworkDate]`, `[schoolId, createdAt]` | Homework date/list browsing |
| `Mark` | `[studentId, status, createdAt]` | Parent portal result history |
| `NotificationLog` | `[schoolId, createdAt]`, `[schoolId, status, createdAt]`, `[userId, createdAt]` | Notification log browsing |
| `AuditLog` | `[schoolId, createdAt]`, `[schoolId, entityType, createdAt]`, `[actorId, createdAt]` | Audit browsing and export filters |
| `FeeInvoice` | `[schoolId, studentId, status, issueDate]`, `[schoolId, academicSessionId, status, issueDate]` | Fee invoice lists and reports |
| `FeePayment` | `[schoolId, studentId, paidAt]`, `[schoolId, academicSessionId, status, paidAt]` | Payment lists and collection reports |

## Existing Production SQL

For an existing PostgreSQL production database, use concurrent indexes outside Prisma migrations. The canonical Phase 2E file is `docs/sql/production-index-rollout.sql`; the statements below are kept here for review context.

```sql
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
```

Do not run those statements inside a Prisma migration transaction. PostgreSQL rejects `CREATE INDEX CONCURRENTLY` inside a transaction block.

## Safe Rollout

1. Run `EXPLAIN (ANALYZE, BUFFERS)` for the highest-volume list/report queries in staging.
2. Create indexes concurrently one at a time during a low-traffic window.
3. Watch lock wait, CPU, disk IO, and query latency.
4. Run `ANALYZE` after index creation if autovacuum has not updated statistics quickly.
5. Keep the Prisma schema in sync when the next formal migration is generated.

## Deferred Indexes

Deferred until real query plans justify them:

- Additional parent-profile search indexes. Parent profiles are reached through `student_parents` and may need trigram indexes later if search becomes slow.
- Wide compound indexes on every fee filter. Existing fee indexes plus the added list/report compounds should be measured first.
- Partial indexes on active/non-deleted rows. Useful later, but they require explicit SQL and careful Prisma schema documentation.
