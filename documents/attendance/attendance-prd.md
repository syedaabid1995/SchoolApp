# Attendance + Leave + Payroll PRD

## 1) Objective
Deliver a school-grade attendance system where:
- Teachers mark student attendance only for assigned classes.
- Teachers manage their own attendance and leave.
- School admins approve leaves and run payroll.
- Payslips are generated and downloadable.

## 2) Core Rules

### Student attendance
- No student login required for marking.
- Only assigned teacher can mark for class/section/date/session.
- One attendance status per student per session.
- Statuses: `PRESENT`, `ABSENT`, `LATE`, `HALF_DAY`, `LEAVE`.
- Locking supported (teacher lock + admin override).

### Teacher attendance
- Teachers can mark own attendance (date constrained by policy).
- Admin can correct with audit trail.
- Source metadata captured: `MANUAL`, `MOBILE`, `BIOMETRIC`, `ADMIN_OVERRIDE`.

### Leave
- Leave types configurable per school.
- Apply -> Approve/Reject flow.
- Leave balances and accrual policy configurable.
- Approved leave auto-reflects in attendance.

### Payroll/payslip
- Payroll period, cutoff and lock configurable.
- Gross/allowances/deductions/OT/LOP calculated per run.
- Payslip PDF export available to teacher/admin.

## 3) User Stories

### Teacher
- Mark student attendance for assigned classes.
- Mark self attendance.
- Apply leave and track status.
- View/download own payslips.

### School admin
- Manage attendance policies and calendar.
- Monitor class-wise and staff attendance.
- Approve/reject leave requests.
- Process payroll and publish payslips.
- Manage lock/unlock with audit reason.

### Super admin
- Review cross-school attendance and payroll health.
- Access audit and policy compliance views.

## 4) UI Components
- Context selector (year/date/class/section/session)
- Student attendance grid with quick actions
- Staff attendance register
- Leave inbox and leave type manager
- Payroll run wizard and payslip list
- Attendance/policy settings panels
- Reports + export panels

## 5) Data and Audit Requirements
- Every attendance mutation must store actor, timestamp, source, previous value.
- Policy changes and lock/unlock must create audit entries.
- Payroll runs are immutable after lock unless explicit reopen by admin.

## 6) Validation and Guardrails
- Class assignment check before student mark.
- No duplicate attendance rows for same student/date/session.
- Future date restrictions based on policy.
- Retro edits require approval request flow.
- Holiday calendar blocks normal marking unless admin override.

## 7) Notifications
- Teacher reminder when attendance not submitted.
- Leave approval/rejection notifications.
- Payroll generated notification to staff.
- Late attendance summary alert (optional).

## 8) Non-Functional Requirements
- Tenant isolation by `schoolId`.
- Pagination/filtering on all list APIs.
- Export performance for monthly reports.
- Consistent timezone handling per school.

## 9) Acceptance Criteria (MVP)
- Teacher can mark and submit student attendance for assigned classes.
- School admin can review summary and lock day records.
- Teacher can submit leave; admin can approve/reject.
- Payroll can be generated monthly and payslip downloaded.
- Audit trail exists for all write operations.
