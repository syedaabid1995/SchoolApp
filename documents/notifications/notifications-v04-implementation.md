# Notifications & Messaging (V04) - Additive Implementation Spec

## Scope
Add event-driven notifications without modifying attendance/payroll core logic.
- Notification dispatch must respect per-role rate limits to prevent spam.

## UI Routes + Screens
- `/dashboard/notifications` (inbox/history)
- `/dashboard/settings/notifications` (role/channel preferences)
- `/dashboard/settings/messaging-services` (provider configuration visibility by role)
- `/dashboard/announcements` (optional broadcast management for admins)

## Additive API Endpoints
- `GET /api/v1/notifications`
- `GET /api/v1/notifications/summary`
- `PATCH /api/v1/notifications/:id/read`
- `GET /api/v1/notification-rules`
- `PATCH /api/v1/notification-rules`
- `POST /api/v1/announcements` (optional)
- `GET /api/v1/announcements`

## Notification Delivery Model
- `deliveryStatus`: `QUEUED | SENT | FAILED | READ`
- Delivery status is operational metadata only; it must not alter attendance/payroll decisions.

## Event Triggers
- Attendance pending (teacher/admin reminder)
- Leave approved/rejected
- Payslip generated/available
- Optional school announcement published

## Announcement Target Scope
- School-wide
- Role-based (e.g. teachers only)
- Class/section-based

## Migration + Rollback Plan
- Migration (if needed): additive `notification_rules` / `announcement_targets` tables.
- Rollback: disable notification features via flag; stop trigger dispatch; keep historical logs immutable.

## Permission Matrix Impact
| Role | View Notifications | Configure Rules | Announcements |
|---|---|---|---|
| SUPER_ADMIN | Yes (global) | Yes | Yes |
| SCHOOL_ADMIN | Yes (school) | Yes (school) | Yes (school) |
| TEACHER | Yes (self) | No | No |
| PARENT/STUDENT | Yes (self, if enabled) | No | No |

## Cache + Audit Impact
- Cache:
  - summary and paginated inbox endpoints
  - invalidate on new notification dispatch / read update
- Audit:
  - log rule updates, channel status changes, announcement create/publish

## Test Checklist
- API: list/summary/read flows
- Role: rule edit blocked for non-admin roles
- Tenant: cross-school data not visible
- Trigger: attendance/leave/payslip events create expected notifications
- Degradation: if messaging provider unavailable, app flow continues
