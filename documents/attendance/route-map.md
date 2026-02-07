# Attendance Module Route Map

## Scope
- Student attendance (teacher-marked, class-assigned only)
- Teacher attendance (self + admin view)
- Leave management
- Payroll and payslips
- Shared policy/configuration

## Frontend Routes (Next.js)

### Teacher-facing
- `/dashboard/attendance/students/mark`
- `/dashboard/attendance/students/history`
- `/dashboard/attendance/my`
- `/dashboard/leave/my`
- `/dashboard/leave/my/apply`
- `/dashboard/payslips/my`

### School admin-facing
- `/dashboard/attendance/students/overview`
- `/dashboard/attendance/students/locks`
- `/dashboard/attendance/staff`
- `/dashboard/attendance/staff/requests`
- `/dashboard/leave/requests`
- `/dashboard/leave/types`
- `/dashboard/payroll/settings`
- `/dashboard/payroll/run`
- `/dashboard/payslips`
- `/dashboard/settings/attendance-policy`
- `/dashboard/settings/academic-calendar`
- `/dashboard/reports/attendance`
- `/dashboard/reports/payroll`

### Super admin-facing
- `/dashboard/super/attendance/policies`
- `/dashboard/super/attendance/audit`

## API Routes (Express)

### Student attendance
- `POST /api/v1/attendance/student/sessions`
- `PATCH /api/v1/attendance/student/sessions/:sessionId`
- `POST /api/v1/attendance/student/sessions/:sessionId/lock`
- `GET /api/v1/attendance/student/sessions`
- `GET /api/v1/attendance/student/summary`
- `GET /api/v1/attendance/student/:studentId/history`

### Teacher attendance
- `POST /api/v1/attendance/teacher/self`
- `GET /api/v1/attendance/teacher/self`
- `GET /api/v1/attendance/teacher/register`
- `PATCH /api/v1/attendance/teacher/:attendanceId`

### Attendance edit workflow
- `POST /api/v1/attendance/requests`
- `GET /api/v1/attendance/requests`
- `PATCH /api/v1/attendance/requests/:requestId/approve`
- `PATCH /api/v1/attendance/requests/:requestId/reject`

### Leave management
- `GET /api/v1/leave/types`
- `POST /api/v1/leave/types`
- `PATCH /api/v1/leave/types/:id`
- `POST /api/v1/leave/requests`
- `GET /api/v1/leave/requests`
- `PATCH /api/v1/leave/requests/:id/approve`
- `PATCH /api/v1/leave/requests/:id/reject`
- `GET /api/v1/leave/balance/:userId`

### Payroll and payslips
- `GET /api/v1/payroll/settings`
- `PATCH /api/v1/payroll/settings`
- `POST /api/v1/payroll/run`
- `GET /api/v1/payroll/runs`
- `GET /api/v1/payslips`
- `GET /api/v1/payslips/:id`
- `GET /api/v1/payslips/:id/pdf`

### Policies and calendar
- `GET /api/v1/attendance/policy`
- `PATCH /api/v1/attendance/policy`
- `GET /api/v1/calendar/holidays`
- `POST /api/v1/calendar/holidays`
- `PATCH /api/v1/calendar/holidays/:id`

### Reports/exports
- `GET /api/v1/reports/attendance`
- `GET /api/v1/reports/attendance/export`
- `GET /api/v1/reports/payroll`
- `GET /api/v1/reports/payroll/export`

## Access Matrix (High-Level)
- Teacher: student mark (assigned only), self attendance, leave apply, own payslip view
- School admin: full school attendance ops, leave approvals, payroll run/settings
- Super admin: global visibility/audit, no school-level day-to-day marking
- Parent/student: view-only student attendance (if enabled by product scope)

## Page-to-API Contract Map

### `/dashboard/attendance/students/mark`
- Components: `ContextSelector`, `AttendanceStatusLegend`, `BulkActionBar`, `StudentAttendanceGrid`, `FooterActionBar`, `LockStatusBadge`, `AuditTooltip`
- APIs:
  - `GET /api/v1/attendance/student/sessions` (load existing session)
  - `POST /api/v1/attendance/student/sessions` (create/submit)
  - `PATCH /api/v1/attendance/student/sessions/:sessionId` (save draft/update)
  - `POST /api/v1/attendance/student/sessions/:sessionId/lock` (lock)

### `/dashboard/attendance/students/history`
- Components: `DateRangeFilter`, `ClassSectionFilter`, `AttendanceSessionList`, `SessionDetailDrawer`, `EditRequestButton`
- APIs:
  - `GET /api/v1/attendance/student/sessions`
  - `POST /api/v1/attendance/requests` (retro edit request)

### `/dashboard/attendance/students/overview`
- Components: `SummaryCards`, `ClassAttendanceTable`, `QuickActions`, `DrilldownLink`
- APIs:
  - `GET /api/v1/attendance/student/summary`
  - `GET /api/v1/attendance/student/sessions`
  - `POST /api/v1/attendance/student/sessions/:sessionId/lock`

### `/dashboard/attendance/students/locks`
- Components: `DateSelector`, `LockMatrixTable`, `UnlockModal`, `AuditTrailPanel`
- APIs:
  - `GET /api/v1/attendance/student/sessions`
  - `POST /api/v1/attendance/student/sessions/:sessionId/lock`
  - `PATCH /api/v1/attendance/student/sessions/:sessionId` (unlock action with reason payload)

### `/dashboard/attendance/my`
- Components: `TodayStatusCard`, `AttendanceCalendar`, `MarkAttendanceModal`, `HistoryDrawer`, `SourceBadge`
- APIs:
  - `POST /api/v1/attendance/teacher/self`
  - `GET /api/v1/attendance/teacher/self`

### `/dashboard/attendance/staff`
- Components: `StaffFilterBar`, `StaffAttendanceTable`, `InlineEdit`, `OverrideBadge`, `AuditPopover`
- APIs:
  - `GET /api/v1/attendance/teacher/register`
  - `PATCH /api/v1/attendance/teacher/:attendanceId`

### `/dashboard/attendance/staff/requests`
- Components: `RequestList`, `RequestDetailPanel`, `ApproveRejectActions`, `DecisionAuditLog`
- APIs:
  - `GET /api/v1/attendance/requests`
  - `PATCH /api/v1/attendance/requests/:requestId/approve`
  - `PATCH /api/v1/attendance/requests/:requestId/reject`

### `/dashboard/leave/my/apply`
- Components: `LeaveTypeSelector`, `DateRangePicker`, `ReasonTextarea`, `AttachmentUploader`, `SubmitButton`
- APIs:
  - `GET /api/v1/leave/types`
  - `POST /api/v1/leave/requests`

### `/dashboard/leave/my`
- Components: `LeaveBalanceCards`, `LeaveRequestTable`, `StatusBadge`, `CancelRequestAction`
- APIs:
  - `GET /api/v1/leave/requests` (teacher-scoped)
  - `GET /api/v1/leave/balance/:userId`

### `/dashboard/leave/requests`
- Components: `PendingCountSummary`, `LeaveRequestList`, `ConflictIndicator`, `SubstitutionAssignmentModal`, `ApproveRejectActions`
- APIs:
  - `GET /api/v1/leave/requests` (admin-scoped)
  - `PATCH /api/v1/leave/requests/:id/approve`
  - `PATCH /api/v1/leave/requests/:id/reject`

### `/dashboard/leave/types`
- Components: `LeaveTypeTable`, `AccrualConfigDrawer`, `EditTypeModal`
- APIs:
  - `GET /api/v1/leave/types`
  - `POST /api/v1/leave/types`
  - `PATCH /api/v1/leave/types/:id`

### `/dashboard/payroll/settings`
- Components: `PayrollPeriodConfig`, `CutoffDateSelector`, `OTRuleConfig`, `LOPRuleConfig`, `LockWarningBanner`
- APIs:
  - `GET /api/v1/payroll/settings`
  - `PATCH /api/v1/payroll/settings`

### `/dashboard/payroll/run`
- Components: `MonthYearSelector`, `PreRunChecklist`, `RunPayrollButton`, `RunStatusStepper`, `ResultSummary`
- APIs:
  - `POST /api/v1/payroll/run`
  - `GET /api/v1/payroll/runs`

### `/dashboard/payslips`
- Components: `PayslipFilter`, `PayslipTable`, `DownloadActions`, `PublishToggle`
- APIs:
  - `GET /api/v1/payslips`
  - `GET /api/v1/payslips/:id`
  - `GET /api/v1/payslips/:id/pdf`

### `/dashboard/payslips/my`
- Components: `MyPayslipList`, `PayslipDetailDrawer`, `DownloadPDF`
- APIs:
  - `GET /api/v1/payslips` (teacher-scoped)
  - `GET /api/v1/payslips/:id/pdf`

### `/dashboard/settings/attendance-policy`
- Components: `WorkingDaysSelector`, `LateRulesConfig`, `EditWindowConfig`, `SelfAttendanceToggle`, `SaveWithAuditModal`
- APIs:
  - `GET /api/v1/attendance/policy`
  - `PATCH /api/v1/attendance/policy`

### `/dashboard/settings/academic-calendar`
- Components: `HolidayCalendar`, `HolidayForm`, `WorkingOverrideToggle`
- APIs:
  - `GET /api/v1/calendar/holidays`
  - `POST /api/v1/calendar/holidays`
  - `PATCH /api/v1/calendar/holidays/:id`

### `/dashboard/reports/attendance`
- Components: `AdvancedFilterPanel`, `SummaryCharts`, `ResultTable`, `ExportMenu`
- APIs:
  - `GET /api/v1/reports/attendance`
  - `GET /api/v1/reports/attendance/export`

### `/dashboard/reports/payroll`
- Components: `MonthFilter`, `CostSummary`, `PayrollTable`, `ExportMenu`
- APIs:
  - `GET /api/v1/reports/payroll`
  - `GET /api/v1/reports/payroll/export`

## Shared Cross-Cutting Components
- `PermissionGuard`
- `LockStatusBadge`
- `AuditPopover`
- `OfflineDraftBanner`
- `ErrorStatePanel`
- `EmptyState`
- `UnsavedChangesGuard`
- `SubmissionConflictModal`
- `TimezoneBanner`
- `SchoolSwitcher` (super admin pages)
