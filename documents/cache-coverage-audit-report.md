# Redis Cache Coverage Audit Report

Generated from current codebase (`backend/src/routes`, `backend/src/controllers`, `backend/src/services/cache`).

## Summary

- Cache infrastructure present: `backend/src/services/cache/*`
- Read-through caching implemented on major high-read admin/school APIs
- Cache invalidation hooks implemented on most high-impact write paths
- Observability present via `X-Cache` headers on cached endpoints

## Endpoint Coverage Matrix

| Domain | GET Cached | Write Invalidation | Status |
|---|---|---|---|
| Admin Dashboard (`/admin/dashboard`, weekly, performance, activities) | Yes | Yes (`invalidateAdminDashboardCache`) | Covered |
| Schools Directory (`/admin/schools`) | Yes | Yes (`invalidateSchoolCache`) | Covered |
| School Admin List (`/admin/schools/:id/admins`) | Yes | Yes | Covered |
| Students List (`/students/students`) | Yes | Yes (`invalidateStudentCache`) | Covered |
| Student Detail (`/students/students/:id`) | Yes | Yes | Covered |
| Teachers List (`/teachers`) | Yes | Yes (`invalidateTeacherCache`) | Covered |
| Teacher Detail (`/teachers/:id`) | Yes | Yes | Covered |
| Attendance Summary (`/attendance-summary`) | Yes | Yes (`invalidateAttendanceCache`) | Covered |
| Attendance Sessions List (`/attendance/sessions`) | Yes | Yes | Covered |
| Marks List (`/exams/marks`) | Yes | Yes (dashboard + attendance invalidation) | Covered |
| Subscription by School (`/subscriptions`) | Yes | Yes (`invalidateSubscriptionCache`) | Covered |
| Subscription Plans (`/admin/subscription-plans`, active plans) | Yes | Yes | Covered |
| Subscription Metrics (`/admin/subscription-metrics/:schoolId`) | Yes | Yes | Covered |
| Notifications Templates (`/notifications/templates`) | Yes | Yes | Covered |
| Notifications Logs (`/notifications/logs`) | Yes | Yes | Covered |
| Notifications Summary (`/notifications/summary`) | Yes | Yes | Covered |
| Audit Logs (`/audit-logs`) | Yes | Yes (`cache:audit_logs:*`) | Covered |
| Themes List/Active (`/themes`, `/themes/active`) | Yes | Yes (`invalidateThemeCache`) | Covered |
| Parent CRUD (`/students/parents*`) | N/A | Yes (student cache invalidation) | Partially covered |
| Parent Portal (`/parent-portal/*`) | Not yet | Not fully mapped | Gap |

## Verified Invalidation Hooks (Observed)

- School writes invalidate school + subscription + dashboard-affecting keys
- Student writes invalidate student list/detail and dashboard/attendance keys
- Teacher writes invalidate teacher list/detail and dashboard keys
- Attendance mark/override/approval invalidate attendance summary/dashboard
- Marks writes invalidate dashboard (+ attendance path where applicable)
- Subscription and plan writes invalidate plan lists and per-school subscription keys
- Theme writes invalidate themes list/active keys
- Notification writes invalidate summary/log/template keys

## Gaps / Follow-up Recommendations

1. Parent Portal cache coverage
   - Add explicit cache keys + invalidation for `/parent-portal/dashboard`, `/children`, `/attendance`, `/exams`, `/subjects`, `/timetable`, `/fees`.

2. Explicit endpoint mapping document
   - Maintain source-of-truth mapping: `route -> key -> invalidation triggers`.

3. Standardize cache headers
   - Ensure all cached endpoints consistently set `X-Cache`.

4. Redis degradation validation
   - Validate fallback behavior under Redis outage (BYPASS, no API failure).

5. Performance baseline doc
   - Capture p50/p95 for MISS vs HIT on top 10 endpoints.

## Quick Verification Commands

```bash
# Cached read (schools): first MISS, then HIT
curl -i "http://localhost:3000/api/v1/admin/schools?page=1&limit=20" -H "Authorization: Bearer $TOKEN" | grep -Ei 'HTTP/|X-Cache'
curl -i "http://localhost:3000/api/v1/admin/schools?page=1&limit=20" -H "Authorization: Bearer $TOKEN" | grep -Ei 'HTTP/|X-Cache'

# Invalidation check: write then read
curl -i -X PATCH "http://localhost:3000/api/v1/admin/schools/<SCHOOL_ID>" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"activeUsersCount":1}'
curl -i "http://localhost:3000/api/v1/admin/schools?page=1&limit=20" -H "Authorization: Bearer $TOKEN" | grep -Ei 'HTTP/|X-Cache'
```

