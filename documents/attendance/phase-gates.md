# Attendance Program Phase Gates

## Purpose
Define when to move from attendance core to future modules (LMS, Exams, Notifications, Analytics, Parent/Student Portal) using objective go/no-go checks.

---

## Gate 0 -> Gate 1 (Start Attendance P1 Build)

### Must be true
- `documents/attendance/route-map.md` approved
- `documents/attendance/attendance-prd.md` approved
- `documents/attendance/implementation-backlog.md` approved
- Architecture constraints accepted (`V01`, `V07`)

### No-Go if
- Role permissions are undefined
- Tenant isolation approach is unclear
- Audit requirement is not finalized

---

## Gate 1 -> Gate 2 (Attendance P1 Ready for Pilot)

### Must be true
- Teacher can mark student attendance only for assigned class/section
- Duplicate attendance prevention works
- Teacher self-attendance works
- Admin overview works
- Audit logs exist for create/update/lock actions
- API + role + tenant isolation test checklist passes

### Success metrics (minimum)
- 2+ schools pilot successfully
- <2% attendance submission failure rate
- No cross-school data leak defects

### No-Go if
- Any P1 endpoint bypasses permission checks
- Lock behavior can be bypassed without admin intent
- High-priority defects remain open

---

## Gate 2 -> Gate 3 (Attendance Stabilized; Eligible for P2/P3)

### Must be true
- Attendance policy config is active and used
- Date/timezone behavior validated for all pilot schools
- Operational support runbook exists
- Monitoring dashboards for attendance API errors exist
- Data correction process (manual/admin override) is documented

### Stability window
- Minimum 2 release cycles with no critical attendance regressions

---

## Future Module Start Triggers

## LMS (V02)
### Start only if
- Schools request assignment/content delivery in writing
- At least 30% teachers in active schools ask for digital distribution
- Attendance P1 remains stable for last 2 release cycles

## Exams (V03)
### Start only if
- Schools ask for structured exam scheduling + marks publishing
- Mark upload/report demand is recurring (not one-off)
- Attendance present/absent integration rules are finalized

## Notifications/Messaging (V04)
### Start only if
- Manual follow-ups are creating operational delays
- Event sources are stable (attendance/leave/payslip)
- Channel strategy (in-app/WA/SMS/email) is approved

## Analytics (V05)
### Start only if
- Admins ask trend questions repeatedly (not just raw lists)
- Data quality for attendance and payroll is accepted
- Read-only analytics scope is approved

## Parent/Student Portal (V06)
### Start only if
- Schools request parent transparency features
- Permission boundaries are finalized (view-only)
- Student/parent identity-link quality is validated

---

## Release Readiness Checklist (Any New Module)
- Migration plan + rollback plan included
- Permission matrix updated
- Cache impact reviewed
- Audit impact reviewed
- Tenant isolation tests added
- API contract changes documented (or explicitly none)
- Observability/logging updated

---

## Decision Template (Use Before Starting Any Module)
- Module:
- Trigger evidence:
- Dependencies satisfied:
- Risks:
- Go/No-Go decision:
- Approver:
- Date:
