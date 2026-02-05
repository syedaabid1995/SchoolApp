# Analytics (V05) - Additive Read-Only Implementation Spec

## Scope
Add read-only dashboards using existing attendance/payroll/reporting data.
- Optional exports can reuse existing report export mechanisms (CSV/PDF).

## UI Routes + Screens
- `/dashboard/analytics/attendance-trends`
- `/dashboard/analytics/teacher-punctuality`
- `/dashboard/analytics/payroll-summary`
- `/dashboard/analytics/overview`

## Additive API Endpoints
- `GET /api/v1/analytics/attendance-trends`
- `GET /api/v1/analytics/teacher-punctuality`
- `GET /api/v1/analytics/payroll-summary`
- `GET /api/v1/analytics/overview`

## Constraints
- Read-only only.
- No recomputation that mutates core attendance/payroll records.
- Analytics endpoints must never write to application databases.
- Reuse report sources where possible.
- Analytics may be near-real-time or delayed depending on cache/snapshot strategy.

## Migration + Rollback Plan
- Prefer no schema changes.
- If materialized snapshots are introduced, keep additive and disposable.
- Rollback: disable analytics routes and UI; keep source data unchanged.

## Permission Matrix Impact
| Role | View Analytics |
|---|---|
| SUPER_ADMIN | Global |
| SCHOOL_ADMIN | School-only |
| TEACHER | Optional limited view |
| PARENT/STUDENT | No |

## Cache + Audit Impact
- Cache heavy aggregate endpoints with short/medium TTL.
- Invalidate when new attendance/payroll data lands (or allow time-based expiry).
- Audit policy changes and analytics configuration updates (if any).

## Test Checklist
- API response correctness for date filters and grouping
- Role-based visibility checks
- Tenant isolation checks
- Cache hit/miss behavior for repeated dashboard calls
- Zero write-side effects verification
