# Staging Readiness Checklist

Date: 2026-06-04
Status: Open until staging owners sign off.

## Environment

- [ ] `DATABASE_URL` points to staging PostgreSQL, not production.
- [ ] `JWT_SECRET` is set to a strong staging secret.
- [ ] Redis URL/config is set and reachable.
- [ ] Frontend API URL points to the staging backend.
- [ ] S3/storage bucket, region, credentials, and upload limits are configured.
- [ ] OTP flags are set for production-like behavior; OTP codes are not exposed.
- [ ] Backup/restore flags are set deliberately.
- [ ] `ALLOW_PRODUCTION_RESTORE` is unset/false unless explicitly testing restore in an isolated environment.
- [ ] Email, SMS, WhatsApp, and messaging provider config is present or safe warnings are confirmed.

## Build/Test

- [ ] `npm --prefix backend run build`
- [ ] `npm --prefix backend test`
- [ ] `npm --prefix admin run build`
- [ ] `npm --prefix admin run lint`
- [ ] Prisma generate completed.
- [ ] Prisma migrations deployed with `prisma migrate deploy`.

## Runtime

- [ ] Backend `/health` returns healthy.
- [ ] Admin app loads and redirects unauthenticated users correctly.
- [ ] Super Admin can log in.
- [ ] `pg_dump` exists in backend runtime.
- [ ] `pg_restore` exists in backend runtime.
- [ ] Redis connectivity is confirmed.
- [ ] Storage connectivity is confirmed by signed upload/download path.

Local Docker evidence:

- 2026-06-04: `docker build -f docker/backend/Dockerfile -t schoolapp-backend-check backend` completed successfully.
- 2026-06-04: `docker run --rm schoolapp-backend-check pg_dump --version` returned PostgreSQL 15.18.
- 2026-06-04: `docker run --rm schoolapp-backend-check pg_restore --version` returned PostgreSQL 15.18.

## Manual QA

- [ ] Super Admin login and MFA.
- [ ] School Admin login and MFA.
- [ ] Parent OTP login.
- [ ] School onboarding checklist, review, and go-live.
- [ ] Teacher onboarding, credentials, assignments, and readiness.
- [ ] Student management lifecycle.
- [ ] Attendance marking and locks.
- [ ] Timetable setup and conflict checks.
- [ ] Exam centers, rooms, seating, invigilators.
- [ ] Hall ticket generation.
- [ ] Reports CSV/PDF export.
- [ ] Compliance export/deletion approve and reject.
- [ ] Backup request/run/download.
- [ ] Restore request/approve/reject/run guard.
- [ ] Role and permission checks.
- [ ] Tenant isolation with two schools and direct ID guessing.

## Security

- [ ] OTP is not exposed in production responses.
- [ ] Refresh tokens are HttpOnly cookies.
- [ ] API responses do not expose password hashes, raw tokens, OTP hashes, TOTP secrets, or backup secrets.
- [ ] Report export permission checks are enforced.
- [ ] Cross-tenant access is blocked.
- [ ] Production restore guard blocks unsafe restore attempts.
- [ ] Login failure rate limiting is active.

## Signoff

- QA owner:
- Engineering owner:
- Deployment owner:
- Recommendation: Go / Conditional Go / No-Go
- Signoff date:
