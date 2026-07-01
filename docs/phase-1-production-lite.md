# Phase 1 Production-Lite Deployment

This phase prepares Academify for a small VPS/Lightsail/Hostinger deployment serving 1-3 real schools. It is not the ECS/RDS migration phase.

## Runtime layout

`docker-compose.prod-lite.yml` runs these services:

- `backend-api`: Express API, compiled TypeScript, API-only by default.
- `backend-worker`: BullMQ queue consumers only.
- `backend-scheduler`: interval/cron-style scheduled jobs only.
- `postgres`: PostgreSQL for local/prod-lite deployments.
- `redis`: Redis for cache and BullMQ.
- `admin`: Next.js admin frontend.

Postgres, Redis, and backend runtime folders use named Docker volumes. Runtime uploads, exports, logs, backups, and temp files must not be stored in git-tracked paths.

## Configure

Copy `.env.example` to `.env` and replace every `change_me` value before using real data.

Production CORS must use explicit origins:

```text
CORS_ORIGINS=https://admin.example.com,https://app.example.com
```

Do not use `*` in production. The backend now fails startup if `NODE_ENV=production` and `CORS_ORIGINS` is empty or contains `*`.

For local development, `backend/.env.example` keeps localhost origins and `STORAGE_DRIVER=local`.

## Run prod-lite

```sh
docker compose -f docker-compose.prod-lite.yml --env-file .env up -d --build
```

## API, worker, and scheduler roles

Phase 2C adds explicit process roles:

- `ACADEMIFY_PROCESS_ROLE=api`: HTTP API only.
- `ACADEMIFY_PROCESS_ROLE=worker`: BullMQ workers only.
- `ACADEMIFY_PROCESS_ROLE=scheduler`: scheduled jobs only.
- `ACADEMIFY_PROCESS_ROLE=all`: local development only; rejected in production.

Legacy runtime flags remain as safety gates:

- `RUN_API=true|false`
- `RUN_WORKERS=true|false`
- `RUN_SCHEDULERS=true|false`
- `SHUTDOWN_GRACE_MS=30000`: forced-exit timeout for SIGTERM/SIGINT shutdown.

Production API containers should run with:

```text
ACADEMIFY_PROCESS_ROLE=api
RUN_API=true
RUN_WORKERS=false
RUN_SCHEDULERS=false
```

Worker containers should run with:

```text
ACADEMIFY_PROCESS_ROLE=worker
RUN_API=false
RUN_WORKERS=true
RUN_SCHEDULERS=false
```

Scheduler containers should run with:

```text
ACADEMIFY_PROCESS_ROLE=scheduler
RUN_API=false
RUN_WORKERS=false
RUN_SCHEDULERS=true
```

## Storage and uploads

Phase 2A adds a central runtime storage abstraction. The upload service supports `STORAGE_DRIVER=local` for development/test and `STORAGE_DRIVER=s3` for production object storage.

Private local files are no longer served by a broad public `/uploads` static route. Local signed URLs now go through `/api/v1/uploads/local-signed` with a short-lived HMAC signature. Public branding assets continue through `/api/v1/public/assets/branding` and are restricted to validated branding keys.

Phase 2A moved these runtime artifacts to private runtime storage:

- imports
- data exports
- audit exports
- backups
- homework/upload attachments already using the storage helper

See `docs/phase-2a-storage.md` for the storage driver, object key, and signed URL details.

## Remaining scale blockers

Before 10-school or 50-school readiness:

- Finish legacy `/uploads` object migration for any old local student-transfer records that were created before Phase 2A.
- Validate separated worker and scheduler processes in Docker or staging with real Redis.
- Use managed PostgreSQL and managed Redis with backups, monitoring, and access controls.
- Add production reverse proxy/TLS automation and request/body limits at the edge.
- Run staging migration validation and tenant-isolation regression tests against production-like data.

See `docs/phase-2c-worker-scheduler-split.md` for the role model and deployment commands.
