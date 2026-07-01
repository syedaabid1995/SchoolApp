# Staging Deployment Runbook

Phase 2E staging flow for a VPS/Lightsail/Hostinger-style target. This is deployment preparation only; it does not migrate Academify to ECS/RDS.

## 1. Provision Server

- Provision a staging VPS with enough CPU/RAM/disk for PostgreSQL, Redis, API, worker, scheduler, and admin.
- Restrict SSH to named operators.
- Install Docker Engine and the Docker Compose plugin.
- Configure firewall rules for SSH, HTTPS, and any private monitoring access.
- Point a staging DNS name to the server and enable HTTPS through the chosen reverse proxy or provider.

## 2. Checkout And Configure

```sh
git clone <repo-url> academify
cd academify
cp .env.example .env
```

Set staging values only. Do not reuse production database, Redis, object storage, JWT, S3, email, SMS, or cookie secrets.

Required production-like values:

```text
NODE_ENV=production
CORS_ORIGINS=https://staging-admin.example.com
FRONTEND_URL=https://staging-admin.example.com
STORAGE_DRIVER=s3
STORAGE_LEGACY_LOCAL_UPLOADS_READ_ENABLED=false
ALLOW_LOCAL_STORAGE_IN_PRODUCTION=false
DATABASE_URL=<staging-postgres-url>
REDIS_URL=<staging-redis-url>
JWT_SECRET=<strong-staging-secret>
API_BASE_URL=https://staging-api.example.com/api/v1
NEXT_PUBLIC_API_BASE_URL=https://staging-api.example.com/api/v1
```

Compose sets `ACADEMIFY_PROCESS_ROLE` separately for `backend-api`, `backend-worker`, and `backend-scheduler`.

## 3. Validate Config

```sh
docker --version
docker compose version
docker compose -f docker-compose.prod-lite.yml --env-file .env config
docker compose -f docker-compose.prod-lite.yml --env-file .env --profile storage config
```

After dependencies are installed or images are built, run:

```sh
npm --prefix backend run build
npm --prefix backend run runtime:check-entrypoints
NODE_ENV=production \
ACADEMIFY_PROCESS_ROLE=api \
RUN_API=true \
RUN_WORKERS=false \
RUN_SCHEDULERS=false \
npm --prefix backend run prod-lite:verify
```

The verifier masks secret-bearing URLs and checks CORS, storage, entrypoints, Prisma validation, and required scripts.

## 4. Build And Migrate Staging

Build images:

```sh
docker compose -f docker-compose.prod-lite.yml --env-file .env build
```

Apply migrations only to the staging database:

```sh
docker compose -f docker-compose.prod-lite.yml --env-file .env run --rm backend-api npx prisma migrate deploy
```

Do not run `prisma migrate reset`, `prisma db push`, or destructive SQL against staging data that must be preserved.

## 5. Start Services

```sh
docker compose -f docker-compose.prod-lite.yml --env-file .env up -d
docker compose -f docker-compose.prod-lite.yml ps
```

Verify:

```sh
curl -fsS https://staging-api.example.com/health
curl -fsS https://staging-admin.example.com/
docker compose -f docker-compose.prod-lite.yml logs --tail=100 backend-api
docker compose -f docker-compose.prod-lite.yml logs --tail=100 backend-worker
docker compose -f docker-compose.prod-lite.yml logs --tail=100 backend-scheduler
```

## 6. Storage And Legacy Files

Validate storage without printing signed URLs:

```sh
NODE_ENV=production npm --prefix backend run storage:validate -- --allow-production
```

Audit legacy file references:

```sh
NODE_ENV=production npm --prefix backend run storage:audit-legacy -- --limit 100
```

Dry-run legacy migration:

```sh
NODE_ENV=production npm --prefix backend run storage:migrate-legacy -- --dry-run --limit 50 --only-existing-files
```

Apply a legacy migration only after a scoped staging dry-run has been reviewed.

## 7. Default Super Admin

Dry-run first:

```sh
NODE_ENV=production npm --prefix backend run remediate:default-super-admin -- --dry-run
```

If the default account exists, rotate or disable it using the documented maintenance process. Do not seed production defaults.

## 8. Backup And Restore Drill

Create a staging backup:

```sh
NODE_ENV=production DATABASE_URL=<staging-db-url> scripts/backup-postgres.sh --allow-production
```

Restore to a disposable database:

```sh
RESTORE_TARGET_CLASS=staging \
RESTORE_DATABASE_URL=<disposable-staging-restore-db-url> \
scripts/restore-postgres-drill.sh --backup-file <dump-file> --apply
```

Verify counts and smoke tests from `docs/backup-restore-drill.md`.

## 9. Smoke And Limited Load Tests

Run the smoke plan in `docs/smoke-test-plan.md`.

Run only limited staging load tests. Do not run load tests against production:

```sh
# See docs/load-testing.md and keep concurrency low for staging.
```

## 10. Monitoring

- Configure alerts from `docs/monitoring-alerting.md`.
- Verify API, worker, scheduler, DB, Redis, storage, and backup alerts.
- Record the release commit, image tags, migration version, and operator.

## 11. Rollback Runbook

Rollback is an operations decision, not an automatic script. Prefer rolling back application images/config first. Restore a database backup only after human review confirms the schema/data state requires it.

Before deploy:

- Record the current commit SHA and image tags for `backend-api`, `backend-worker`, `backend-scheduler`, and `admin`.
- Save a last known-good environment inventory without secret values.
- Record the current Prisma migration status.
- Confirm the latest PostgreSQL backup and object storage recovery/versioning evidence.

Stop the current stack:

```sh
docker compose -f docker-compose.prod-lite.yml --env-file .env down
```

Restart the previous release from the previous commit or image tags:

```sh
git checkout <previous-known-good-commit>
docker compose -f docker-compose.prod-lite.yml --env-file .env up -d --build
docker compose -f docker-compose.prod-lite.yml --env-file .env ps
```

If the rollback is config-only, restore the previous reviewed `.env` values and restart:

```sh
docker compose -f docker-compose.prod-lite.yml --env-file .env up -d --force-recreate
```

Database rollback policy:

- Review migrations before rollback; do not run `prisma migrate reset` or `prisma db push`.
- Do not restore a backup over staging or production until an operator confirms the target and impact.
- Restore only to a disposable drill database first when possible, then compare schema and row-count evidence.

Object storage rollback policy:

- Do not delete bucket objects during application rollback.
- Use bucket versioning/provider recovery for accidental overwrite/delete cases.
- Revalidate signed upload/download flows after any storage credential, endpoint, or bucket rollback.

Post-rollback verification:

```sh
curl -fsS https://staging-api.example.com/health
curl -fsS https://staging-admin.example.com/
docker compose -f docker-compose.prod-lite.yml --env-file .env logs --tail=100 backend-api
docker compose -f docker-compose.prod-lite.yml --env-file .env logs --tail=100 backend-worker
docker compose -f docker-compose.prod-lite.yml --env-file .env logs --tail=100 backend-scheduler
```

Run the production-safe smoke subset from `docs/smoke-test-plan.md` and record the rollback operator, start/end time, reason, and result.

## Signoff

- Engineering owner:
- Deployment owner:
- QA owner:
- Staging date:
- Result: Go / Conditional Go / No-Go
