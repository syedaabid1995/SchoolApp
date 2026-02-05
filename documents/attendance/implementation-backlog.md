# Attendance Implementation Backlog (P1 / P2 / P3)

## P1 — Foundation + MVP (Ship First)

### Backend
- Create student attendance session + records
- Teacher self-attendance create/list
- Assignment guard middleware for student attendance mark
- Attendance status enums + DB models
- Basic summary APIs (daily/class-wise)
- Audit logs for create/update/lock

### Frontend
- Student attendance mark screen (context selector + table)
- Teacher self-attendance screen
- Admin attendance overview (read-only summary)
- Basic error/loading/empty states

### Done Criteria
- Teacher marks attendance for assigned class only
- Admin sees summary
- Duplicate marking prevented

---

## P2 — Leave + Lock + Edit Workflow

### Backend
- Leave type CRUD
- Leave request apply/list/approve/reject
- Attendance lock/unlock endpoints
- Retro-edit request and approval endpoints
- Holiday calendar APIs

### Frontend
- Leave apply form and list
- Admin leave inbox
- Lock/unlock controls in attendance
- Edit request flow UI
- Calendar integration in attendance screens

### Done Criteria
- Leave approval updates attendance behavior
- Locked periods block regular edits
- Retro edits need approval

---

## P3 — Payroll + Payslips + Reporting

### Backend
- Payroll settings (cutoff, OT, LOP rules)
- Payroll run generation pipeline
- Payslip entity + PDF endpoint
- Attendance and payroll export endpoints

### Frontend
- Payroll settings page
- Payroll run page (month/year)
- Payslip list + detail + download
- Attendance/payroll reports with export

### Done Criteria
- Admin generates payroll for month
- Teachers can view/download payslip
- CSV/PDF exports available

---

## Cross-Cutting Tasks
- Role-based permission checks for each endpoint/screen
- Tenant safety (`schoolId`) everywhere
- Notification rules (leave, attendance pending, payslip ready)
- Performance tuning (indexes, pagination, report queries)
- QA checklist + seeded test data

## Suggested Delivery Cadence
- Sprint 1: P1
- Sprint 2: P2
- Sprint 3: P3

## Risks
- Policy ambiguity per school -> solve via attendance policy config early
- Payroll formula disputes -> freeze calculation contract before P3
- Retro edits abuse -> enforce approval + audit with reason mandatory
