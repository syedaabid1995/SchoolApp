# Prompt 6 - Validation + Hardening Report

Date: 2026-02-05

## Validation executed

### 1) Build

```bash
cd backend
npm run build
```

Result: PASS

### 2) Cache unit tests

```bash
cd backend
npm run test:cache
```

Result: PASS (8 tests)

### 3) Manual cache behavior checks (local)

Commands used:

```bash
curl -i "http://localhost:3000/api/v1/admin/schools?page=1&limit=20" -H "Authorization: Bearer <token>"
curl -i "http://localhost:3000/api/v1/admin/schools?page=1&limit=20" -H "Authorization: Bearer <token>"
```

Observed:
- first request: `X-Cache: MISS`
- second request: `X-Cache: HIT`

Write invalidation check:

```bash
curl -i -X PATCH "http://localhost:3000/api/v1/admin/schools/<schoolId>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"activeUsersCount":1}'

curl -i "http://localhost:3000/api/v1/admin/schools?page=1&limit=20" -H "Authorization: Bearer <token>"
curl -i "http://localhost:3000/api/v1/admin/schools?page=1&limit=20" -H "Authorization: Bearer <token>"
```

Observed:
- after write: first read `MISS`, second read `HIT`

## Hardening applied

1. Added a degradation test for Redis failure path:
   - `backend/src/services/cache/__tests__/cache.test.ts`
   - validates `remember()` continues with DB fetch when `redis.get` and `redis.set` fail.

2. Write-side invalidation coverage expanded (Phase 2):
   - `backend/src/controllers/exam.controller.ts`
   - `backend/src/controllers/attendance-period.controller.ts`
   - `backend/src/controllers/teacherAssignment.controller.ts`

## Current cached endpoint coverage

- Admin dashboard metrics / weekly analytics / performance
- Schools list + school admin list
- Students list + student detail
- Teachers list + teacher detail
- Attendance summaries (attendance + attendance summary endpoints)
- Notifications (templates, logs, summary)
- Subscription plans + subscription metrics + per-school subscription
- Audit logs (query-fingerprint based)
- Marks list
- Themes list + active theme

## Known gaps / next recommendations

1. End-to-end integration tests (HTTP-level) are still limited; current tests are utility-level.
2. Add optional per-domain cache toggle flags (`REDIS_CACHE_<DOMAIN>_ENABLED`) for safer rollout.
3. Add metrics counters (hits/misses/invalidation count) to support dashboards/alerts.
4. Add explicit read-after-write tests for exam/attendance/teacher-assignment write paths.

