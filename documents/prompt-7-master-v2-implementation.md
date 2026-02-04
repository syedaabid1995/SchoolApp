# Prompt 7 - Upgraded Master Prompt v2 (Implementation Report)

Date: 2026-02-05

This report applies Prompt 7 with a "skip already implemented" approach.

## 1) Endpoint priority (already implemented in Prompt 2/4)

Reference:
- `documents/prompt-2-discovery-plan.md`
- `documents/cache-coverage-audit-report.md`

Top cached domains currently active:
1. Admin dashboard/analytics
2. Schools directory + school-admin listing
3. Students list/detail
4. Teachers list/detail
5. Attendance summaries
6. Notifications
7. Subscriptions/plan metrics
8. Themes
9. Audit logs
10. Marks list

## 2) Key naming proposal/status

Implemented pattern:
- `cache:<domain>:<schoolId?>:<resource>:<queryFingerprint?>`

Examples:
- `cache:schools:list:<fingerprint>`
- `cache:students:<schoolId>:list:<fingerprint>`
- `cache:students:<schoolId>:detail:<studentId>`
- `cache:notifications:summary:<schoolId>:<role>:<userId>`

Implemented via:
- `backend/src/services/cache/cache.keys.ts`

## 3) TTL matrix (current)

Defined in:
- `backend/src/services/cache/cache.ttl.ts`

Current values:
- Dashboard: 60s
- Analytics: 60s
- Schools: 120s
- Students: 90s
- Teachers: 90s
- Attendance: 45s
- Notifications: 30s
- Subscription: 60s

## 4) Invalidation matrix (current)

Implemented via:
- `backend/src/services/cache/cache.invalidation.ts`

Write domains covered:
- school create/update/activate/suspend/delete
- subscription create/update/status
- student create/update/delete/transfer + parent links
- teacher create/update/delete + assignments/status
- attendance session/records/approval/period
- exams and marks writes
- theme writes
- notification template/log writes

## 5) New Prompt-7 deltas implemented now

### A. Per-domain cache feature toggles

Added env flags in `backend/src/config/env.ts`:
- `REDIS_CACHE_DASHBOARD_ENABLED`
- `REDIS_CACHE_ANALYTICS_ENABLED`
- `REDIS_CACHE_SCHOOLS_ENABLED`
- `REDIS_CACHE_STUDENTS_ENABLED`
- `REDIS_CACHE_TEACHERS_ENABLED`
- `REDIS_CACHE_ATTENDANCE_ENABLED`
- `REDIS_CACHE_NOTIFICATIONS_ENABLED`
- `REDIS_CACHE_SUBSCRIPTIONS_ENABLED`
- `REDIS_CACHE_THEMES_ENABLED`
- `REDIS_CACHE_AUDIT_LOGS_ENABLED`
- `REDIS_CACHE_MARKS_ENABLED`

Also documented in:
- `backend/.env.example`

### B. Single-flight protection (cache stampede reduction)

Implemented in:
- `backend/src/services/cache/cache.service.ts`

Behavior:
- Concurrent MISS requests for the same key now share one in-flight fetcher promise.
- Subsequent concurrent callers wait for same promise.

### C. Domain-aware cache bypass

Implemented in:
- `backend/src/services/cache/cache.service.ts`

Behavior:
- Even with global cache enabled, specific domains can be disabled using env flags.
- Disabled domain returns `BYPASS` and fetches directly.

### D. Redis failure hardening test coverage expanded

Tests added/updated:
- `backend/src/services/cache/__tests__/cache.test.ts`
  - redis get/set failure fallback
  - domain toggle bypass test
  - single-flight test

## 6) Validation commands

```bash
cd backend
npm run build
npm run test:cache
```

## 7) Remaining optional improvements (not required for current scope)

1. Add HTTP integration tests for MISS->HIT->write->MISS per domain.
2. Export cache counters to metrics backend.
3. Add per-endpoint custom TTL override in controllers where needed.
