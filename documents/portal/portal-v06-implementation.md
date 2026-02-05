# Parent / Student Portal (V06) - Additive Implementation Spec

## Scope
Add read-only parent/student portal experiences that consume existing attendance/exam/notification data.
- Portal authentication reuses existing identity and role mapping; no separate auth system is introduced.
- Optional exports (if enabled) must reuse existing report/export mechanisms.

## UI Routes + Screens
- `/dashboard/portal/attendance`
- `/dashboard/portal/results`
- `/dashboard/portal/notifications`
- `/dashboard/portal/students` (for parents with multiple children)

## Additive API Endpoints
- `GET /api/v1/portal/attendance`
- `GET /api/v1/portal/results`
- `GET /api/v1/portal/notifications`
- `GET /api/v1/portal/students`

## Constraints
- No attendance write access for parent/student.
- No changes to teacher/admin attendance workflows.
- Parent may map to multiple students; responses must be scoped to linked students only.

## Migration + Rollback Plan
- Prefer reusing existing linkage models.
- If additional mapping tables are needed, keep additive with strict FK.
- Rollback: disable portal feature flags; preserve data integrity.

## Permission Matrix Impact
| Role | Attendance View | Results View | Notifications View | Write Access |
|---|---|---|---|---|
| PARENT | Linked students only | Linked students only | Self | No |
| STUDENT | Self only | Self only | Self | No |
| TEACHER/ADMIN | Existing dashboards | Existing dashboards | Existing dashboards | Existing only |

## Cache + Audit Impact
- Cache read-heavy portal endpoints by `schoolId + userId (+ studentId)`.
- Invalidate on new result publication and notification dispatch.
- Audit link/unlink actions for parent-student mapping administration.

## Test Checklist
- API: portal views return only allowed data
- Role: parent/student cannot access write endpoints
- Tenant: no cross-school visibility
- Multi-child parent filtering works
- Parent cannot access unlinked child data even within the same school
- Cache keys are user-scoped; no data leak between families
