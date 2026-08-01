# Deployment

This document describes deployment information found in the repository.

## Local Development

### Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Required local services:

- PostgreSQL.
- Redis.
- AWS S3 credentials or development fallback configuration.

### Admin

```bash
cd admin
npm install
npm run dev
```

Admin dev server runs on port `3001`.

### Mobile

```bash
cd school-flutter
flutter pub get
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:4000/api/v1
flutter run --dart-define=API_BASE_URL=https://api.saapttech.com/api/v1
flutter run --dart-define=API_BASE_URL=https://api.akademifyy.in/api/v1
```

## Staging

No dedicated staging workflow file was found. Recommended staging process based on existing production workflow:

1. Provision staging PostgreSQL and Redis.
2. Provision staging S3 bucket.
3. Set backend environment variables.
4. Run `npx prisma migrate deploy`.
5. Build and deploy backend Docker image.
6. Build and deploy admin Docker image with staging API base URL.
7. Build Flutter artifacts with staging `API_BASE_URL`.
8. Validate `/health`, `/metrics`, login, permissions, uploads, attendance, timetable, and payments/fees workflows.

## Production

The repository includes `.github/workflows/deploy-full-stack.yml`, which deploys backend and admin services to AWS Lightsail on main branch changes.

### Backend Build

```bash
cd backend
npm ci
npx prisma generate
npm run build
npx prisma migrate deploy
npm start
```

### Admin Build

```bash
cd admin
npm ci
npm run build
npm start
```

### Docker

| Dockerfile | Purpose |
| --- | --- |
| `docker/backend/Dockerfile` | Builds backend image, runs Prisma generate, starts Redis daemon and API server |
| `docker/admin/Dockerfile` | Builds Next.js standalone admin image |

## Database Migrations

Production migration command used by the GitHub Actions workflow:

```bash
npx prisma migrate deploy
```

Development migration command:

```bash
npx prisma migrate dev
```

Prisma generate:

```bash
npx prisma generate
```

## Environment Setup

### Backend Required Variables

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Runtime mode |
| `PORT` | HTTP port |
| `DATABASE_URL` | PostgreSQL connection |
| `JWT_SECRET` | JWT signing secret |
| `REDIS_URL` | Redis connection |
| `FRONTEND_URL` | Admin frontend URL |
| `CORS_ORIGINS` | Allowed origins |
| `AWS_ACCESS_KEY_ID` | S3 access key |
| `AWS_SECRET_ACCESS_KEY` | S3 secret |
| `AWS_REGION` | S3 region |
| `AWS_S3_BUCKET` | S3 bucket |

Optional/feature variables include `OPENAI_API_KEY`, `OPENAI_MODEL`, `AI_ASSISTANT_ENABLED`, `AUTH_TWO_STEP_ENABLED`, cache toggles, metrics toggles, and OpenTelemetry toggles.

### Admin Variables

| Variable | Purpose |
| --- | --- |
| `API_BASE_URL` | Server-side API URL |
| `NEXT_PUBLIC_API_BASE_URL` | Browser API URL |

### Flutter Build Variable

```bash
--dart-define=API_BASE_URL=https://your-api.example.com/api/v1
```

## AWS Setup

AWS integration in code is limited to S3 object storage.

Required:

1. S3 bucket.
2. IAM credentials with bucket access.
3. Region and bucket name configured in backend env.
4. CORS policy for browser/mobile uploads if using direct signed upload flows.

AWS Lightsail deployment is referenced by the GitHub Actions workflow.

## CI/CD Process

Found workflows:

| Workflow | Purpose |
| --- | --- |
| `.github/workflows/deploy-full-stack.yml` | Builds and deploys backend/admin to AWS Lightsail |
| `.github/workflows/pr-architecture-guard.yml` | PR governance checks for architecture, migration, permissions, cache, audit, tests, and risky keywords |

## Monitoring Recommendations

Implemented endpoints:

- `GET /health`
- `GET /metrics`

Recommended production monitoring:

- Uptime probe on `/health`.
- Prometheus scrape of `/metrics`.
- Error-rate alerts by HTTP status.
- Slow Prisma query alerts using `PRISMA_SLOW_QUERY_THRESHOLD_MS`.
- Redis availability and queue depth alerts.
- S3 upload failure alerts.
- Disk and memory alerts on backend host.

## Backup Strategy

Codebase includes backup/restore routes, services, and models:

- `BackupJob`
- `RestoreJob`
- `/api/v1/backups`

Recommended operational strategy:

1. Nightly PostgreSQL backups.
2. S3 object versioning/lifecycle policy.
3. Restore drills in staging.
4. Store backup metadata through existing backup job system.

## Rollback Strategy

Recommended rollback based on current architecture:

1. Keep previous Docker image tags for backend and admin.
2. Roll back application image first.
3. Avoid irreversible migrations without tested down/restore strategy.
4. For database rollback, restore from backup if Prisma migration is destructive.
5. Validate `/health`, auth, permissions, attendance, timetable, fees, and uploads after rollback.

## Production Checklist

| Area | Check |
| --- | --- |
| Database | `DATABASE_URL` set, migrations applied |
| Redis | `REDIS_URL` reachable |
| Auth | Strong `JWT_SECRET`, MFA config reviewed |
| CORS | Production origins configured |
| S3 | Bucket and credentials configured |
| Observability | `/health` and `/metrics` monitored |
| Admin | API base variables configured |
| Mobile | Built with production `API_BASE_URL` |
| Backups | Backup schedule and restore test completed |
| Security | Secrets not committed, route permissions verified |
