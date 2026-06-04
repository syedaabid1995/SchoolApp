# Document 10 - Reports & Analytics Documentation

Generated from repository code on 2026-06-04. Source root: `/Users/syedaabidahamedarshad/Documents/TechStageIT/SchoolApp`.

## Report and Dashboard Surfaces

| Report / Dashboard | API / Service Evidence | Tables / Models Likely Used From Implementation Names | Roles |
|---|---|---|---|
| Platform dashboard metrics, growth, revenue, activity, support summary, top schools, system status | `admin/services/adminDashboard.service.ts`, `backend/src/controllers/adminDashboard.controller.ts`, `backend/src/services/adminDashboard.service.ts` | School, Subscription, SupportTicket, AuditLog | SUPER_ADMIN |
| School analytics | `admin/services/analytics.service.ts`, `backend/src/routes/analytics.routes.ts` | Student, Attendance, Fee, Exam-related models | SCHOOL_ADMIN |
| General reports page | `admin/app/dashboard/reports/page.tsx`, `backend/src/routes/report.routes.ts` | Marks, attendance, fees, platform metrics | SUPER_ADMIN, SCHOOL_ADMIN |
| Student attendance report | `admin/services/student-operations.service.ts` -> `/students/attendance/report` | StudentAttendance, Student | SCHOOL_ADMIN |
| Attendance summary | `admin/services/attendance.service.ts` -> `/attendance-summary` | AttendanceSession, AttendanceRecord, StudentAttendance* | SCHOOL_ADMIN |
| Fee reports | `admin/services/fee-management.service.ts` -> `/fees/reports` | FeeInvoice, FeePayment, FeeLedger, FeeDiscount, FeeFine | SCHOOL_ADMIN, ACCOUNTANT permission |
| Payroll report | `admin/app/dashboard/payroll/report/page.tsx`, staff/payroll services | Payroll, PayrollPayment, StaffPayrollInfo | SCHOOL_ADMIN, payroll permissions |
| Transport report | `admin/services/transport.service.ts` -> `/transport/report` | TransportRoute, TransportVehicle, StudentTransportAssignment | SCHOOL_ADMIN |
| Dormitory report | `admin/services/dormitory.service.ts` -> `/dormitories/report` | Dormitory, DormitoryRoom, StudentDormitoryAssignment | SCHOOL_ADMIN |
| Homework evaluation report | `admin/services/homework.service.ts` -> `/homework/evaluation-report` | Homework, HomeworkEvaluation | SCHOOL_ADMIN, TEACHER permission |
| Library issued report | `admin/services/library.service.ts` -> `/library/issued` | LibraryIssue, LibraryBook, LibraryMember | SCHOOL_ADMIN, LIBRARIAN permission |
| Audit exports | `backend/src/routes/auditLog.routes.ts`, `AuditExport` model | AuditLog, AuditExport | SUPER_ADMIN |

## Known Gaps

Admin dashboard service contains TODOs for trial lifecycle, billing invoice/payment models, waiting ticket status, storage accounting, queue metrics, S3 health, and email provider health checks. Rank card generation is explicitly not implemented.
