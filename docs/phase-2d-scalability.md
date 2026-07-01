# Phase 2D Scalability Hardening

Phase 2D keeps Academify safe for the next scale step: around 10 schools on a VPS/Lightsail-style deployment.

This phase does not move the app to ECS/RDS and does not rewrite reporting. It adds bounded reads, query/index review, tenant regression coverage, and a safe migration plan.

## Pagination Standard

Default list behavior:

- Default limit: `50` rows.
- Default max limit: `100` rows.
- Import row errors max limit: `200` rows.
- Attendance session browsing default limit: `100`, max `200`.
- Cursor lists order by a stable pair such as `createdAt desc, id desc`.
- Existing admin endpoints that returned arrays still return arrays for compatibility and expose metadata in headers:
  - `X-Page-Limit`
  - `X-Next-Cursor`
  - `X-Has-Next-Page`
  - `X-Page`
  - `X-Total-Count`
  - `X-Total-Pages`

New APIs should prefer:

```json
{
  "data": [],
  "pageInfo": {
    "limit": 50,
    "nextCursor": "opaque-cursor",
    "hasNextPage": false
  }
}
```

## Fixed High-Volume Reads

| Area | File/function | Previous behavior | Phase 2D behavior |
| --- | --- | --- | --- |
| Students | `backend/src/modules/students/services/profile/student-profile.service.ts:listStudents` | Returned all matching students with nested list include | Cursor-paginated, default 50, max 100, stable ordering, array-compatible headers |
| Parents | `backend/src/controllers/parent.controller.ts:listParents` | Returned all linked parents and ignored admin search | Offset-paginated, default 50, max 100, tenant-scoped search |
| Imports | `backend/src/controllers/import.controller.ts:listImports` | Returned all import jobs | Cursor-paginated, default 50, max 100, raw file path stripped |
| Import errors | `backend/src/controllers/import.controller.ts:getImport/listImportErrors` | Single import detail embedded all errors; error list returned all rows | Detail embeds first 100 only; error list cursor-paginated, default 50, max 200 |
| Notifications | `backend/src/controllers/notification.controller.ts:listNotificationLogs` | Returned all notification logs for a school | Cursor-paginated, default 50, max 100 |
| Leave | `backend/src/controllers/leave.controller.ts:listLeaveApplications` | Returned all matching leave applications | Offset-paginated, default 50, max 100, total headers |
| Attendance sessions | `backend/src/controllers/attendance.controller.ts:listSessions` | Returned all sessions for requested range | Offset-paginated, default 100, max 200, max 45-day date window |
| Parent portal results | `backend/src/controllers/parentPortal.controller.ts` | Parent result/dashboard paths could read all historical marks | Caps on dashboard marks, exams, result marks, and fee invoices |

## Export And Report Safety

| Area | Phase 2D guard | Remaining follow-up |
| --- | --- | --- |
| Fee reports | Synchronous report source tables must stay under `5,000` rows and date ranges are capped to 370 days | Move heavy fee reports to background jobs with stored downloadable results |
| Audit exports | Existing 90-day export range remains; row cap now uses shared `10,000` maximum | Queue large platform-wide exports |
| Tenant data export | Synchronous school export fails above `5,000` rows in any major dataset and marks the job failed | Implement chunked/background compliance exports before large production tenants |
| Report PDF | Existing PDF export remains capped to 500 rows in report service | Keep PDF as summary/export preview, use CSV/background for large datasets |

## Endpoint Inventory

| Area | Risk | Fixed now | Follow-up |
| --- | --- | --- | --- |
| Students | High cardinality, nested include | Yes | Add frontend cursor controls when larger schools need full browsing |
| Teachers/staff | Existing pagination present for main staff list | Partially | Standardize helper usage in later cleanup |
| Parents | Parent list can grow with student population | Yes | Add UI pagination controls where needed |
| Attendance | Reports and sessions can grow quickly | Partially | Background attendance reports for term/year ranges |
| Marks/results | Parent portal and reports can grow by exam history | Partially | Add report-level cursoring for marks-heavy views |
| Fees/payments/invoices | Fee module has pagination in list paths; reports were in-memory | Partially | Background fee report worker |
| Notifications | Logs were unbounded | Yes | Add admin log paging UI if exposed |
| Homework | Existing list paths reviewed; index plan added | No direct code change | Add pagination if homework list grows beyond current UI needs |
| Imports | Jobs and row errors were unbounded | Yes | Add admin import history UI paging if exposed |
| Audit logs | Browsing already paginated; export row cap tightened | Partially | Queue large exports |
| Leave requests | List was unbounded | Yes | Add visible UI pagination later |
| Dormitory | Existing list paths can grow but are lower risk at 10 schools | No | Apply helper in a later pass |
| Parent portal | Child access enforced; marks read capped | Partially | Cursor/grouped result history if parent history becomes large |
| Dashboards | Existing counts and small limits mostly present | No direct code change | Load test dashboard endpoints in staging |
| Super admin lists | Schools/users/subscriptions already have page limits in service layer | No direct code change | Standardize response metadata |

## Tenant Isolation Coverage

Phase 2D adds regression tests for:

- Import row errors verifying the parent import job belongs to the requested school before reading child rows.
- Leave application list preserving `schoolId` filters with pagination.
- Parent portal rejecting another parent's child before marks/result child-table queries run.

Existing tests already cover signed student documents, staff/leave tenant scope, audit log scope, support tickets, compliance jobs, and report school scope.

## Query Safety Audit

Run:

```sh
npm --prefix backend run scalability:audit
```

The script is advisory in Phase 2D. It scans high-risk backend paths for `findMany` calls that do not show an obvious `take` or pagination helper nearby. It exits `0` so it can be used in CI as a warning before becoming a stricter gate.

Known blind spots:

- It is text-based, not AST-based.
- It may miss pagination delegated through helper functions outside the scan window.
- It may report safe low-cardinality lookup tables.

## Remaining Risks Before 10 Schools

- Real Docker/MinIO/S3 validation still needs a Docker-capable target environment.
- Heavy reports still run synchronously and should move to background jobs before larger tenants.
- Frontend pagination controls are not fully wired for every newly capped array-compatible endpoint.
- Existing production databases should create new indexes concurrently and out of band.
- Load testing has not been run in this phase.
