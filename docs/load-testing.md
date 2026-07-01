# Load Testing Plan

Do not run load tests against production. Use staging or a disposable VPS with production-like Postgres and Redis settings.

## Target Profile

Initial Phase 2D target:

- 10 schools.
- 300 to 800 students per school.
- 20 to 60 staff users per school.
- 2 to 4 API processes.
- 1 worker process.
- 1 scheduler process.
- PostgreSQL and Redis running with production-like persistence.

## Tools

Recommended:

- `k6` for scenario-based HTTP traffic.
- `autocannon` for quick single-endpoint checks.
- `Artillery` if the team prefers YAML scenario definitions.

Use placeholders for credentials:

```text
ACADEMIFY_BASE_URL=https://staging.example.com
ACADEMIFY_SCHOOL_ADMIN_EMAIL=school-admin@example.com
ACADEMIFY_SCHOOL_ADMIN_PASSWORD=<staging-password>
ACADEMIFY_PARENT_EMAIL=parent@example.com
ACADEMIFY_PARENT_PASSWORD=<staging-password>
```

## Scenarios

| Scenario | Goal | Notes |
| --- | --- | --- |
| Login burst | Validate auth latency and rate limits | 50 to 100 logins over 1 minute using staging-only accounts |
| Morning attendance submission | Simulate teachers marking attendance at the same time | Use small class fixtures first, then 10 schools |
| Parent dashboard access | Validate child scoping and parent portal response time | Mix dashboard, attendance, fees, and results paths |
| Teacher dashboard access | Validate dashboard counts and timetable/attendance reads | Include repeated refreshes |
| Student list pagination | Verify new cursor limits and stable response time | Fetch first page and next cursor only |
| Parent list search | Verify tenant-scoped search with pagination | Use common name and phone fragments |
| Attendance report date range | Validate 7-day and 30-day reads | Do not exceed the API's 45-day browsing cap |
| Fee invoice list | Validate common school admin fee browsing | Include status and student filters |
| Fee report export guard | Confirm oversized reports fail with 413 | Do not attempt large synchronous exports repeatedly |
| Homework signed download | Validate signed access without exposing raw storage paths | Use staging objects only |
| Audit log browsing | Validate paginated audit list | Use school-scoped and super-admin paths |
| Export job creation/download | Validate runtime storage signed download flow | Use small export fixtures only |

## Success Criteria

For a 10-school staging test:

- API p95 below 800 ms for list/dashboard endpoints under normal load.
- Auth p95 below 1.5 s during bursts.
- Error rate below 1 percent, excluding intentional 401/403/413 checks.
- No duplicate scheduler executions.
- Worker queues drain after import/notification/report jobs.
- PostgreSQL CPU, lock waits, and slow queries stay within acceptable staging thresholds.
- Redis memory and connection counts remain stable.

## Safe Process

1. Seed staging data with fake users and fake school data.
2. Run a smoke test at 1 virtual user.
3. Run a 5-minute baseline at 10 virtual users.
4. Run a 10-school scenario at 50 to 100 virtual users.
5. Review API logs, PostgreSQL slow query logs, Redis metrics, and queue depth.
6. Apply missing indexes or query caps in a new phase only after reviewing query plans.

## Explicit Non-Goals

- Do not mutate production data.
- Do not use real student, parent, staff, or school data.
- Do not run destructive database resets.
- Do not stress object storage with real private files.
- Do not bypass rate limits to force artificial peak numbers.
