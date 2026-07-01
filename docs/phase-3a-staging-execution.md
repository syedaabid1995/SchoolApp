# Phase 3A Staging Execution Evidence

## Summary

Phase 3A was executed on 2026-07-02 01:15 IST / 2026-07-01T19:45:27Z from a local macOS workstation checkout. This machine is suitable for Node/admin/backend validation, but it is not a Docker-capable staging environment and does not have PostgreSQL client tools installed.

Result: local build, test, security, schema, prod-lite verifier, manual Compose structure checks, and local runtime storage validation passed. Real Docker image build, Docker Compose startup, staging DB migration checks, S3/MinIO validation, legacy DB audit, super-admin DB dry-run, backup/restore drill, smoke tests, and load sanity tests were not executed because required tooling, a safe staging stack, and staging credentials were not available.

No production deployment was attempted. No production data was used. No destructive Prisma command was run.

## Phase 3A-Repeat Preflight Attempt

Phase 3A-repeat was attempted on 2026-07-02 01:20 IST / 2026-07-01T19:50:32Z from the same local macOS workstation checkout.

Result: blocked at required-tool preflight. Real staging execution was intentionally stopped because Docker, Docker Compose, and PostgreSQL client tools are still unavailable on this machine. No `.env.staging.local` file was created, no Docker stack was started, no migration command was run, no staging database was touched, and no production deployment was attempted.

| Required item | Status | Evidence / action |
| --- | --- | --- |
| Docker | Missing | `docker --version` returned `command not found`. Install Docker Desktop on macOS or Docker Engine on a VPS. |
| Docker Compose plugin | Missing | `docker compose version` returned `command not found`. Comes with Docker Desktop or `docker-compose-plugin` on Linux. |
| `pg_dump` | Missing | `pg_dump --version` returned `command not found`. Install PostgreSQL client tools. |
| `pg_restore` | Missing | `pg_restore --version` returned `command not found`. Install PostgreSQL client tools. |
| `psql` | Missing | `psql --version` returned `command not found`. Install PostgreSQL client tools. |
| Safe staging env | Missing | No staging-only credentials were provided; no env file was created. |
| Staging DB / Compose DB | Missing | Cannot be validated without Docker or staging credentials. |
| S3-compatible storage | Missing | Cannot be validated without Docker MinIO or external staging credentials. |

Recommended macOS setup:

```sh
brew install --cask docker
open -a Docker
brew install postgresql@16
```

If `psql`, `pg_dump`, or `pg_restore` are not on `PATH` after installing PostgreSQL:

```sh
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Recommended Ubuntu/Debian VPS setup:

```sh
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin postgresql-client curl
sudo usermod -aG docker "$USER"
```

After installing tools, start a new shell and rerun Phase 3A-repeat on staging with fake data and staging-only secrets.

## Environment

| Item | Value / status | Notes |
| --- | --- | --- |
| Environment type | Local workstation | Not a staging VPS; not Docker-capable in this session. |
| OS | Darwin 25.3.0 arm64 | `Syeds-MacBook-Pro.local`. |
| Commit tested | `64466cf48363599af69b646e602cf4af1c3767f2` | `main`, ahead of `origin/main` by 4 commits before Phase 3A edits. |
| Node | `v22.10.0` | Available. |
| npm | `10.9.0` | Available. |
| Git | `2.50.1 (Apple Git-155)` | Available. |
| Docker | Unavailable | `docker: command not found`. |
| Docker Compose | Unavailable | `docker: command not found`. |
| pg_dump | Unavailable | `pg_dump: command not found`. |
| pg_restore | Unavailable | `pg_restore: command not found`. |
| psql | Unavailable | `psql: command not found`. |
| curl | `curl 8.7.1` | Available. |
| Load test tools | Unavailable | `k6`, `autocannon`, and `artillery` not found. |
| Storage target used | Local disposable validation root | Real S3/MinIO was not validated. |
| Staging DB used | No | No safe staging `DATABASE_URL` was provided. |

## Repository State

Preflight:

| Command | Result |
| --- | --- |
| `git status --short --branch` | Clean before Phase 3A edits; `main...origin/main [ahead 4]`. |
| `git log --oneline -8` | Latest commits include Phase 2E, 2D, 2A-2C, and Phase 0 work. |
| `git diff --stat` | Empty before Phase 3A edits. |

Phase 3A changed only runbook/tooling/evidence files:

| File | Change | Why |
| --- | --- | --- |
| `backend/package.json` | Added `remediate:default-super-admin` script alias. | Matches the Phase 3A requested command while preserving the existing maintenance alias. |
| `backend/scripts/remediate-default-super-admin.ts` | Masks emails in output and updates help text. | Avoids printing full default super-admin email during remediation checks. |
| `docs/default-super-admin-remediation.md` | Updated examples to use the new script alias and explicit `--dry-run`. | Keeps docs aligned with Phase 3A command naming. |
| `docs/staging-deployment.md` | Added explicit rollback runbook. | Covers previous commit/image, env rollback, DB review, object storage recovery, stop/start, and verification. |
| `docs/first-school-launch-checklist.md` | Expanded rollback checklist. | Makes launch signoff verify rollback readiness. |
| `docs/phase-3a-staging-execution.md` | Added this evidence record. | Records commands, pass/fail status, blockers, and next actions without secrets. |

## Commands Executed

| Command | Result | Notes |
| --- | --- | --- |
| `npm --prefix backend run build` | Pass | TypeScript backend build completed. |
| `npm --prefix backend run runtime:check-entrypoints` | Pass | `dist/server.js`, `dist/worker.js`, and `dist/scheduler.js` exist. |
| `npm --prefix backend test` | Pass | 369 passed, 1 skipped, 0 failed. |
| `npm --prefix backend run test:security` | Pass | 232 passed, 1 skipped, 0 failed. |
| `npm --prefix backend run security:secrets` | Pass | No committed secrets detected. |
| `cd backend && npx prisma validate` | Pass | Prisma schema valid. |
| `npm --prefix backend run scalability:audit` | Pass with advisories | Exited 0; reported 72 advisory unbounded `findMany` candidates for later review. |
| `npm --prefix admin run lint` | Pass with warnings | 0 errors, 81 warnings. |
| `npm --prefix admin run build` | Pass with warnings | Next.js production build completed. |
| `git diff --check` | Pass | No whitespace errors reported. |
| `npm --prefix backend run prod-lite:verify` | Pass with dummy values | Run for `api`, `worker`, and `scheduler`; real staging credentials were not used. |
| YAML parse/manual Compose validation | Pass | Required services, role commands, profile-gated MinIO, healthchecks, dependencies, and volumes present. |
| `STORAGE_DRIVER=local NODE_ENV=test npm --prefix backend run storage:validate` | Pass | Upload, signed URL generation, readback, and cleanup passed locally. |
| `npm --prefix backend run storage:audit-legacy -- --help` | Pass | Help verified only; DB audit not run without staging DB. |
| `npm --prefix backend run storage:migrate-legacy -- --help` | Pass | Help verified only; DB migration dry-run not run without staging DB. |
| `npm --prefix backend run remediate:default-super-admin -- --help` | Pass | Help verified only; DB dry-run not run without staging DB. |
| `scripts/backup-postgres.sh --help` | Pass | Help verified; real backup not run without `pg_dump` and staging DB. |
| `scripts/restore-postgres-drill.sh --help` | Pass | Help verified; restore drill not run without `pg_restore` and disposable DB. |

## Docker Validation

Docker was not available on this machine, so these were not executed:

```sh
docker build -f docker/backend/Dockerfile backend
docker compose -f docker-compose.prod-lite.yml config
docker compose -f docker-compose.prod-lite.yml --profile storage config
docker compose -f docker-compose.prod-lite.yml --env-file <staging-env-file> up -d --build
```

Manual checks completed:

- Backend Dockerfile builds from Node 20 slim, compiles TypeScript, prunes dev dependencies, and runs as non-root `nodejs`.
- Backend image command defaults to `node dist/server.js`.
- Backend Dockerfile does not install or start Redis.
- Compose defines `postgres`, `redis`, `backend-api`, `backend-worker`, `backend-scheduler`, and `admin`.
- Compose runs API, worker, and scheduler with separate commands and explicit `ACADEMIFY_PROCESS_ROLE` values.
- MinIO services exist only under the `storage` profile.
- Compose defaults `STORAGE_DRIVER` to `s3`, `ALLOW_LOCAL_STORAGE_IN_PRODUCTION` to `false`, and CORS to an explicit origin.
- No broad `express.static('/uploads')` route was found; upload access remains route-controlled/signed.

## Staging Tasks Not Executed Here

These tasks remain blocked until run on a Docker-capable staging/prod-lite target with fake staging data and non-production credentials:

| Task | Status | Blocker |
| --- | --- | --- |
| Docker backend image build | Not run | Docker unavailable. |
| Docker Compose config via Docker | Not run | Docker unavailable. |
| Docker Compose stack startup | Not run | Docker unavailable and no safe staging env. |
| Service logs review | Not run | Stack not started. |
| API/admin health checks | Not run | Stack not started. |
| `prisma migrate status` | Not run | No confirmed staging DB. |
| `prisma migrate deploy` | Not run | No confirmed staging DB. |
| Real S3/MinIO validation | Not run | No S3/MinIO credentials or Docker MinIO. |
| Legacy storage audit | Not run | No confirmed staging DB. |
| Legacy migration dry-run | Not run | No confirmed staging DB. |
| Default super-admin remediation dry-run | Not run | No confirmed staging DB. |
| PostgreSQL backup | Not run | No `pg_dump` and no staging DB. |
| Restore drill | Not run | No `pg_restore` and no disposable restore DB. |
| Smoke tests | Not run | No running staging stack/test users. |
| Load sanity test | Not run | No running staging stack and no load-test runner. |
| Monitoring validation | Partial docs only | No deployed monitoring target/channel. |

## Commands To Run On Target Staging Machine

Install required tools first. On Ubuntu/Debian VPS:

```sh
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin postgresql-client curl
```

Then run from a clean checkout with staging-only `.env` values:

```sh
git status --short --branch
git log --oneline -8
git diff --stat

npm --prefix backend run build
npm --prefix backend run runtime:check-entrypoints
npm --prefix backend run prod-lite:verify
npm --prefix backend test
npm --prefix backend run test:security
npm --prefix backend run security:secrets
cd backend && npx prisma validate && cd ..
npm --prefix backend run scalability:audit
npm --prefix admin run lint
npm --prefix admin run build
git diff --check

docker build -f docker/backend/Dockerfile backend
docker compose -f docker-compose.prod-lite.yml --env-file .env config
docker compose -f docker-compose.prod-lite.yml --env-file .env --profile storage config
docker compose -f docker-compose.prod-lite.yml --env-file .env up -d --build
docker compose -f docker-compose.prod-lite.yml --env-file .env ps
docker compose -f docker-compose.prod-lite.yml --env-file .env logs --tail=100 backend-api
docker compose -f docker-compose.prod-lite.yml --env-file .env logs --tail=100 backend-worker
docker compose -f docker-compose.prod-lite.yml --env-file .env logs --tail=100 backend-scheduler
docker compose -f docker-compose.prod-lite.yml --env-file .env logs --tail=100 admin

cd backend && npx prisma migrate status && cd ..
# Run only against the staging DB after review:
cd backend && npx prisma migrate deploy && cd ..

NODE_ENV=production npm --prefix backend run storage:validate -- --allow-production
NODE_ENV=production npm --prefix backend run storage:audit-legacy -- --limit 100
NODE_ENV=production npm --prefix backend run storage:migrate-legacy -- --dry-run --limit 50 --only-existing-files
NODE_ENV=production npm --prefix backend run remediate:default-super-admin -- --dry-run

NODE_ENV=production DATABASE_URL=<staging-db-url> BACKUP_DIR=<safe-local-dir> scripts/backup-postgres.sh --allow-production
RESTORE_TARGET_CLASS=staging RESTORE_DATABASE_URL=<disposable-restore-db-url> scripts/restore-postgres-drill.sh --backup-file <dump-file> --apply
```

Do not run `prisma migrate reset`, `prisma db push`, destructive SQL, production seed scripts, or restore operations against production.

## Smoke And Load Requirements

Before 1-3 real schools, run `docs/smoke-test-plan.md` on a live staging stack with fake data and dedicated staging users for super admin, school admin, teacher, parent, and student.

Minimum smoke evidence still required:

- API `/health`.
- Admin frontend reachability.
- API process role is `api`.
- Worker and scheduler processes are running.
- Redis and PostgreSQL are reachable.
- Real object storage validation passes.
- Login works for staging test users.
- Tenant isolation checks pass across two fake schools.
- Teacher attendance flow works with fake data.
- Parent portal cannot access another child.
- Signed upload/download works.
- Audit log browsing works.
- Worker logs show no crash loop.
- Scheduler lock prevents duplicate subscription job execution.
- Logs do not print secrets, JWTs, cookies, S3 credentials, or full signed URLs.

Limited load sanity still required:

- Use `k6`, `autocannon`, or `artillery`.
- Run only against staging.
- Use 10-25 virtual users for 1-3 minutes.
- Cover API health, login, student list, attendance list, parent dashboard, and signed file URL request.

## Monitoring And Alerting Status

Documentation exists in `docs/monitoring-alerting.md`, but live monitoring was not configured or validated in this session.

Remaining first-school blockers:

- Uptime check for admin URL.
- Backend `/health` alert.
- API/worker/scheduler process alerts.
- PostgreSQL storage/connections visibility.
- Redis availability visibility.
- Backup success/failure alert.
- 5xx/error-rate alert.
- Failed login spike alert.
- Queue failure alert.
- Scheduler-not-running alert.
- Storage validation failure alert.
- Alert recipient/channel and escalation path.

## Rollback Status

Rollback documentation was expanded in `docs/staging-deployment.md` and `docs/first-school-launch-checklist.md`.

Required target-environment evidence still needed:

- Previous image tags or previous commit recorded before deploy.
- Last known-good env inventory recorded without secret values.
- Prisma migration status captured before and after deploy.
- Backup restore policy reviewed by an operator.
- Object storage rollback/versioning verified with the provider.
- Stop/restart rollback commands tested on staging.
- Post-rollback smoke subset executed.

## Readiness Decision

Ready for 1-3 schools: No.

Reason: local code gates passed, but Phase 3A's core goal is to prove the system in a real staging/prod-lite Docker environment. That proof is still blocked by missing Docker, missing PostgreSQL client tools, no safe staging DB, no S3/MinIO credentials, no running stack, no staging test users, no backup/restore drill, no smoke tests, no load sanity test, and no live monitoring validation.

Recommended next phase: Phase 3A-repeat on a Docker-capable staging VPS or disposable local Docker machine after blockers are fixed.
