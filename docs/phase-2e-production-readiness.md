# Phase 2E Production Readiness

Phase 2E creates the readiness layer for launching Academify to 1-3 schools. It does not start Phase 3, migrate to ECS/RDS, rewrite reporting, or apply production database changes.

## Added Checks

- `npm --prefix backend run runtime:check-entrypoints` verifies `dist/server.js`, `dist/worker.js`, and `dist/scheduler.js` after build.
- `npm --prefix backend run prod-lite:verify` checks production-like env safety without printing secrets or connecting to production.
- `.github/workflows/ci.yml` adds backend, admin, and Docker/Compose CI gates without deployment.
- `scripts/backup-postgres.sh` creates safe PostgreSQL custom-format dumps and masks database URLs.
- `scripts/restore-postgres-drill.sh` defaults to dry-run restore listing and requires `--apply` before mutating a disposable target database.

## Required Launch Documents

- `docs/staging-deployment.md`
- `docs/first-school-launch-checklist.md`
- `docs/backup-restore-drill.md`
- `docs/monitoring-alerting.md`
- `docs/smoke-test-plan.md`
- `docs/sql/production-index-rollout.sql`

## Local Verification Sequence

```sh
npm --prefix backend run build
npm --prefix backend run runtime:check-entrypoints
NODE_ENV=production \
ACADEMIFY_PROCESS_ROLE=api \
RUN_API=true \
RUN_WORKERS=false \
RUN_SCHEDULERS=false \
npm --prefix backend run prod-lite:verify
npm --prefix backend test
npm --prefix backend run test:security
npm --prefix backend run security:secrets
cd backend && npx prisma validate
npm --prefix backend run scalability:audit
STORAGE_DRIVER=local NODE_ENV=test npm --prefix backend run storage:validate
NODE_ENV=test npm --prefix backend run storage:audit-legacy
NODE_ENV=test npm --prefix backend run storage:migrate-legacy -- --dry-run
npm --prefix admin run lint
npm --prefix admin run build
```

Run Docker checks only where Docker is available:

```sh
docker --version
docker build -f docker/backend/Dockerfile backend
docker compose -f docker-compose.prod-lite.yml config
docker compose -f docker-compose.prod-lite.yml --profile storage config
```

## Production Rules

- Production changes are staging-first and dry-run-first.
- Scripts that mutate data must require `--apply`.
- Do not run `prisma migrate reset` or `prisma db push` against production.
- Do not apply `docs/sql/production-index-rollout.sql` automatically.
- Do not print secrets, credentials, cookies, JWTs, private keys, or full signed URLs.
