# Smoke Test Plan

Run this plan in staging before production launch, then run the production-safe subset after launch. Use dedicated test users and test school records. Do not commit credentials.

## Inputs

Record these outside git:

- Admin frontend URL.
- Backend API URL.
- Test school IDs and names.
- Test users for super admin, school admin, teacher, parent, and student.
- Expected test student and attendance records.
- Storage bucket/provider name, not credentials.

## Automated Reachability

API health:

```sh
curl -fsS https://api.example.com/health
```

Admin reachability:

```sh
curl -fsS https://admin.example.com/
```

Storage validation:

```sh
NODE_ENV=production npm --prefix backend run storage:validate -- --allow-production
```

Backup file readability after a drill:

```sh
scripts/restore-postgres-drill.sh --backup-file <dump-file>
```

## Auth And Role Smoke Tests

- Super admin can log in and see platform-level dashboard only.
- School admin can log in and sees only their school.
- Teacher can log in and cannot access school admin or super admin routes.
- Parent can log in and sees only linked child data.
- Student-facing data, if exposed, is scoped to the correct student.
- Failed login attempts are rate-limited and visible in logs/alerts.

## Tenant Isolation

Use two staging schools:

- School A admin cannot fetch School B students by list filters.
- School A admin cannot fetch a known School B student by direct ID.
- Parent A cannot fetch Parent B child/result/fee data.
- Teacher A cannot mark attendance for School B classes.

## Core Workflows

- School admin scoped student list loads with pagination headers or UI controls.
- Student create/edit/read path works with test data.
- Teacher attendance marking works for a test class and date.
- Parent portal child profile/result/fee summary loads only linked data.
- Signed file upload/download works and does not expose a public `/uploads` path.
- Fee invoice list/report smoke test works under synchronous row limits.
- Notifications can be queued or safely disabled with visible warnings.

## Queue And Scheduler

- `backend-worker` logs show queue worker startup.
- Failed queue counts are visible through logs, metrics, or admin health tooling.
- `backend-scheduler` logs show scheduler startup.
- Scheduler lock behavior is visible in logs for scheduled jobs.

## Backup Status

- A backup has completed recently.
- Backup failure alert path is configured.
- Restore drill has passed against a disposable database.
- Object storage backup/versioning evidence is recorded.

## Production-Safe Subset

After production launch, run only:

- API `/health`.
- Admin frontend reachability.
- Login smoke with approved test accounts.
- One tenant-isolation negative check using test records.
- Signed upload/download using a non-sensitive test file.
- Monitoring alert delivery test, if provider supports test alerts.

Do not run unsafe load tests or destructive restore tests against production.
