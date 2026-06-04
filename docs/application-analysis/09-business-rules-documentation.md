# Document 9 - Business Rules Documentation

Generated from repository code on 2026-06-04. Source root: `/Users/syedaabidahamedarshad/Documents/TechStageIT/SchoolApp`.

| Rule | Source |
|---|---|
| JWT token must be Bearer access token with typ=access and sub | `backend/src/middlewares/auth.middleware.ts` |
| Inactive/suspended school blocks access; payment/subscription suspension limits access to subscriptions/plans | `backend/src/middlewares/auth.middleware.ts` |
| Teacher login requires active teacher profile | `backend/src/middlewares/auth.middleware.ts` |
| Parent login requires parent profile linked to at least one student in active school | `backend/src/middlewares/auth.middleware.ts` |
| Employee-managed roles require effective plan permission codes for mapped paths | `backend/src/middlewares/auth.middleware.ts` |
| Write methods under /api/v1 pass subscription write guard except auth/public/subscriptions/admin paths | `backend/src/app.ts` |
| Super admin bypasses requireRole checks but admin routers use superAdminGuard | `backend/src/middlewares/rbac.middleware.ts` |
| Student information router allows only SCHOOL_ADMIN | `backend/src/routes/student.routes.ts` |
| Academic setup write endpoints use schoolAdminOnly; reads are authenticated | `backend/src/routes/academic.routes.ts` |
| Attendance sessions allow SCHOOL_ADMIN and TEACHER for create/update/summary/self; locks require SCHOOL_ADMIN | `backend/src/routes/attendance.routes.ts` |
| Attendance substitution requires attendance.substitute.manage permission | `backend/src/routes/attendance.routes.ts` |
| Backups/restore UI disables execution because backend execution is not implemented | `admin/app/dashboard/backups/page.tsx` |
| Data compliance export/deletion approval/rejection workflows return 501 where not implemented | `backend/src/services/dataCompliance.service.ts` |
| Rank card generation returns 501 not implemented | `backend/src/controllers/report.controller.ts` |
| OTP sending service returns code directly for now as stubbed send | `backend/src/services/otp.service.ts` |

## Status and Workflow Enums

Workflow/status behavior is represented by Prisma enums: `SchoolStatus`, `SubscriptionPlan`, `UserStatus`, `RoleName`, `SubjectType`, `TimePeriodType`, `StudentStatus`, `HomeworkQualityStatus`, `HomeworkCompletionStatus`, `LibraryMemberType`, `LibraryIssueStatus`, `TransferRequestStatus`, `ImportType`, `ImportStatus`, `FaceProfileStatus`, `AttendanceStatus`, `AttendanceSessionStatus`, `AttendanceApprovalStatus`, `TimetableVersionStatus`, `StudentAttendanceStatus`, `StudentAttendanceSessionStatus`, `TeacherSelfAttendanceStatus`, `StaffAttendanceStatus`, `PayrollStatus`, `PayrollPaymentStatus`, `LeaveRequestStatus`, `LeaveApplicationStatus`, `ExamType`, `ExamStatus`, `MarkStatus`, `ThemeStatus`, `FeatureFlagStatus`, `FeeRecordStatus`, `FeeParticularType`, `FeeStructureStatus`, `StudentFeeAssignmentStatus`, `FeeInvoiceStatus`, `FeePaymentMode`, `FeePaymentStatus`, `FeeDiscountType`, `FeeValueType`, `FeeApprovalStatus`, `FeeFineType`, `FeeLedgerEntryType`, `FeeNotificationType`, `FeeNotificationStatus`, `NotificationStatus`, `MessagingServiceStatus`, `BackupStatus`, `RestoreStatus`, `ConsentType`, `DataJobStatus`, `DeletionStatus`, `TicketStatus`. Inspect service implementations for allowed transitions; notable incomplete workflows are listed in Document 13.
