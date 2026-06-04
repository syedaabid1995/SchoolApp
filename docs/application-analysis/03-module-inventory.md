# Document 3 - Module Inventory

Generated from repository code on 2026-06-04. Source root: `/Users/syedaabidahamedarshad/Documents/TechStageIT/SchoolApp`.

## Platform Administration

| Field | Value |
|---|---|
| Purpose | Schools, users, subscriptions, platform support, audit, system health |
| Associated APIs | `/api/v1/admin/*` |
| Database Tables | `School`, `User`, `Subscription`, `SubscriptionPlanDef`, `AuditLog`, `SupportTicket`, `BackupJob`, `RestoreJob` |
| User Roles | SUPER_ADMIN |
| Dependencies | Authentication, tenant school scope where school-owned, Prisma models listed above |
| Business Rules | See Document 9 for rules extracted from middleware/services/controllers. |
| Validation Rules | Implemented in controllers/services and selected Zod validation files under `backend/src/validations`. |
| Notifications Triggered | Where code calls notification service/dispatcher or notification logs; see Document 11. |
| Reports Generated | See Document 10. |

## Authentication & Security

| Field | Value |
|---|---|
| Purpose | Login, refresh/logout, MFA, TOTP, sessions, password reset |
| Associated APIs | `/api/v1/auth/*` |
| Database Tables | `User`, `RefreshSession`, `PasswordResetToken`, `MfaChallenge`, `TotpCredential`, `TotpBackupCode` |
| User Roles | All authenticated roles |
| Dependencies | Authentication, tenant school scope where school-owned, Prisma models listed above |
| Business Rules | See Document 9 for rules extracted from middleware/services/controllers. |
| Validation Rules | Implemented in controllers/services and selected Zod validation files under `backend/src/validations`. |
| Notifications Triggered | Where code calls notification service/dispatcher or notification logs; see Document 11. |
| Reports Generated | See Document 10. |

## Institution Setup & Branding

| Field | Value |
|---|---|
| Purpose | School profile, settings, themes, login experience, messaging configuration |
| Associated APIs | `/api/v1/system-settings, /api/v1/themes, /api/v1/features, /api/v1/messaging-services` |
| Database Tables | `School`, `Theme`, `ThemeHistory`, `ConfigEntry`, `SchoolSystemSetting`, `MessagingService`, `SchoolMessagingConfig` |
| User Roles | SCHOOL_ADMIN, SUPER_ADMIN |
| Dependencies | Authentication, tenant school scope where school-owned, Prisma models listed above |
| Business Rules | See Document 9 for rules extracted from middleware/services/controllers. |
| Validation Rules | Implemented in controllers/services and selected Zod validation files under `backend/src/validations`. |
| Notifications Triggered | Where code calls notification service/dispatcher or notification logs; see Document 11. |
| Reports Generated | See Document 10. |

## Academics & Timetable

| Field | Value |
|---|---|
| Purpose | Academic years, terms, classes, sections, subjects, rooms, periods, routines, timetable versions |
| Associated APIs | `/api/v1/academics, /api/v1/academic-setup` |
| Database Tables | `AcademicYear`, `Term`, `Class`, `Section`, `Subject`, `ClassRoom`, `TimePeriod`, `ClassRoutine`, `TimetableVersion`, `TimetableEntry` |
| User Roles | SCHOOL_ADMIN, TEACHER read/self |
| Dependencies | Authentication, tenant school scope where school-owned, Prisma models listed above |
| Business Rules | See Document 9 for rules extracted from middleware/services/controllers. |
| Validation Rules | Implemented in controllers/services and selected Zod validation files under `backend/src/validations`. |
| Notifications Triggered | Where code calls notification service/dispatcher or notification logs; see Document 11. |
| Reports Generated | See Document 10. |

## Student Information

| Field | Value |
|---|---|
| Purpose | Student CRUD, parents, photos, documents, groups, categories, promotion, transfers, disabled students |
| Associated APIs | `/api/v1/students/*` |
| Database Tables | `Student`, `ParentGuardian`, `StudentParent`, `StudentEnrollment`, `StudentGroup`, `StudentCategory`, `StudentPromotion`, `StudentTransferRequest`, `StudentDocument`, `StudentTimeline` |
| User Roles | SCHOOL_ADMIN |
| Dependencies | Authentication, tenant school scope where school-owned, Prisma models listed above |
| Business Rules | See Document 9 for rules extracted from middleware/services/controllers. |
| Validation Rules | Implemented in controllers/services and selected Zod validation files under `backend/src/validations`. |
| Notifications Triggered | Where code calls notification service/dispatcher or notification logs; see Document 11. |
| Reports Generated | See Document 10. |

## Attendance & Leave

| Field | Value |
|---|---|
| Purpose | Student attendance, attendance sessions, approvals, teacher self attendance, substitutions, staff attendance, leave workflow |
| Associated APIs | `/api/v1/attendance, /api/v1/students/attendance, /api/v1/leave` |
| Database Tables | `StudentAttendance`, `StudentAttendanceSession`, `StudentAttendanceRecord`, `AttendanceSession`, `AttendanceRecord`, `TeacherSelfAttendance`, `StaffAttendance`, `LeaveApplication`, `LeaveStatusHistory` |
| User Roles | SCHOOL_ADMIN, TEACHER, STAFF via permissions |
| Dependencies | Authentication, tenant school scope where school-owned, Prisma models listed above |
| Business Rules | See Document 9 for rules extracted from middleware/services/controllers. |
| Validation Rules | Implemented in controllers/services and selected Zod validation files under `backend/src/validations`. |
| Notifications Triggered | Where code calls notification service/dispatcher or notification logs; see Document 11. |
| Reports Generated | See Document 10. |

## Teachers & Staff / Payroll

| Field | Value |
|---|---|
| Purpose | Teacher and staff profiles, assignments, documents, timeline, attendance, payroll |
| Associated APIs | `/api/v1/teachers, /api/v1/staff, /api/v1/teacher-assignments` |
| Database Tables | `TeacherProfile`, `Department`, `Designation`, `StaffPayrollInfo`, `TeacherClassAssignment`, `TeacherSubjectAssignment`, `Payroll`, `PayrollPayment` |
| User Roles | SCHOOL_ADMIN, employee roles via permissions |
| Dependencies | Authentication, tenant school scope where school-owned, Prisma models listed above |
| Business Rules | See Document 9 for rules extracted from middleware/services/controllers. |
| Validation Rules | Implemented in controllers/services and selected Zod validation files under `backend/src/validations`. |
| Notifications Triggered | Where code calls notification service/dispatcher or notification logs; see Document 11. |
| Reports Generated | See Document 10. |

## Fees

| Field | Value |
|---|---|
| Purpose | Particulars, fee types, structures, assignment, invoices, payments, receipts, ledger, discounts, fines, reports |
| Associated APIs | `/api/v1/fees/*` |
| Database Tables | `FeeParticular`, `FeeType`, `FeeStructure`, `StudentFeeAssignment`, `FeeInvoice`, `FeePayment`, `FeeReceipt`, `FeeLedger`, `FeeDiscount`, `FeeFine` |
| User Roles | SCHOOL_ADMIN, ACCOUNTANT via permissions |
| Dependencies | Authentication, tenant school scope where school-owned, Prisma models listed above |
| Business Rules | See Document 9 for rules extracted from middleware/services/controllers. |
| Validation Rules | Implemented in controllers/services and selected Zod validation files under `backend/src/validations`. |
| Notifications Triggered | Where code calls notification service/dispatcher or notification logs; see Document 11. |
| Reports Generated | See Document 10. |

## Homework

| Field | Value |
|---|---|
| Purpose | Homework creation, attachments, evaluations, evaluation report |
| Associated APIs | `/api/v1/homework/*` |
| Database Tables | `Homework`, `HomeworkEvaluation` |
| User Roles | SCHOOL_ADMIN, TEACHER via permissions |
| Dependencies | Authentication, tenant school scope where school-owned, Prisma models listed above |
| Business Rules | See Document 9 for rules extracted from middleware/services/controllers. |
| Validation Rules | Implemented in controllers/services and selected Zod validation files under `backend/src/validations`. |
| Notifications Triggered | Where code calls notification service/dispatcher or notification logs; see Document 11. |
| Reports Generated | See Document 10. |

## Library

| Field | Value |
|---|---|
| Purpose | Book categories, books, members, issue/return, issued report |
| Associated APIs | `/api/v1/library/*` |
| Database Tables | `LibraryBookCategory`, `LibraryBook`, `LibraryMember`, `LibraryIssue` |
| User Roles | SCHOOL_ADMIN, LIBRARIAN via permissions |
| Dependencies | Authentication, tenant school scope where school-owned, Prisma models listed above |
| Business Rules | See Document 9 for rules extracted from middleware/services/controllers. |
| Validation Rules | Implemented in controllers/services and selected Zod validation files under `backend/src/validations`. |
| Notifications Triggered | Where code calls notification service/dispatcher or notification logs; see Document 11. |
| Reports Generated | See Document 10. |

## Transport

| Field | Value |
|---|---|
| Purpose | Routes, vehicles, route-vehicle links, student assignments, report |
| Associated APIs | `/api/v1/transport/*` |
| Database Tables | `TransportRoute`, `TransportVehicle`, `TransportRouteVehicle`, `StudentTransportAssignment` |
| User Roles | SCHOOL_ADMIN |
| Dependencies | Authentication, tenant school scope where school-owned, Prisma models listed above |
| Business Rules | See Document 9 for rules extracted from middleware/services/controllers. |
| Validation Rules | Implemented in controllers/services and selected Zod validation files under `backend/src/validations`. |
| Notifications Triggered | Where code calls notification service/dispatcher or notification logs; see Document 11. |
| Reports Generated | See Document 10. |

## Dormitory

| Field | Value |
|---|---|
| Purpose | Dormitories, room types, rooms, student assignments, report |
| Associated APIs | `/api/v1/dormitories/*` |
| Database Tables | `Dormitory`, `DormitoryRoomType`, `DormitoryRoom`, `StudentDormitoryAssignment` |
| User Roles | SCHOOL_ADMIN |
| Dependencies | Authentication, tenant school scope where school-owned, Prisma models listed above |
| Business Rules | See Document 9 for rules extracted from middleware/services/controllers. |
| Validation Rules | Implemented in controllers/services and selected Zod validation files under `backend/src/validations`. |
| Notifications Triggered | Where code calls notification service/dispatcher or notification logs; see Document 11. |
| Reports Generated | See Document 10. |

## Exams & Marks

| Field | Value |
|---|---|
| Purpose | Exams, exam types/config, grading, exam papers, marks, moderation, revaluation, rank card gap |
| Associated APIs | `/api/v1/exams, /api/v1/reports` |
| Database Tables | `Exam`, `ExamTypeConfig`, `ExamGradingSetting`, `ExamPaper`, `Mark`, `MarkModeration`, `MarkRevaluation` |
| User Roles | SCHOOL_ADMIN, TEACHER via permissions |
| Dependencies | Authentication, tenant school scope where school-owned, Prisma models listed above |
| Business Rules | See Document 9 for rules extracted from middleware/services/controllers. |
| Validation Rules | Implemented in controllers/services and selected Zod validation files under `backend/src/validations`. |
| Notifications Triggered | Where code calls notification service/dispatcher or notification logs; see Document 11. |
| Reports Generated | See Document 10. |

## Notifications & Messaging

| Field | Value |
|---|---|
| Purpose | Templates, logs, dispatch, SMS/email/WhatsApp provider config |
| Associated APIs | `/api/v1/notifications, /api/v1/admin/messaging-services` |
| Database Tables | `NotificationTemplate`, `NotificationLog`, `MessagingService`, `SchoolMessagingConfig` |
| User Roles | SCHOOL_ADMIN, SUPER_ADMIN |
| Dependencies | Authentication, tenant school scope where school-owned, Prisma models listed above |
| Business Rules | See Document 9 for rules extracted from middleware/services/controllers. |
| Validation Rules | Implemented in controllers/services and selected Zod validation files under `backend/src/validations`. |
| Notifications Triggered | Where code calls notification service/dispatcher or notification logs; see Document 11. |
| Reports Generated | See Document 10. |

## Compliance & Audit

| Field | Value |
|---|---|
| Purpose | Consent records, data export/deletion jobs, audit logs, audit exports |
| Associated APIs | `/api/v1/consents, /api/v1/compliance, /api/v1/audit-logs` |
| Database Tables | `ConsentDocument`, `ConsentRecord`, `DataExportJob`, `DataDeletionJob`, `AuditLog`, `AuditExport` |
| User Roles | SCHOOL_ADMIN, SUPER_ADMIN |
| Dependencies | Authentication, tenant school scope where school-owned, Prisma models listed above |
| Business Rules | See Document 9 for rules extracted from middleware/services/controllers. |
| Validation Rules | Implemented in controllers/services and selected Zod validation files under `backend/src/validations`. |
| Notifications Triggered | Where code calls notification service/dispatcher or notification logs; see Document 11. |
| Reports Generated | See Document 10. |

## Parent Portal

| Field | Value |
|---|---|
| Purpose | Parent login/OTP, child profile, attendance, subjects, timetable, exams, fees, notices |
| Associated APIs | `/api/v1/parents/portal, /api/v1/otp` |
| Database Tables | `ParentProfile`, `StudentParent`, `Student`, `StudentAttendance`, `Mark`, `FeeInvoice`, `NotificationLog` |
| User Roles | PARENT |
| Dependencies | Authentication, tenant school scope where school-owned, Prisma models listed above |
| Business Rules | See Document 9 for rules extracted from middleware/services/controllers. |
| Validation Rules | Implemented in controllers/services and selected Zod validation files under `backend/src/validations`. |
| Notifications Triggered | Where code calls notification service/dispatcher or notification logs; see Document 11. |
| Reports Generated | See Document 10. |
