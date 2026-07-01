# Backup And Restore Drill

Phase 2E defines a safe drill for the first 1-3 schools. It does not execute a production backup or restore by itself.

## Scope

Back up and verify:

- PostgreSQL database.
- Private object storage used by `STORAGE_DRIVER=s3`, including uploads, homework attachments, imports, exports, audit exports, backups, and student-transfer files.
- Environment and secret inventory names, not secret values.
- Deployment configuration: Compose file, Dockerfiles, reverse proxy config, and release commit SHA.

## PostgreSQL Backup

Local or staging dry-run:

```sh
DATABASE_URL=postgresql://user:password@localhost:5432/academify \
scripts/backup-postgres.sh --dry-run
```

Create a local/staging dump:

```sh
DATABASE_URL=postgresql://user:password@localhost:5432/academify \
BACKUP_DIR=./tmp/backups \
scripts/backup-postgres.sh
```

Production requires an intentional flag:

```sh
NODE_ENV=production \
DATABASE_URL=postgresql://user:password@db.example.com:5432/academify \
BACKUP_DIR=/private/backups/academify \
scripts/backup-postgres.sh --allow-production
```

The script uses `pg_dump --format=custom --no-owner --no-privileges`, masks the database URL in logs, writes files with private permissions, and does not mutate the database.

## Restore Drill

Default mode is read-only and only verifies the dump can be listed:

```sh
scripts/restore-postgres-drill.sh --backup-file ./tmp/backups/academify-postgres-YYYYMMDDTHHMMSSZ.dump
```

Restore only into a disposable local or staging database:

```sh
RESTORE_TARGET_CLASS=staging \
RESTORE_DATABASE_URL=postgresql://user:password@localhost:5432/academify_restore_drill \
scripts/restore-postgres-drill.sh \
  --backup-file ./tmp/backups/academify-postgres-YYYYMMDDTHHMMSSZ.dump \
  --apply
```

The restore script refuses to run if `RESTORE_DATABASE_URL` equals `DATABASE_URL`. It also refuses production-class targets unless both dangerous confirmation flags are provided. That path is for emergency recovery only, not routine drills.

## Object Storage Backup

For S3-compatible storage, enable bucket versioning where available and keep lifecycle rules reviewed. For a drill, verify:

- Bucket exists and is private.
- App credentials can write/read/delete only the expected bucket or prefix.
- Server-side encryption is enabled when the provider supports it.
- Lifecycle retention keeps enough history for accidental deletion recovery.
- At least one recent uploaded object can be restored to a temporary prefix without exposing a signed URL.

Use provider tools such as `aws s3 sync`, `rclone`, or the provider console. Do not commit provider credentials or print signed URLs.

## Data Verification

After a restore drill, verify counts and application behavior without exposing student data:

```sql
SELECT COUNT(*) FROM schools;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM students;
SELECT COUNT(*) FROM attendance_sessions;
SELECT COUNT(*) FROM fee_invoices;
```

Then run smoke tests against the disposable restored environment:

- `/health` returns healthy.
- Super admin and one school admin can log in.
- A school admin sees only that school's students.
- A signed upload/download path works.
- Attendance and fee smoke paths work with test data.

## Schedule And Retention

Minimum for 1-3 schools:

- PostgreSQL: nightly backup, retain daily backups for 14 days and weekly backups for 8 weeks.
- Object storage: versioning or daily sync snapshot, retain at least 14 days.
- Restore drill: before first school launch, after any backup-system change, and monthly until operations are stable.
- Backup alert: every scheduled backup must produce success/failure evidence.

Before 10 schools, move backups to managed PostgreSQL snapshots plus tested point-in-time recovery where available.
