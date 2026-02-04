# PROMPT 2 — Discovery + Plan

## Scope
Repo analyzed: `backend/` (Node.js + Express + Prisma)
Goal: identify high-impact read endpoints, write dependencies, Redis key strategy, TTL matrix, and invalidation strategy.

## 1) Top 20 GET Endpoints by Expected Read Frequency / Cost

1. `GET /api/v1/admin/schools`
2. `GET /api/v1/admin/dashboard`
3. `GET /api/v1/students/students`
4. `GET /api/v1/students/students/:id`
5. `GET /api/v1/teachers`
6. `GET /api/v1/teachers/:id`
7. `GET /api/v1/notifications/summary`
8. `GET /api/v1/attendance-summary`
9. `GET /api/v1/exams`
10. `GET /api/v1/exams/marks`
11. `GET /api/v1/themes/active`
12. `GET /api/v1/subscriptions`
13. `GET /api/v1/subscriptions/plans`
14. `GET /api/v1/admin/subscription-plans`
15. `GET /api/v1/admin/subscription-metrics/:schoolId`
16. `GET /api/v1/audit-logs`
17. `GET /api/v1/parent-portal/dashboard`
18. `GET /api/v1/parent-portal/children`
19. `GET /api/v1/parent-portal/attendance`
20. `GET /api/v1/parent-portal/exams`

## 2) Writes that Affect Each Domain

- **Schools/Admin Directory**
  - `POST/PATCH/DELETE /api/v1/admin/schools*`
  - `POST/PATCH /api/v1/admin/schools/:id/admins*`
  - subscription write endpoints that change plan/status

- **Admin Dashboard / Analytics**
  - student CRUD/status/transfer
  - teacher CRUD/status/assignment
  - attendance mark/override/approve/reject/session lifecycle
  - marks upload/moderation/revaluation

- **Students List/Detail**
  - `POST/PATCH/DELETE /api/v1/students/students*`
  - photo add/delete
  - parent link/unlink
  - status and transfer accept/reject

- **Teachers List/Detail**
  - `POST/PATCH/DELETE /api/v1/teachers*`
  - assignment/status updates

- **Attendance Summary**
  - session start/close
  - attendance record writes and overrides
  - approval/rejection updates

- **Marks / Exams**
  - exam CRUD
  - exam paper create
  - marks upload/moderate/revaluation

- **Notifications**
  - template create/update
  - send notification
  - ticket updates and system event generation

- **Subscriptions / Plans / Metrics**
  - subscription upsert/update
  - plan CRUD
  - school status changes that affect subscriptions

- **Themes**
  - create/update/publish/rollback theme endpoints

- **Audit Logs**
  - all write paths that log audited mutations

## 3) Proposed Redis Key Patterns

Use tenant + permission + query fingerprint scoping.

- `cache:schools:list:{queryFp}`
- `cache:schools:{schoolId}:admins`
- `cache:admin_dashboard:{schoolId}`
- `cache:analytics:weekly:{schoolId}`
- `cache:analytics:performance:{schoolId}`
- `cache:students:{schoolId}:list:{queryFp}`
- `cache:students:{schoolId}:detail:{studentId}`
- `cache:teachers:{schoolId}:list:{queryFp}`
- `cache:teachers:{schoolId}:detail:{teacherId}`
- `cache:attendance:{schoolId}:summary:{queryFp}`
- `cache:marks:{schoolId}:list:{queryFp}`
- `cache:notifications:summary:{schoolId|na}:{role}:{userId}`
- `cache:notifications:logs:{queryFp}`
- `cache:notifications:templates`
- `cache:subscription:{schoolId}`
- `cache:subscription_metrics:{schoolId}`
- `cache:subscription_plans:all`
- `cache:subscription_plans:active`
- `cache:themes:{schoolId}:list`
- `cache:themes:{schoolId}:active`
- `cache:audit_logs:{queryFp}`

Parent-portal extension keys:
- `cache:parent:{parentUserId}:children`
- `cache:parent:{parentUserId}:dashboard:{childId}:{academicYear}`
- `cache:parent:{parentUserId}:attendance:{childId}:{month}`
- `cache:parent:{parentUserId}:exams:{childId}:{queryFp}`

## 4) TTL Matrix

- Notifications summary/logs: `30s`
- Attendance summary: `45s`
- Dashboard + analytics: `60s`
- Subscriptions + metrics: `60s`
- Students + teachers list/detail: `90s`
- Schools list/admins: `120s`
- Themes active/list: `120s`
- Audit logs list: `30-60s`
- Parent-portal dashboard/attendance/exams: `45-90s`

## 5) Invalidation Strategy Matrix

- **Student writes** -> invalidate student list/detail, dashboard, attendance/marks derivatives, parent portal child keys.
- **Teacher writes** -> invalidate teacher list/detail, dashboard analytics.
- **Attendance writes** -> invalidate attendance summary and dashboard keys.
- **Marks/Exam writes** -> invalidate marks list keys and dashboard analytics keys.
- **School/Admin writes** -> invalidate schools list, school-admin list, school subscription keys, dashboard keys.
- **Subscription/Plan writes** -> invalidate plan lists, subscription-by-school, metrics, schools list.
- **Theme writes** -> invalidate themes list + active theme.
- **Notification writes** -> invalidate templates/logs/summary keys.
- **Audit writes** -> invalidate audit log query keys.

---

Approval checkpoint: Discovery + plan complete.
Next step: maintain endpoint-by-endpoint coverage map and close remaining gaps.
