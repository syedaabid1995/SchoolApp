# First-School Launch Checklist

Use this checklist before onboarding the first 1-3 real schools. Every item should have evidence, owner, and date.

## Domain And Edge

- [ ] Production domain and DNS configured.
- [ ] HTTPS configured and renewal path verified.
- [ ] Cloudflare or equivalent edge settings reviewed.
- [ ] Admin frontend is reachable only on intended domains.
- [ ] Backend API is reachable only on intended domains.

## Environment And Runtime

- [ ] Production `.env` reviewed by two operators without exposing values in tickets or commits.
- [ ] `NODE_ENV=production`.
- [ ] `CORS_ORIGINS` contains explicit origins only; no wildcard.
- [ ] `DATABASE_URL`, `REDIS_URL`, JWT, S3, email/SMS, and provider secrets are present.
- [ ] `STORAGE_DRIVER=s3`.
- [ ] `ALLOW_LOCAL_STORAGE_IN_PRODUCTION=false`.
- [ ] `STORAGE_LEGACY_LOCAL_UPLOADS_READ_ENABLED=false`, unless a reviewed temporary compatibility window is active.
- [ ] `backend-api`, `backend-worker`, and `backend-scheduler` run as separate services.
- [ ] `backend-api` uses `ACADEMIFY_PROCESS_ROLE=api`.
- [ ] `backend-worker` uses `ACADEMIFY_PROCESS_ROLE=worker`.
- [ ] `backend-scheduler` uses `ACADEMIFY_PROCESS_ROLE=scheduler`.
- [ ] `ACADEMIFY_PROCESS_ROLE=all` is not used in production.

## Storage

- [ ] Real S3/R2/Spaces bucket is private.
- [ ] Storage credentials are least-privilege for the required bucket or prefix.
- [ ] `storage:validate` passed against the real production object store.
- [ ] Full signed URLs were not pasted into logs, tickets, or docs.
- [ ] Legacy file audit completed.
- [ ] Legacy migration completed or documented as not needed.
- [ ] Signed upload/download smoke test passed.

## Database And Migrations

- [ ] Production seed scripts were not run.
- [ ] Default super-admin account disabled, rotated, or confirmed absent.
- [ ] `prisma migrate deploy` plan reviewed for production.
- [ ] No destructive Prisma migration is pending.
- [ ] Index rollout plan reviewed.
- [ ] `docs/sql/production-index-rollout.sql` applied only if staging evidence supports it.
- [ ] Any production index rollout uses `CREATE INDEX CONCURRENTLY` outside Prisma transactions.

## Backup And Restore

- [ ] PostgreSQL backup schedule configured.
- [ ] Object storage backup/versioning configured.
- [ ] Backup failure alert configured.
- [ ] Restore drill passed against a disposable database.
- [ ] Restore verification avoided exposing student data.
- [ ] Env/secrets inventory documented without secret values.

## Smoke Tests

- [ ] API `/health` returns healthy.
- [ ] Admin frontend reachable.
- [ ] Super admin login smoke test passed.
- [ ] School admin login smoke test passed.
- [ ] Teacher login smoke test passed.
- [ ] Parent login smoke test passed.
- [ ] Tenant isolation smoke test passed with two schools or controlled test tenants.
- [ ] School admin scoped student list works.
- [ ] Teacher attendance flow works.
- [ ] Parent portal child data is scoped correctly.
- [ ] Upload/download signed file flow works.
- [ ] Attendance smoke test passed.
- [ ] Fee/report smoke test passed under row limits.
- [ ] Worker queue health observable.
- [ ] Scheduler lock/log visibility confirmed.

## Monitoring And Support

- [ ] Admin uptime alert configured.
- [ ] Backend health alert configured.
- [ ] DB, Redis, server CPU/RAM/disk alerts configured.
- [ ] Worker and scheduler process alerts configured.
- [ ] 5xx rate alert configured.
- [ ] Failed login spike alert configured.
- [ ] Queue failure alert configured.
- [ ] Email/SMS/WhatsApp failure alert configured if providers are enabled.
- [ ] Log retention configured.
- [ ] Alert recipient and escalation path configured.
- [ ] Support contact and incident process ready.

## Rollback

- [ ] Previous image tags or release artifacts available.
- [ ] Previous known-good commit SHA recorded.
- [ ] Last known-good deployment config recorded.
- [ ] Environment rollback process tested without printing secret values.
- [ ] Stop-service and restart-previous-version commands documented.
- [ ] Database migration review completed before release.
- [ ] Database rollback strategy documents backup restore only after human review.
- [ ] Restore drill completed against a disposable database before any production restore is considered.
- [ ] Object storage rollback/recovery path documented, including bucket versioning or provider recovery.
- [ ] Post-rollback verification checklist covers API health, admin reachability, API/worker/scheduler logs, DB, Redis, and storage.
- [ ] Operator authorized to execute rollback identified.

## Signoff

- Engineering: Go / Conditional Go / No-Go
- QA: Go / Conditional Go / No-Go
- Operations: Go / Conditional Go / No-Go
- School support: Go / Conditional Go / No-Go
