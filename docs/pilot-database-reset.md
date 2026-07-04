# Academify Pilot Database Reset

This document explains how to reuse the current AWS Lightsail PostgreSQL database and AWS S3 bucket for a Hostinger KVM-2 pitch/pilot deployment while clearing only demo/test application data.

The reset process preserves the database schema and Prisma migration history. It does not delete S3 objects.

## When To Use This Reset

Use this reset only when all of these are true:

- The target database contains only test/demo data.
- You want a clean tenant/application state before pitching or limited pilot usage.
- You want to keep the current database instance, schema, indexes, and Prisma migration history.
- A fresh backup has been created and a restore drill has been verified against a disposable database.
- An operator has reviewed the target database host/name and confirmed it is not a real production tenant database.

## When Not To Use This Reset

Do not use this reset when:

- The database contains real student, parent, teacher, staff, payment, attendance, or school production data.
- You are not sure which database `DATABASE_URL` points to.
- A backup has not been taken and restore-tested.
- You need to roll back schema changes. This reset does not manage schema rollback.
- You intend to delete S3 objects automatically. This reset intentionally does not do that.
- You only need to disable a default super-admin. Use `remediate:default-super-admin` instead.

Never run:

```sh
npx prisma migrate reset
npx prisma db push
```

against the pilot database.

## Required Backup Before Reset

Create a PostgreSQL backup first:

```sh
NODE_ENV=production \
DATABASE_URL='postgresql://<db_user>:<db_password>@<lightsail-postgres-host>:5432/<db_name>?sslmode=require' \
BACKUP_DIR=/private/backups/academify \
scripts/backup-postgres.sh --allow-production
```

Restore that backup to a disposable database before applying the reset:

```sh
RESTORE_TARGET_CLASS=staging \
RESTORE_DATABASE_URL='postgresql://<restore_user>:<restore_password>@<restore-host>:5432/<restore_db>?sslmode=require' \
scripts/restore-postgres-drill.sh \
  --backup-file /private/backups/academify/<backup-file>.dump \
  --apply
```

Verify basic counts on the disposable restore:

```sql
SELECT COUNT(*) FROM schools;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM students;
SELECT COUNT(*) FROM attendance_sessions;
SELECT COUNT(*) FROM fee_invoices;
```

## Tables Preserved

The reset script always preserves `_prisma_migrations`.

It also preserves these global/baseline tables:

| Table | Why preserved |
| --- | --- |
| `_prisma_migrations` | Prisma uses this to know which migrations have been applied. Deleting it breaks migration history. |
| `roles` | Global role names are baseline authorization data. |
| `permissions` | Global permission catalog is baseline authorization data. |
| `role_permissions` | Global role-to-permission mapping is baseline authorization data. |
| `subscription_plans` | Platform plan definitions can be reused for the pilot. |
| `subscription_plan_permissions` | Plan permission mapping can be reused for the pilot. |
| `feature_flags` | Global feature definitions can be reused. |
| `config_entries` | Global config definitions can be reused. |
| `messaging_services` | Global provider definitions can be reused after review. |
| `consent_documents` | Global consent document versions can be reused after review. |

Review the preserved baseline tables after reset. If any preserved rows are demo-specific, update them manually through a reviewed script or admin workflow.

## Tables Cleared

The script derives application table names from `backend/prisma/schema.prisma` and clears all Prisma model tables except the preserved baseline list above.

The cleared set includes:

- Tenant root data: `schools`, `users`, `user_roles`.
- Authentication/session data: `refresh_sessions`, `password_reset_tokens`, `mfa_challenges`, `totp_credentials`, `totp_backup_codes`, `otp_codes`.
- Tenant permissions/config: `employee_role_permissions`, `employee_user_permissions`, `tenant_config_overrides`, `school_system_settings`, `school_messaging_configs`.
- Academic setup: academic years, terms, classes, sections, subjects, rooms, assignments, class teachers, timetable versions and entries.
- Student/parent data: students, parents, enrollments, student documents, photos, timelines, siblings, transfer requests, groups, categories, promotions, disabled logs.
- Staff/teacher data: employee profiles, onboarding, departments, designations, staff documents, payroll, leave, staff attendance, teacher assignments.
- Attendance data: attendance configurations, slots, periods, sessions, records, audits, evidence, self attendance, holidays, substitutions.
- Exam/results data: exams, exam types, grading settings, papers, centers, rooms, seating, invigilators, marks, moderation, revaluation.
- Fees/subscriptions usage data: fee masters, invoices, payments, receipts, ledgers, discounts, fines, carry forwards, generation jobs, notifications, tenant subscriptions, invoices, payments, usage counters.
- Operational data: imports, import row errors, notification logs, backup/restore jobs, audit logs, audit exports, data export/deletion jobs, compliance histories, support tickets/comments.
- Communication data: notification templates and school notices.
- Other school modules: homework, library, transport, dormitory, themes/history, AI conversations/messages/pending actions, face profiles/samples.

Because this list is generated from the Prisma schema, new future Prisma model tables are cleared by default unless they are added to the preserved baseline list in `backend/scripts/pilot-reset.ts`.

## Why `_prisma_migrations` Must Be Preserved

`_prisma_migrations` records which Prisma migrations have already been applied. Preserving it means:

- `npx prisma migrate deploy` can continue safely.
- The database schema remains aligned with the repo migration history.
- The reset does not pretend the database is empty or unmanaged.

Deleting or modifying `_prisma_migrations` can make Prisma reapply old migrations, skip required migrations, or fail future deployments.

## How To Run Dry-Run

Dry-run is the default. It counts rows and prints the planned clear/preserve table sets. It does not delete rows.

For a local/test/staging database:

```sh
npm --prefix backend run pilot:reset -- --dry-run
```

For a production-mode pilot database, dry-run still requires the explicit pilot reset acknowledgement:

```sh
NODE_ENV=production \
npm --prefix backend run pilot:reset -- --dry-run --allow-pilot-reset
```

The script prints only masked target information: database host, port, database name, and SSL mode. It does not print credentials.

## How To Run Apply

Apply is destructive. Run it only after backup, restore drill, dry-run review, and operator approval. The script requires `--confirm-dry-run-reviewed` so the apply command explicitly acknowledges that dry-run output was reviewed first.

```sh
NODE_ENV=production \
npm --prefix backend run pilot:reset -- --apply --allow-pilot-reset --confirm-dry-run-reviewed
```

To create a clean global super-admin during apply:

```sh
NODE_ENV=production \
PILOT_SUPER_ADMIN_EMAIL='admin@yourdomain.com' \
PILOT_SUPER_ADMIN_PASSWORD='<strong-reviewed-temporary-password>' \
npm --prefix backend run pilot:reset -- --apply --allow-pilot-reset --confirm-dry-run-reviewed --create-clean-admin
```

The script does not print the password. The created admin is marked `mustChangePassword=true`.

## How To Verify After Reset

Run database checks:

```sql
SELECT COUNT(*) FROM schools;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM user_roles;
SELECT COUNT(*) FROM students;
SELECT COUNT(*) FROM attendance_sessions;
SELECT COUNT(*) FROM fee_invoices;
SELECT COUNT(*) FROM audit_logs;
SELECT COUNT(*) FROM _prisma_migrations;
```

Expected after reset without `--create-clean-admin`:

- Application/tenant tables should be `0`.
- Preserved baseline tables should still contain expected rows.
- `_prisma_migrations` should still contain migration rows.

Expected after reset with `--create-clean-admin`:

- `users` should contain the clean super-admin.
- `user_roles` should contain that super-admin role assignment.
- School/tenant tables should remain empty.

Run app checks:

```sh
cd backend
npx prisma validate
npm run build
```

Then start the API and verify:

```sh
curl -fsS https://api.yourdomain.com/health
```

## Creating A Clean Pilot Admin

Preferred flow:

1. Run the reset without creating a school.
2. Create a clean global super-admin using `--create-clean-admin`, or create one through a reviewed admin-maintenance workflow.
3. Log in as the super-admin.
4. Create the first pilot school through the admin UI/API.
5. Create the first school admin through the admin UI/API.
6. Confirm the school admin must change password and can complete onboarding.

If creating the clean super-admin with the script, use a temporary strong password passed through environment variables only on the server. Do not commit or paste the password.

## S3 Cleanup Guidance

The current storage layer does not support a global `S3_PREFIX` or `STORAGE_PREFIX` setting. Runtime object keys are tenant-scoped or platform-scoped:

```text
schools/{schoolId}/uploads/{yyyy}/{mm}/{uuid}.{ext}
schools/{schoolId}/homework/{yyyy}/{mm}/{uuid}.{ext}
schools/{schoolId}/imports/{yyyy}/{mm}/{uuid}.{ext}
schools/{schoolId}/exports/{yyyy}/{mm}/{uuid}.{ext}
schools/{schoolId}/audit-exports/{yyyy}/{mm}/{uuid}.{ext}
schools/{schoolId}/backups/{yyyy}/{mm}/{uuid}.dump
platform/audit-exports/{yyyy}/{mm}/{uuid}.{ext}
```

Safe bucket reuse approach:

- Reuse the same private S3 bucket.
- Do not delete old test objects automatically.
- After database reset, create new pilot schools with new school IDs. New uploads will use new `schools/{newSchoolId}/...` prefixes.
- Old demo objects under old `schools/{oldSchoolId}/...` prefixes will be orphaned from the reset database and should remain untouched until manually reviewed.
- Keep bucket versioning enabled if possible.
- If manual cleanup is needed later, list old prefixes first, export the list for review, confirm no pilot database rows reference those keys, then delete through a separate reviewed maintenance operation.

Do not add S3 object deletion to the pilot reset script in this phase.

## Rollback Guidance

Rollback after reset means restoring the database backup to a reviewed target.

Recommended rollback process:

1. Stop API, worker, scheduler, and admin processes.
2. Restore the pre-reset backup to a disposable database first.
3. Verify row counts and schema.
4. Point a staging app at the disposable restore and smoke test login, tenant isolation, attendance, fees, and signed file access.
5. Only after review, restore to the intended pilot database if needed.
6. Restart app processes and rerun health checks.

S3 rollback:

- The reset script does not delete S3 objects, so S3 rollback is usually not needed.
- If an S3 cleanup was performed manually later, use bucket versioning/provider recovery if available.

## Safety Summary

| Safety control | Behavior |
| --- | --- |
| Destructive action default | Disabled; dry-run is default. |
| Apply flags | Requires `--apply --allow-pilot-reset --confirm-dry-run-reviewed`. |
| Production-mode guard | `NODE_ENV=production` requires `--allow-pilot-reset`, even for dry-run. |
| `_prisma_migrations` | Never cleared by the script. |
| S3 objects | Never deleted by the script. |
| Secrets | Database credentials, S3 credentials, JWTs, private keys, passwords, and signed URLs are not printed. |
