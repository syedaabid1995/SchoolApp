# Phase 2C Worker And Scheduler Split

Phase 2C separates Academify backend runtime responsibilities into explicit process roles.

## Process Roles

Use `ACADEMIFY_PROCESS_ROLE`:

```text
api
worker
scheduler
all
```

Defaults:

- `NODE_ENV=production`: `api`
- non-production: `all`

`all` is rejected in production. It is only for local development where one process can run API, queue workers, and schedulers together.

## Entrypoints

Production compiled entrypoints:

```sh
npm --prefix backend run start:api
npm --prefix backend run start:worker
npm --prefix backend run start:scheduler
```

Development entrypoints:

```sh
npm --prefix backend run dev:api
npm --prefix backend run dev:worker
npm --prefix backend run dev:scheduler
npm --prefix backend run dev
```

`dev` runs the development-only combined process using `src/all.ts`.

## Production Layout

API service:

```text
ACADEMIFY_PROCESS_ROLE=api
RUN_API=true
RUN_WORKERS=false
RUN_SCHEDULERS=false
command: node dist/server.js
```

Worker service:

```text
ACADEMIFY_PROCESS_ROLE=worker
RUN_API=false
RUN_WORKERS=true
RUN_SCHEDULERS=false
command: node dist/worker.js
```

Scheduler service:

```text
ACADEMIFY_PROCESS_ROLE=scheduler
RUN_API=false
RUN_WORKERS=false
RUN_SCHEDULERS=true
command: node dist/scheduler.js
```

This lets multiple API containers run without duplicating queue consumers or scheduled jobs.

## Workers

The worker process starts queue consumers only:

- `fee-generation`
- `import-jobs`
- `notifications`
- `report-generation`
- `face-processing`

Worker modules expose explicit start/stop functions. Importing worker files should not start BullMQ workers.

## Schedulers

The scheduler process starts interval-based jobs only:

- `subscriptions.expiry-check`

The scheduler does not start queue consumers.

## Distributed Scheduler Locks

Scheduled job execution is protected by a Redis lock using `SET NX PX` with an owner token. Release uses a Lua compare-and-delete script so one process cannot release another process lock.

If another scheduler instance already holds a job lock, the job run is skipped and a safe info log is emitted.

This is not leader election. It is a small per-job duplicate-execution guard for VPS/Lightsail and early ECS-style deployments.

## Docker Compose

Start the full production-lite layout:

```sh
docker compose -f docker-compose.prod-lite.yml --env-file .env up -d --build
```

The file defines:

- `backend-api`
- `backend-worker`
- `backend-scheduler`
- `postgres`
- `redis`
- `admin`

The optional MinIO storage profile from Phase 2B remains:

```sh
docker compose -f docker-compose.prod-lite.yml --profile storage up -d minio minio-init
```

## VPS Guidance

On one VPS, run all services from the compose file. Scale API replicas only after:

- worker and scheduler services are separated.
- scheduler logs show lock acquisition/skip behavior as expected.
- Redis is persistent enough for BullMQ and locks.
- database backups are configured.

## ECS Mapping Later

Map the same image into separate ECS services:

- ECS service: `api`
- ECS service: `worker`
- ECS service: `scheduler`

Keep scheduler desired count at 1 unless the per-job lock behavior has been validated under multiple scheduler tasks.

## Remaining Risks Before 10 Schools

- Real Docker/MinIO validation still needs a Docker-capable environment.
- Queue worker behavior should be observed with real Redis under load.
- Scheduler lock behavior should be validated in staging with two scheduler processes before scaling scheduler replicas.
- Phase 2D should review high-volume pagination, database indexes, and expanded tenant regression coverage.
