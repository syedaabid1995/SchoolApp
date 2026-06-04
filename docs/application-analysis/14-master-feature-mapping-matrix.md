# Document 14 - Master Feature Mapping Matrix

Generated from repository code on 2026-06-04. Source root: `/Users/syedaabidahamedarshad/Documents/TechStageIT/SchoolApp`.

| Feature | Module | Screen | API | Table | Roles | Dependencies |
|---|---|---|---|---|---|---|
| Platform Administration | Platform Administration | `/dashboard/schools/[id]/admins`<br>`/dashboard/subscriptions` | `GET /api/v1/admin/dashboard/`<br>`GET /api/v1/admin/dashboard/summary`<br>`GET /api/v1/admin/dashboard/school-growth`<br>`GET /api/v1/admin/dashboard/revenue`<br>`GET /api/v1/admin/dashboard/activity`<br>`GET /api/v1/admin/dashboard/support-summary`<br>`GET /api/v1/admin/dashboard/top-schools`<br>`GET /api/v1/admin/dashboard/analytics/weekly`<br>`GET /api/v1/admin/dashboard/performance`<br>`GET /api/v1/admin/dashboard/activities`<br>`GET /api/v1/admin/dashboard/system-status`<br>`GET /api/v1/admin/system-health`<br>`GET /api/v1/admin/users/`<br>`GET /api/v1/admin/users/summary`<br>`GET /api/v1/admin/users/:id`<br>`PATCH /api/v1/admin/users/:id/status` | `School`<br>`User`<br>`Subscription`<br>`SubscriptionPlanDef`<br>`AuditLog`<br>`SupportTicket`<br>`BackupJob`<br>`RestoreJob` | SUPER_ADMIN | Auth, tenant scope, Prisma models, frontend service/API proxy |
| Authentication & Security | Authentication & Security | `/change-password`<br>`/dashboard/sessions`<br>`/dashboard/settings/security/totp`<br>`/reset-password` | `POST /api/v1/admin/users/:id/force-password-reset`<br>`POST /api/v1/admin/users/:id/revoke-sessions`<br>`GET /api/v1/admin/users/:id/sessions`<br>`POST /api/v1/attendance/sessions`<br>`PATCH /api/v1/attendance/sessions/:id`<br>`POST /api/v1/attendance/sessions/:id/lock`<br>`POST /api/v1/attendance/legacy/sessions`<br>`GET /api/v1/attendance/legacy/sessions`<br>`POST /api/v1/attendance/legacy/sessions/:id/close`<br>`GET /api/v1/attendance/legacy/sessions/:sessionId/records`<br>`POST /api/v1/attendance-approval/sessions/:sessionId/approve`<br>`POST /api/v1/attendance-approval/sessions/:sessionId/reject`<br>`GET /api/v1/auth/login-experience`<br>`GET /api/auth/login-experience`<br>`POST /api/v1/auth/login`<br>`POST /api/auth/login` | `User`<br>`RefreshSession`<br>`PasswordResetToken`<br>`MfaChallenge`<br>`TotpCredential`<br>`TotpBackupCode` | All authenticated roles | Auth, tenant scope, Prisma models, frontend service/API proxy |
| Institution Setup & Branding | Institution Setup & Branding | `/dashboard/settings/access`<br>`/dashboard/settings/branding`<br>`/dashboard/settings`<br>`/dashboard/settings/security`<br>`/dashboard/settings/sms`<br>`/dashboard/sms-settings`<br>`/dashboard/themes` | `GET /api/v1/features/login-experience`<br>`PUT /api/v1/features/login-experience`<br>`POST /api/v1/features/flags`<br>`GET /api/v1/features/flags`<br>`PATCH /api/v1/features/flags/:id`<br>`DELETE /api/v1/features/flags/:id`<br>`POST /api/v1/features/overrides`<br>`POST /api/v1/features/configs`<br>`GET /api/v1/features/configs`<br>`PATCH /api/v1/features/configs/:id`<br>`POST /api/v1/features/configs/overrides`<br>`GET /api/v1/public/assets/branding`<br>`GET /api/v1/public/branding/login`<br>`GET /api/v1/system-settings/school`<br>`PUT /api/v1/system-settings/school`<br>`POST /api/v1/themes/` | `School`<br>`Theme`<br>`ThemeHistory`<br>`ConfigEntry`<br>`SchoolSystemSetting`<br>`MessagingService`<br>`SchoolMessagingConfig` | SCHOOL_ADMIN, SUPER_ADMIN | Auth, tenant scope, Prisma models, frontend service/API proxy |
| Academics & Timetable | Academics & Timetable | `/dashboard/academics/exams`<br>`/dashboard/academics/marks`<br>`/dashboard/academics`<br>`/dashboard/academics/timetable`<br>`/dashboard/timetable` | `POST /api/v1/academics/academic-years`<br>`GET /api/v1/academics/academic-years`<br>`GET /api/v1/academics/academic-years/:id`<br>`PATCH /api/v1/academics/academic-years/:id`<br>`DELETE /api/v1/academics/academic-years/:id`<br>`POST /api/v1/academics/terms`<br>`GET /api/v1/academics/terms`<br>`GET /api/v1/academics/terms/:id`<br>`PATCH /api/v1/academics/terms/:id`<br>`DELETE /api/v1/academics/terms/:id`<br>`POST /api/v1/academics/classes`<br>`GET /api/v1/academics/classes`<br>`GET /api/v1/academics/classes/:id`<br>`PATCH /api/v1/academics/classes/:id`<br>`DELETE /api/v1/academics/classes/:id`<br>`POST /api/v1/academics/sections` | `AcademicYear`<br>`Term`<br>`Class`<br>`Section`<br>`Subject`<br>`ClassRoom`<br>`TimePeriod`<br>`ClassRoutine`<br>`TimetableVersion`<br>`TimetableEntry` | SCHOOL_ADMIN, TEACHER read/self | Auth, tenant scope, Prisma models, frontend service/API proxy |
| Student Information | Student Information | `/dashboard/attendance/students/mark`<br>`/dashboard/parents/[id]`<br>`/dashboard/parents`<br>`/dashboard/students/[id]`<br>`/dashboard/students/add`<br>`/dashboard/students/attendance`<br>`/dashboard/students/disabled`<br>`/dashboard/students/groups`<br>`/dashboard/students`<br>`/dashboard/students/promotion`<br>`/dashboard/students/transfers`<br>`/parent/attendance` | `GET /api/v1/faces/by-student/:studentId`<br>`GET /api/v1/fees/ledger/:studentId`<br>`GET /api/v1/students/students/import/sample`<br>`POST /api/v1/students/students/import`<br>`GET /api/v1/students/attendance`<br>`POST /api/v1/students/attendance`<br>`GET /api/v1/students/attendance/report`<br>`GET /api/v1/students/groups`<br>`POST /api/v1/students/groups`<br>`PATCH /api/v1/students/groups/:id`<br>`DELETE /api/v1/students/groups/:id`<br>`GET /api/v1/students/categories`<br>`POST /api/v1/students/categories`<br>`PATCH /api/v1/students/categories/:id`<br>`DELETE /api/v1/students/categories/:id`<br>`GET /api/v1/students/promotions/preview` | `Student`<br>`ParentGuardian`<br>`StudentParent`<br>`StudentEnrollment`<br>`StudentGroup`<br>`StudentCategory`<br>`StudentPromotion`<br>`StudentTransferRequest`<br>`StudentDocument`<br>`StudentTimeline` | SCHOOL_ADMIN | Auth, tenant scope, Prisma models, frontend service/API proxy |
| Attendance & Leave | Attendance & Leave | `/dashboard/attendance/locks`<br>`/dashboard/attendance/my`<br>`/dashboard/attendance/overview`<br>`/dashboard/attendance`<br>`/dashboard/leave/my`<br>`/dashboard/leave/requests`<br>`/dashboard/staff/attendance` | `POST /api/v1/academics/attendance-periods`<br>`GET /api/v1/academics/attendance-periods`<br>`DELETE /api/v1/academics/attendance-periods/:id`<br>`GET /api/v1/academics/attendance-mode`<br>`PUT /api/v1/academics/attendance-mode`<br>`GET /api/v1/attendance/summary`<br>`POST /api/v1/attendance/teacher/self`<br>`GET /api/v1/attendance/teacher/self`<br>`POST /api/v1/attendance/substitutions`<br>`GET /api/v1/attendance/substitutions`<br>`PATCH /api/v1/attendance/substitutions/:id/cancel`<br>`POST /api/v1/attendance/periods`<br>`GET /api/v1/attendance/periods`<br>`GET /api/v1/attendance/periods/:id`<br>`PATCH /api/v1/attendance/periods/:id`<br>`DELETE /api/v1/attendance/periods/:id` | `StudentAttendance`<br>`StudentAttendanceSession`<br>`StudentAttendanceRecord`<br>`AttendanceSession`<br>`AttendanceRecord`<br>`TeacherSelfAttendance`<br>`StaffAttendance`<br>`LeaveApplication`<br>`LeaveStatusHistory` | SCHOOL_ADMIN, TEACHER, STAFF via permissions | Auth, tenant scope, Prisma models, frontend service/API proxy |
| Teachers & Staff / Payroll | Teachers & Staff / Payroll | `/dashboard/payroll`<br>`/dashboard/payroll/report`<br>`/dashboard/staff/[id]/offer-letter`<br>`/dashboard/staff/[id]`<br>`/dashboard/staff/add`<br>`/dashboard/staff`<br>`/dashboard/teachers/[id]`<br>`/dashboard/teachers/add`<br>`/dashboard/teachers/assign`<br>`/dashboard/teachers` | `GET /api/v1/academics/timetable/teachers`<br>`GET /api/v1/academics/timetable/teacher`<br>`GET /api/v1/academic-setup/class-teachers`<br>`POST /api/v1/academic-setup/class-teachers`<br>`PATCH /api/v1/academic-setup/class-teachers/:id`<br>`DELETE /api/v1/academic-setup/class-teachers/:id`<br>`GET /api/v1/staff/departments`<br>`POST /api/v1/staff/departments`<br>`GET /api/v1/staff/designations`<br>`POST /api/v1/staff/designations`<br>`POST /api/v1/staff/defaults`<br>`GET /api/v1/staff/payroll`<br>`POST /api/v1/staff/payroll/generate`<br>`GET /api/v1/staff/payroll/report`<br>`POST /api/v1/staff/payroll/:id/pay`<br>`GET /api/v1/staff/` | `TeacherProfile`<br>`Department`<br>`Designation`<br>`StaffPayrollInfo`<br>`TeacherClassAssignment`<br>`TeacherSubjectAssignment`<br>`Payroll`<br>`PayrollPayment` | SCHOOL_ADMIN, employee roles via permissions | Auth, tenant scope, Prisma models, frontend service/API proxy |
| Fees | Fees | `/dashboard/fee-challan-details`<br>`/dashboard/fees` | `GET /api/v1/fees/metadata`<br>`GET /api/v1/fees/particulars`<br>`POST /api/v1/fees/particulars`<br>`PATCH /api/v1/fees/particulars/:id`<br>`DELETE /api/v1/fees/particulars/:id`<br>`GET /api/v1/fees/types`<br>`POST /api/v1/fees/types`<br>`PATCH /api/v1/fees/types/:id`<br>`DELETE /api/v1/fees/types/:id`<br>`GET /api/v1/fees/structures`<br>`POST /api/v1/fees/structures`<br>`PATCH /api/v1/fees/structures/:id`<br>`DELETE /api/v1/fees/structures/:id`<br>`POST /api/v1/fees/structures/:id/duplicate`<br>`GET /api/v1/fees/assignments`<br>`POST /api/v1/fees/assignments` | `FeeParticular`<br>`FeeType`<br>`FeeStructure`<br>`StudentFeeAssignment`<br>`FeeInvoice`<br>`FeePayment`<br>`FeeReceipt`<br>`FeeLedger`<br>`FeeDiscount`<br>`FeeFine` | SCHOOL_ADMIN, ACCOUNTANT via permissions | Auth, tenant scope, Prisma models, frontend service/API proxy |
| Homework | Homework | `/dashboard/homework` | `POST /api/v1/homework/attachments`<br>`GET /api/v1/homework/evaluation-report`<br>`GET /api/v1/homework/`<br>`POST /api/v1/homework/`<br>`PATCH /api/v1/homework/:id`<br>`DELETE /api/v1/homework/:id`<br>`GET /api/v1/homework/:id/evaluations`<br>`POST /api/v1/homework/:id/evaluations` | `Homework`<br>`HomeworkEvaluation` | SCHOOL_ADMIN, TEACHER via permissions | Auth, tenant scope, Prisma models, frontend service/API proxy |
| Library | Library | `/dashboard/library` | `GET /api/v1/library/issued`<br>`PATCH /api/v1/library/issues/:id/return`<br>`GET /api/v1/library/categories`<br>`POST /api/v1/library/categories`<br>`PATCH /api/v1/library/categories/:id`<br>`DELETE /api/v1/library/categories/:id`<br>`GET /api/v1/library/books`<br>`POST /api/v1/library/books`<br>`PATCH /api/v1/library/books/:id`<br>`DELETE /api/v1/library/books/:id`<br>`GET /api/v1/library/members`<br>`POST /api/v1/library/members`<br>`DELETE /api/v1/library/members/:id`<br>`GET /api/v1/library/members/:memberId/issues`<br>`POST /api/v1/library/members/:memberId/issues` | `LibraryBookCategory`<br>`LibraryBook`<br>`LibraryMember`<br>`LibraryIssue` | SCHOOL_ADMIN, LIBRARIAN via permissions | Auth, tenant scope, Prisma models, frontend service/API proxy |
| Transport | Transport | `/dashboard/transport` | `GET /api/v1/transport/report`<br>`GET /api/v1/transport/assignments`<br>`POST /api/v1/transport/assignments`<br>`PATCH /api/v1/transport/assignments/:id`<br>`DELETE /api/v1/transport/assignments/:id`<br>`GET /api/v1/transport/routes`<br>`POST /api/v1/transport/routes`<br>`PATCH /api/v1/transport/routes/:id`<br>`DELETE /api/v1/transport/routes/:id`<br>`GET /api/v1/transport/vehicles`<br>`POST /api/v1/transport/vehicles`<br>`PATCH /api/v1/transport/vehicles/:id`<br>`DELETE /api/v1/transport/vehicles/:id` | `TransportRoute`<br>`TransportVehicle`<br>`TransportRouteVehicle`<br>`StudentTransportAssignment` | SCHOOL_ADMIN | Auth, tenant scope, Prisma models, frontend service/API proxy |
| Dormitory | Dormitory | `/dashboard/dormitory` | `GET /api/v1/dormitories/report`<br>`GET /api/v1/dormitories/room-types`<br>`POST /api/v1/dormitories/room-types`<br>`PATCH /api/v1/dormitories/room-types/:id`<br>`DELETE /api/v1/dormitories/room-types/:id`<br>`GET /api/v1/dormitories/rooms`<br>`POST /api/v1/dormitories/rooms`<br>`PATCH /api/v1/dormitories/rooms/:id`<br>`DELETE /api/v1/dormitories/rooms/:id`<br>`GET /api/v1/dormitories/`<br>`POST /api/v1/dormitories/`<br>`PATCH /api/v1/dormitories/:id`<br>`DELETE /api/v1/dormitories/:id` | `Dormitory`<br>`DormitoryRoomType`<br>`DormitoryRoom`<br>`StudentDormitoryAssignment` | SCHOOL_ADMIN | Auth, tenant scope, Prisma models, frontend service/API proxy |
| Exams & Marks | Exams & Marks | `/dashboard/reports` | `POST /api/v1/exams/`<br>`GET /api/v1/exams/`<br>`GET /api/v1/exams/grading-settings`<br>`PUT /api/v1/exams/grading-settings`<br>`GET /api/v1/exams/marks`<br>`GET /api/v1/exams/:id`<br>`PATCH /api/v1/exams/:id`<br>`DELETE /api/v1/exams/:id`<br>`POST /api/v1/exams/papers`<br>`POST /api/v1/exams/marks/upload`<br>`POST /api/v1/exams/marks/:id/moderate`<br>`POST /api/v1/exams/marks/:id/revaluation`<br>`GET /api/v1/reports/term`<br>`GET /api/v1/reports/annual`<br>`GET /api/v1/reports/rank` | `Exam`<br>`ExamTypeConfig`<br>`ExamGradingSetting`<br>`ExamPaper`<br>`Mark`<br>`MarkModeration`<br>`MarkRevaluation` | SCHOOL_ADMIN, TEACHER via permissions | Auth, tenant scope, Prisma models, frontend service/API proxy |
| Notifications & Messaging | Notifications & Messaging | No dedicated page detected by static route name | `GET /api/v1/messaging-services/services`<br>`GET /api/v1/messaging-services/config`<br>`PUT /api/v1/messaging-services/config`<br>`PATCH /api/v1/messaging-services/config/status`<br>`POST /api/v1/notifications/templates`<br>`GET /api/v1/notifications/templates`<br>`POST /api/v1/notifications/send`<br>`GET /api/v1/notifications/logs`<br>`GET /api/v1/notifications/summary` | `NotificationTemplate`<br>`NotificationLog`<br>`MessagingService`<br>`SchoolMessagingConfig` | SCHOOL_ADMIN, SUPER_ADMIN | Auth, tenant scope, Prisma models, frontend service/API proxy |
| Compliance & Audit | Compliance & Audit | `/dashboard/audit`<br>`/dashboard/compliance`<br>`/dashboard/settings/consent` | `GET /api/v1/audit-logs/`<br>`POST /api/v1/consents/documents`<br>`POST /api/v1/consents/records`<br>`GET /api/v1/consents/records`<br>`POST /api/v1/consents/records/:id/withdraw`<br>`POST /api/v1/compliance/exports`<br>`GET /api/v1/compliance/exports/:id`<br>`POST /api/v1/compliance/deletions`<br>`GET /api/v1/compliance/deletions`<br>`POST /api/v1/compliance/deletions/:id/approve`<br>`POST /api/v1/compliance/deletions/:id/execute` | `ConsentDocument`<br>`ConsentRecord`<br>`DataExportJob`<br>`DataDeletionJob`<br>`AuditLog`<br>`AuditExport` | SCHOOL_ADMIN, SUPER_ADMIN | Auth, tenant scope, Prisma models, frontend service/API proxy |
| Parent Portal | Parent Portal | No dedicated page detected by static route name | `GET /api/v1/parents/portal/children`<br>`GET /api/v1/parents/portal/profile`<br>`GET /api/v1/parents/portal/dashboard`<br>`GET /api/v1/parents/portal/exams`<br>`GET /api/v1/parents/portal/results`<br>`GET /api/v1/parents/portal/subjects`<br>`GET /api/v1/parents/portal/attendance`<br>`GET /api/v1/parents/portal/notices`<br>`GET /api/v1/parents/portal/timetable`<br>`GET /api/v1/parents/portal/fees` | `ParentProfile`<br>`StudentParent`<br>`Student`<br>`StudentAttendance`<br>`Mark`<br>`FeeInvoice`<br>`NotificationLog` | PARENT | Auth, tenant scope, Prisma models, frontend service/API proxy |

## Full Endpoint-to-Module Cross Reference

| Module | Method | API | Handler | Source |
|---|---|---|---|---|
| Academics & Timetable | POST | `/api/v1/academics/academic-years` | `createAcademicYear` | `backend/src/routes/academic.routes.ts:71` |
| Academics & Timetable | GET | `/api/v1/academics/academic-years` | `listAcademicYears` | `backend/src/routes/academic.routes.ts:72` |
| Academics & Timetable | GET | `/api/v1/academics/academic-years/:id` | `getAcademicYear` | `backend/src/routes/academic.routes.ts:73` |
| Academics & Timetable | PATCH | `/api/v1/academics/academic-years/:id` | `updateAcademicYear` | `backend/src/routes/academic.routes.ts:74` |
| Academics & Timetable | DELETE | `/api/v1/academics/academic-years/:id` | `deleteAcademicYear` | `backend/src/routes/academic.routes.ts:75` |
| Academics & Timetable | POST | `/api/v1/academics/terms` | `createTerm` | `backend/src/routes/academic.routes.ts:77` |
| Academics & Timetable | GET | `/api/v1/academics/terms` | `listTerms` | `backend/src/routes/academic.routes.ts:78` |
| Academics & Timetable | GET | `/api/v1/academics/terms/:id` | `getTerm` | `backend/src/routes/academic.routes.ts:79` |
| Academics & Timetable | PATCH | `/api/v1/academics/terms/:id` | `updateTerm` | `backend/src/routes/academic.routes.ts:80` |
| Academics & Timetable | DELETE | `/api/v1/academics/terms/:id` | `deleteTerm` | `backend/src/routes/academic.routes.ts:81` |
| Academics & Timetable | POST | `/api/v1/academics/classes` | `createClass` | `backend/src/routes/academic.routes.ts:83` |
| Academics & Timetable | GET | `/api/v1/academics/classes` | `listClasses` | `backend/src/routes/academic.routes.ts:84` |
| Academics & Timetable | GET | `/api/v1/academics/classes/:id` | `getClass` | `backend/src/routes/academic.routes.ts:85` |
| Academics & Timetable | PATCH | `/api/v1/academics/classes/:id` | `updateClass` | `backend/src/routes/academic.routes.ts:86` |
| Academics & Timetable | DELETE | `/api/v1/academics/classes/:id` | `deleteClass` | `backend/src/routes/academic.routes.ts:87` |
| Academics & Timetable | POST | `/api/v1/academics/sections` | `createSection` | `backend/src/routes/academic.routes.ts:89` |
| Academics & Timetable | GET | `/api/v1/academics/sections` | `listSections` | `backend/src/routes/academic.routes.ts:90` |
| Academics & Timetable | GET | `/api/v1/academics/sections/:id` | `getSection` | `backend/src/routes/academic.routes.ts:91` |
| Academics & Timetable | PATCH | `/api/v1/academics/sections/:id` | `updateSection` | `backend/src/routes/academic.routes.ts:92` |
| Academics & Timetable | DELETE | `/api/v1/academics/sections/:id` | `deleteSection` | `backend/src/routes/academic.routes.ts:93` |
| Academics & Timetable | POST | `/api/v1/academics/subjects` | `createSubject` | `backend/src/routes/academic.routes.ts:95` |
| Academics & Timetable | GET | `/api/v1/academics/subjects` | `listSubjects` | `backend/src/routes/academic.routes.ts:96` |
| Academics & Timetable | GET | `/api/v1/academics/subjects/:id` | `getSubject` | `backend/src/routes/academic.routes.ts:97` |
| Academics & Timetable | PATCH | `/api/v1/academics/subjects/:id` | `updateSubject` | `backend/src/routes/academic.routes.ts:98` |
| Academics & Timetable | DELETE | `/api/v1/academics/subjects/:id` | `deleteSubject` | `backend/src/routes/academic.routes.ts:99` |
| Academics & Timetable | GET | `/api/v1/academics/exam-types` | `listExamTypes` | `backend/src/routes/academic.routes.ts:101` |
| Academics & Timetable | POST | `/api/v1/academics/exam-types` | `createExamType` | `backend/src/routes/academic.routes.ts:102` |
| Academics & Timetable | PATCH | `/api/v1/academics/exam-types/:id` | `updateExamType` | `backend/src/routes/academic.routes.ts:103` |
| Attendance & Leave | POST | `/api/v1/academics/attendance-periods` | `createAttendancePeriod` | `backend/src/routes/academic.routes.ts:104` |
| Attendance & Leave | GET | `/api/v1/academics/attendance-periods` | `listAttendancePeriods` | `backend/src/routes/academic.routes.ts:105` |
| Attendance & Leave | DELETE | `/api/v1/academics/attendance-periods/:id` | `deleteAttendancePeriod` | `backend/src/routes/academic.routes.ts:106` |
| Attendance & Leave | GET | `/api/v1/academics/attendance-mode` | `getAttendanceMode` | `backend/src/routes/academic.routes.ts:108` |
| Attendance & Leave | PUT | `/api/v1/academics/attendance-mode` | `updateAttendanceMode` | `backend/src/routes/academic.routes.ts:109` |
| Academics & Timetable | POST | `/api/v1/academics/timetable/versions` | `createTimetableVersionApi` | `backend/src/routes/academic.routes.ts:111` |
| Academics & Timetable | GET | `/api/v1/academics/timetable/versions` | `listTimetableVersionsApi` | `backend/src/routes/academic.routes.ts:112` |
| Academics & Timetable | POST | `/api/v1/academics/timetable/entries/bulk` | `bulkUpsertTimetableEntriesApi` | `backend/src/routes/academic.routes.ts:113` |
| Academics & Timetable | GET | `/api/v1/academics/timetable/entries` | `listTimetableEntriesApi` | `backend/src/routes/academic.routes.ts:114` |
| Teachers & Staff / Payroll | GET | `/api/v1/academics/timetable/teachers` | `listTimetableTeachersApi` | `backend/src/routes/academic.routes.ts:115` |
| Academics & Timetable | POST | `/api/v1/academics/timetable/versions/:id/publish` | `publishTimetableVersionApi` | `backend/src/routes/academic.routes.ts:116` |
| Teachers & Staff / Payroll | GET | `/api/v1/academics/timetable/teacher` | `getTeacherTimetableApi` | `backend/src/routes/academic.routes.ts:117` |
| Academics & Timetable | GET | `/api/v1/academic-setup/classes` | `listSetupClasses` | `backend/src/routes/academicSetup.routes.ts:43` |
| Academics & Timetable | POST | `/api/v1/academic-setup/classes` | `createSetupClass` | `backend/src/routes/academicSetup.routes.ts:44` |
| Academics & Timetable | PATCH | `/api/v1/academic-setup/classes/:id` | `updateSetupClass` | `backend/src/routes/academicSetup.routes.ts:45` |
| Academics & Timetable | DELETE | `/api/v1/academic-setup/classes/:id` | `deleteSetupClass` | `backend/src/routes/academicSetup.routes.ts:46` |
| Academics & Timetable | GET | `/api/v1/academic-setup/sections` | `listSetupSections` | `backend/src/routes/academicSetup.routes.ts:48` |
| Academics & Timetable | POST | `/api/v1/academic-setup/sections` | `createSetupSection` | `backend/src/routes/academicSetup.routes.ts:49` |
| Academics & Timetable | PATCH | `/api/v1/academic-setup/sections/:id` | `updateSetupSection` | `backend/src/routes/academicSetup.routes.ts:50` |
| Academics & Timetable | DELETE | `/api/v1/academic-setup/sections/:id` | `deleteSetupSection` | `backend/src/routes/academicSetup.routes.ts:51` |
| Academics & Timetable | GET | `/api/v1/academic-setup/subjects` | `listSetupSubjects` | `backend/src/routes/academicSetup.routes.ts:53` |
| Academics & Timetable | POST | `/api/v1/academic-setup/subjects` | `createSetupSubject` | `backend/src/routes/academicSetup.routes.ts:54` |
| Academics & Timetable | PATCH | `/api/v1/academic-setup/subjects/:id` | `updateSetupSubject` | `backend/src/routes/academicSetup.routes.ts:55` |
| Academics & Timetable | DELETE | `/api/v1/academic-setup/subjects/:id` | `deleteSetupSubject` | `backend/src/routes/academicSetup.routes.ts:56` |
| Academics & Timetable | GET | `/api/v1/academic-setup/rooms` | `listClassRooms` | `backend/src/routes/academicSetup.routes.ts:58` |
| Academics & Timetable | POST | `/api/v1/academic-setup/rooms` | `createClassRoom` | `backend/src/routes/academicSetup.routes.ts:59` |
| Academics & Timetable | PATCH | `/api/v1/academic-setup/rooms/:id` | `updateClassRoom` | `backend/src/routes/academicSetup.routes.ts:60` |
| Academics & Timetable | DELETE | `/api/v1/academic-setup/rooms/:id` | `deleteClassRoom` | `backend/src/routes/academicSetup.routes.ts:61` |
| Academics & Timetable | GET | `/api/v1/academic-setup/time-periods` | `listTimePeriods` | `backend/src/routes/academicSetup.routes.ts:63` |
| Academics & Timetable | POST | `/api/v1/academic-setup/time-periods/defaults` | `seedDefaultTimePeriods` | `backend/src/routes/academicSetup.routes.ts:64` |
| Academics & Timetable | POST | `/api/v1/academic-setup/time-periods` | `createTimePeriod` | `backend/src/routes/academicSetup.routes.ts:65` |
| Academics & Timetable | PATCH | `/api/v1/academic-setup/time-periods/:id` | `updateTimePeriod` | `backend/src/routes/academicSetup.routes.ts:66` |
| Academics & Timetable | DELETE | `/api/v1/academic-setup/time-periods/:id` | `deleteTimePeriod` | `backend/src/routes/academicSetup.routes.ts:67` |
| Academics & Timetable | GET | `/api/v1/academic-setup/assign-subjects` | `listAssignSubjects` | `backend/src/routes/academicSetup.routes.ts:69` |
| Academics & Timetable | POST | `/api/v1/academic-setup/assign-subjects` | `saveAssignSubjects` | `backend/src/routes/academicSetup.routes.ts:70` |
| Academics & Timetable | DELETE | `/api/v1/academic-setup/assign-subjects/:id` | `deleteAssignSubject` | `backend/src/routes/academicSetup.routes.ts:71` |
| Teachers & Staff / Payroll | GET | `/api/v1/academic-setup/class-teachers` | `listClassTeachers` | `backend/src/routes/academicSetup.routes.ts:73` |
| Teachers & Staff / Payroll | POST | `/api/v1/academic-setup/class-teachers` | `saveClassTeacher` | `backend/src/routes/academicSetup.routes.ts:74` |
| Teachers & Staff / Payroll | PATCH | `/api/v1/academic-setup/class-teachers/:id` | `updateClassTeacher` | `backend/src/routes/academicSetup.routes.ts:75` |
| Teachers & Staff / Payroll | DELETE | `/api/v1/academic-setup/class-teachers/:id` | `deleteClassTeacher` | `backend/src/routes/academicSetup.routes.ts:76` |
| Academics & Timetable | GET | `/api/v1/academic-setup/routines` | `listClassRoutines` | `backend/src/routes/academicSetup.routes.ts:78` |
| Academics & Timetable | POST | `/api/v1/academic-setup/routines` | `createClassRoutine` | `backend/src/routes/academicSetup.routes.ts:79` |
| Academics & Timetable | POST | `/api/v1/academic-setup/routines/generate` | `generateClassRoutine` | `backend/src/routes/academicSetup.routes.ts:80` |
| Academics & Timetable | PATCH | `/api/v1/academic-setup/routines/:id` | `updateClassRoutine` | `backend/src/routes/academicSetup.routes.ts:81` |
| Academics & Timetable | DELETE | `/api/v1/academic-setup/routines/:id` | `deleteClassRoutine` | `backend/src/routes/academicSetup.routes.ts:82` |
| Platform Administration | GET | `/api/v1/admin/dashboard/` | `getAdminDashboardApi` | `backend/src/routes/adminDashboard.routes.ts:23` |
| Platform Administration | GET | `/api/v1/admin/dashboard/summary` | `getDashboardSummaryApi` | `backend/src/routes/adminDashboard.routes.ts:24` |
| Platform Administration | GET | `/api/v1/admin/dashboard/school-growth` | `getSchoolGrowthApi` | `backend/src/routes/adminDashboard.routes.ts:25` |
| Platform Administration | GET | `/api/v1/admin/dashboard/revenue` | `getRevenueSummaryApi` | `backend/src/routes/adminDashboard.routes.ts:26` |
| Platform Administration | GET | `/api/v1/admin/dashboard/activity` | `getPlatformActivityApi` | `backend/src/routes/adminDashboard.routes.ts:27` |
| Platform Administration | GET | `/api/v1/admin/dashboard/support-summary` | `getSupportSummaryApi` | `backend/src/routes/adminDashboard.routes.ts:28` |
| Platform Administration | GET | `/api/v1/admin/dashboard/top-schools` | `getTopSchoolsApi` | `backend/src/routes/adminDashboard.routes.ts:29` |
| Platform Administration | GET | `/api/v1/admin/dashboard/analytics/weekly` | `getWeeklyAnalyticsApi` | `backend/src/routes/adminDashboard.routes.ts:30` |
| Platform Administration | GET | `/api/v1/admin/dashboard/performance` | `getPerformanceMetricsApi` | `backend/src/routes/adminDashboard.routes.ts:31` |
| Platform Administration | GET | `/api/v1/admin/dashboard/activities` | `getRecentActivitiesApi` | `backend/src/routes/adminDashboard.routes.ts:32` |
| Platform Administration | GET | `/api/v1/admin/dashboard/system-status` | `getSystemStatusApi` | `backend/src/routes/adminDashboard.routes.ts:33` |
| Platform Administration | GET | `/api/v1/admin/system-health` | `getSystemHealthApi` | `backend/src/routes/adminSystem.routes.ts:11` |
| Platform Administration | GET | `/api/v1/admin/users/` | `listAdminUsersApi` | `backend/src/routes/adminUser.routes.ts:23` |
| Platform Administration | GET | `/api/v1/admin/users/summary` | `getAdminUsersSummaryApi` | `backend/src/routes/adminUser.routes.ts:24` |
| Platform Administration | GET | `/api/v1/admin/users/:id` | `getAdminUserByIdApi` | `backend/src/routes/adminUser.routes.ts:25` |
| Platform Administration | PATCH | `/api/v1/admin/users/:id/status` | `updateAdminUserStatusApi` | `backend/src/routes/adminUser.routes.ts:26` |
| Platform Administration | PATCH | `/api/v1/admin/users/:id/lock` | `lockAdminUserApi` | `backend/src/routes/adminUser.routes.ts:27` |
| Platform Administration | PATCH | `/api/v1/admin/users/:id/unlock` | `unlockAdminUserApi` | `backend/src/routes/adminUser.routes.ts:28` |
| Authentication & Security | POST | `/api/v1/admin/users/:id/force-password-reset` | `forceAdminPasswordResetApi` | `backend/src/routes/adminUser.routes.ts:29` |
| Authentication & Security | POST | `/api/v1/admin/users/:id/revoke-sessions` | `revokeAdminUserSessionsApi` | `backend/src/routes/adminUser.routes.ts:30` |
| Platform Administration | POST | `/api/v1/admin/users/:id/disable-mfa` | `disableAdminUserMfaApi` | `backend/src/routes/adminUser.routes.ts:31` |
| Platform Administration | GET | `/api/v1/admin/users/:id/activity` | `getAdminUserActivityApi` | `backend/src/routes/adminUser.routes.ts:32` |
| Authentication & Security | GET | `/api/v1/admin/users/:id/sessions` | `getAdminUserSessionsApi` | `backend/src/routes/adminUser.routes.ts:33` |
| General | GET | `/api/v1/analytics/` | `getAnalytics` | `backend/src/routes/analytics.routes.ts:9` |
| Authentication & Security | POST | `/api/v1/attendance/sessions` | `createAttendanceSessionApi` | `backend/src/routes/attendance.routes.ts:39` |
| Authentication & Security | PATCH | `/api/v1/attendance/sessions/:id` | `updateAttendanceSessionApi` | `backend/src/routes/attendance.routes.ts:40` |
| Authentication & Security | POST | `/api/v1/attendance/sessions/:id/lock` | `lockAttendanceSessionApi` | `backend/src/routes/attendance.routes.ts:41` |
| Attendance & Leave | GET | `/api/v1/attendance/summary` | `attendanceSummaryApi` | `backend/src/routes/attendance.routes.ts:42` |
| Attendance & Leave | POST | `/api/v1/attendance/teacher/self` | `markTeacherSelfAttendanceApi` | `backend/src/routes/attendance.routes.ts:43` |
| Attendance & Leave | GET | `/api/v1/attendance/teacher/self` | `listTeacherSelfAttendanceApi` | `backend/src/routes/attendance.routes.ts:44` |
| Attendance & Leave | POST | `/api/v1/attendance/substitutions` | `createAttendanceSubstitutionApi` | `backend/src/routes/attendance.routes.ts:45` |
| Attendance & Leave | GET | `/api/v1/attendance/substitutions` | `listAttendanceSubstitutionsApi` | `backend/src/routes/attendance.routes.ts:46` |
| Attendance & Leave | PATCH | `/api/v1/attendance/substitutions/:id/cancel` | `cancelAttendanceSubstitutionApi` | `backend/src/routes/attendance.routes.ts:47` |
| Attendance & Leave | POST | `/api/v1/attendance/periods` | `createAttendancePeriod` | `backend/src/routes/attendance.routes.ts:50` |
| Attendance & Leave | GET | `/api/v1/attendance/periods` | `listAttendancePeriods` | `backend/src/routes/attendance.routes.ts:51` |
| Attendance & Leave | GET | `/api/v1/attendance/periods/:id` | `getAttendancePeriod` | `backend/src/routes/attendance.routes.ts:52` |
| Attendance & Leave | PATCH | `/api/v1/attendance/periods/:id` | `updateAttendancePeriod` | `backend/src/routes/attendance.routes.ts:53` |
| Attendance & Leave | DELETE | `/api/v1/attendance/periods/:id` | `deleteAttendancePeriod` | `backend/src/routes/attendance.routes.ts:54` |
| Authentication & Security | POST | `/api/v1/attendance/legacy/sessions` | `startSession` | `backend/src/routes/attendance.routes.ts:56` |
| Authentication & Security | GET | `/api/v1/attendance/legacy/sessions` | `listSessions` | `backend/src/routes/attendance.routes.ts:57` |
| Authentication & Security | POST | `/api/v1/attendance/legacy/sessions/:id/close` | `closeSession` | `backend/src/routes/attendance.routes.ts:58` |
| Attendance & Leave | POST | `/api/v1/attendance/legacy/records` | `markAttendance` | `backend/src/routes/attendance.routes.ts:59` |
| Attendance & Leave | PATCH | `/api/v1/attendance/legacy/records/:id/override` | `overrideAttendance` | `backend/src/routes/attendance.routes.ts:60` |
| Authentication & Security | GET | `/api/v1/attendance/legacy/sessions/:sessionId/records` | `listSessionRecords` | `backend/src/routes/attendance.routes.ts:61` |
| Authentication & Security | POST | `/api/v1/attendance-approval/sessions/:sessionId/approve` | `approveSession` | `backend/src/routes/attendanceApproval.routes.ts:9` |
| Authentication & Security | POST | `/api/v1/attendance-approval/sessions/:sessionId/reject` | `rejectSession` | `backend/src/routes/attendanceApproval.routes.ts:10` |
| Attendance & Leave | GET | `/api/v1/attendance-summary/` | `getAttendanceSummaryApi` | `backend/src/routes/attendanceSummary.routes.ts:11` |
| Compliance & Audit | GET | `/api/v1/audit-logs/` | `listAuditLogs` | `backend/src/routes/auditLog.routes.ts:22` |
| Platform Administration | GET | `/api/v1/admin/audit-logs/` | `listAdminAuditLogsApi` | `backend/src/routes/auditLog.routes.ts:26` |
| Platform Administration | GET | `/api/v1/admin/audit-logs/summary` | `getAdminAuditSummaryApi` | `backend/src/routes/auditLog.routes.ts:27` |
| Platform Administration | GET | `/api/v1/admin/audit-logs/high-risk` | `getAdminHighRiskAuditLogsApi` | `backend/src/routes/auditLog.routes.ts:28` |
| Platform Administration | POST | `/api/v1/admin/audit-logs/export` | `requestAdminAuditExportApi` | `backend/src/routes/auditLog.routes.ts:29` |
| Platform Administration | GET | `/api/v1/admin/audit-logs/:id` | `getAdminAuditLogDetailApi` | `backend/src/routes/auditLog.routes.ts:30` |
| Platform Administration | GET | `/api/v1/admin/audit-exports/` | `listAdminAuditExportsApi` | `backend/src/routes/auditLog.routes.ts:34` |
| Platform Administration | GET | `/api/v1/admin/audit-exports/:id` | `getAdminAuditExportApi` | `backend/src/routes/auditLog.routes.ts:35` |
| Platform Administration | GET | `/api/v1/admin/audit-exports/:id/download` | `downloadAdminAuditExportApi` | `backend/src/routes/auditLog.routes.ts:36` |
| Authentication & Security | GET | `/api/v1/auth/login-experience` | `getPublicLoginExperience` | `backend/src/routes/auth.routes.ts:30` |
| Authentication & Security | GET | `/api/auth/login-experience` | `getPublicLoginExperience` | `backend/src/routes/auth.routes.ts:30` |
| Authentication & Security | POST | `/api/v1/auth/login` | `login` | `backend/src/routes/auth.routes.ts:32` |
| Authentication & Security | POST | `/api/auth/login` | `login` | `backend/src/routes/auth.routes.ts:32` |
| Authentication & Security | POST | `/api/v1/auth/verify-2fa` | `verifyTwoFactor` | `backend/src/routes/auth.routes.ts:34` |
| Authentication & Security | POST | `/api/auth/verify-2fa` | `verifyTwoFactor` | `backend/src/routes/auth.routes.ts:34` |
| Authentication & Security | POST | `/api/v1/auth/resend-2fa` | `resendTwoFactor` | `backend/src/routes/auth.routes.ts:36` |
| Authentication & Security | POST | `/api/auth/resend-2fa` | `resendTwoFactor` | `backend/src/routes/auth.routes.ts:36` |
| Authentication & Security | POST | `/api/v1/auth/totp/setup` | `startTotpSetup` | `backend/src/routes/auth.routes.ts:38` |
| Authentication & Security | POST | `/api/auth/totp/setup` | `startTotpSetup` | `backend/src/routes/auth.routes.ts:38` |
| Authentication & Security | POST | `/api/v1/auth/totp/verify-setup` | `verifyTotpSetup` | `backend/src/routes/auth.routes.ts:40` |
| Authentication & Security | POST | `/api/auth/totp/verify-setup` | `verifyTotpSetup` | `backend/src/routes/auth.routes.ts:40` |
| Authentication & Security | POST | `/api/v1/auth/totp/disable` | `disableTotp` | `backend/src/routes/auth.routes.ts:42` |
| Authentication & Security | POST | `/api/auth/totp/disable` | `disableTotp` | `backend/src/routes/auth.routes.ts:42` |
| Authentication & Security | POST | `/api/v1/auth/totp/verify-login` | `verifyTotpLogin` | `backend/src/routes/auth.routes.ts:44` |
| Authentication & Security | POST | `/api/auth/totp/verify-login` | `verifyTotpLogin` | `backend/src/routes/auth.routes.ts:44` |
| Authentication & Security | POST | `/api/v1/auth/forgot-password` | `forgotPassword` | `backend/src/routes/auth.routes.ts:46` |
| Authentication & Security | POST | `/api/auth/forgot-password` | `forgotPassword` | `backend/src/routes/auth.routes.ts:46` |
| Authentication & Security | POST | `/api/v1/auth/reset-password` | `resetPassword` | `backend/src/routes/auth.routes.ts:48` |
| Authentication & Security | POST | `/api/auth/reset-password` | `resetPassword` | `backend/src/routes/auth.routes.ts:48` |
| Authentication & Security | POST | `/api/v1/auth/refresh` | `refreshToken` | `backend/src/routes/auth.routes.ts:50` |
| Authentication & Security | POST | `/api/auth/refresh` | `refreshToken` | `backend/src/routes/auth.routes.ts:50` |
| Authentication & Security | POST | `/api/v1/auth/logout` | `logout` | `backend/src/routes/auth.routes.ts:52` |
| Authentication & Security | POST | `/api/auth/logout` | `logout` | `backend/src/routes/auth.routes.ts:52` |
| Authentication & Security | POST | `/api/v1/auth/change-password` | `changePassword` | `backend/src/routes/auth.routes.ts:54` |
| Authentication & Security | POST | `/api/auth/change-password` | `changePassword` | `backend/src/routes/auth.routes.ts:54` |
| Authentication & Security | GET | `/api/v1/auth/sessions` | `listSessions` | `backend/src/routes/auth.routes.ts:56` |
| Authentication & Security | GET | `/api/auth/sessions` | `listSessions` | `backend/src/routes/auth.routes.ts:56` |
| Authentication & Security | DELETE | `/api/v1/auth/sessions/:sessionId` | `revokeSession` | `backend/src/routes/auth.routes.ts:58` |
| Authentication & Security | DELETE | `/api/auth/sessions/:sessionId` | `revokeSession` | `backend/src/routes/auth.routes.ts:58` |
| Authentication & Security | POST | `/api/v1/auth/logout-all` | `logoutAll` | `backend/src/routes/auth.routes.ts:60` |
| Authentication & Security | POST | `/api/auth/logout-all` | `logoutAll` | `backend/src/routes/auth.routes.ts:60` |
| General | POST | `/api/v1/backups/backups` | `requestBackup` | `backend/src/routes/backup.routes.ts:20` |
| Platform Administration | POST | `/api/v1/admin/backups` | `requestBackup` | `backend/src/routes/backup.routes.ts:20` |
| General | GET | `/api/v1/backups/backups` | `listBackups` | `backend/src/routes/backup.routes.ts:21` |
| Platform Administration | GET | `/api/v1/admin/backups` | `listBackups` | `backend/src/routes/backup.routes.ts:21` |
| General | GET | `/api/v1/backups/backups/:id` | `getBackup` | `backend/src/routes/backup.routes.ts:22` |
| Platform Administration | GET | `/api/v1/admin/backups/:id` | `getBackup` | `backend/src/routes/backup.routes.ts:22` |
| General | POST | `/api/v1/backups/restores` | `requestRestore` | `backend/src/routes/backup.routes.ts:23` |
| Platform Administration | POST | `/api/v1/admin/restores` | `requestRestore` | `backend/src/routes/backup.routes.ts:23` |
| General | GET | `/api/v1/backups/restores` | `listRestores` | `backend/src/routes/backup.routes.ts:24` |
| Platform Administration | GET | `/api/v1/admin/restores` | `listRestores` | `backend/src/routes/backup.routes.ts:24` |
| General | GET | `/api/v1/backups/restores/:id` | `getRestore` | `backend/src/routes/backup.routes.ts:25` |
| Platform Administration | GET | `/api/v1/admin/restores/:id` | `getRestore` | `backend/src/routes/backup.routes.ts:25` |
| General | POST | `/api/v1/backups/restores/:id/approve` | `approveRestore` | `backend/src/routes/backup.routes.ts:26` |
| Platform Administration | POST | `/api/v1/admin/restores/:id/approve` | `approveRestore` | `backend/src/routes/backup.routes.ts:26` |
| General | POST | `/api/v1/backups/restores/:id/reject` | `rejectRestore` | `backend/src/routes/backup.routes.ts:27` |
| Platform Administration | POST | `/api/v1/admin/restores/:id/reject` | `rejectRestore` | `backend/src/routes/backup.routes.ts:27` |
| Compliance & Audit | POST | `/api/v1/consents/documents` | `createDocumentApi` | `backend/src/routes/consent.routes.ts:14` |
| Compliance & Audit | POST | `/api/v1/consents/records` | `grantConsentApi` | `backend/src/routes/consent.routes.ts:15` |
| Compliance & Audit | GET | `/api/v1/consents/records` | `listConsentApi` | `backend/src/routes/consent.routes.ts:16` |
| Compliance & Audit | POST | `/api/v1/consents/records/:id/withdraw` | `withdrawConsentApi` | `backend/src/routes/consent.routes.ts:17` |
| Compliance & Audit | POST | `/api/v1/compliance/exports` | `requestExport` | `backend/src/routes/dataCompliance.routes.ts:29` |
| Compliance & Audit | GET | `/api/v1/compliance/exports/:id` | `getExportStatus` | `backend/src/routes/dataCompliance.routes.ts:30` |
| Compliance & Audit | POST | `/api/v1/compliance/deletions` | `requestDeletionApi` | `backend/src/routes/dataCompliance.routes.ts:32` |
| Compliance & Audit | GET | `/api/v1/compliance/deletions` | `listDeletionJobsApi` | `backend/src/routes/dataCompliance.routes.ts:33` |
| Compliance & Audit | POST | `/api/v1/compliance/deletions/:id/approve` | `approveDeletionApi` | `backend/src/routes/dataCompliance.routes.ts:34` |
| Compliance & Audit | POST | `/api/v1/compliance/deletions/:id/execute` | `executeDeletionApi` | `backend/src/routes/dataCompliance.routes.ts:35` |
| Platform Administration | GET | `/api/v1/admin/compliance/summary` | `getComplianceSummaryApi` | `backend/src/routes/dataCompliance.routes.ts:40` |
| Platform Administration | GET | `/api/v1/admin/compliance/export-requests` | `listExportRequestsApi` | `backend/src/routes/dataCompliance.routes.ts:41` |
| Platform Administration | GET | `/api/v1/admin/compliance/export-requests/:id` | `getExportRequestByIdApi` | `backend/src/routes/dataCompliance.routes.ts:42` |
| Platform Administration | POST | `/api/v1/admin/compliance/export-requests/:id/approve` | `approveExportRequestApi` | `backend/src/routes/dataCompliance.routes.ts:43` |
| Platform Administration | POST | `/api/v1/admin/compliance/export-requests/:id/reject` | `rejectExportRequestApi` | `backend/src/routes/dataCompliance.routes.ts:44` |
| Platform Administration | GET | `/api/v1/admin/compliance/deletion-requests` | `listDeletionRequestsApi` | `backend/src/routes/dataCompliance.routes.ts:46` |
| Platform Administration | GET | `/api/v1/admin/compliance/deletion-requests/:id` | `getDeletionRequestByIdApi` | `backend/src/routes/dataCompliance.routes.ts:47` |
| Platform Administration | POST | `/api/v1/admin/compliance/deletion-requests/:id/approve` | `approveDeletionRequestApi` | `backend/src/routes/dataCompliance.routes.ts:48` |
| Platform Administration | POST | `/api/v1/admin/compliance/deletion-requests/:id/reject` | `rejectDeletionRequestApi` | `backend/src/routes/dataCompliance.routes.ts:49` |
| Platform Administration | GET | `/api/v1/admin/compliance/consents` | `listConsentRecordsApi` | `backend/src/routes/dataCompliance.routes.ts:51` |
| Platform Administration | GET | `/api/v1/admin/compliance/jobs` | `listComplianceJobsApi` | `backend/src/routes/dataCompliance.routes.ts:52` |
| Dormitory | GET | `/api/v1/dormitories/report` | `getStudentDormitoryReport` | `backend/src/routes/dormitory.routes.ts:23` |
| Dormitory | GET | `/api/v1/dormitories/room-types` | `listDormitoryRoomTypes` | `backend/src/routes/dormitory.routes.ts:25` |
| Dormitory | POST | `/api/v1/dormitories/room-types` | `createDormitoryRoomType` | `backend/src/routes/dormitory.routes.ts:26` |
| Dormitory | PATCH | `/api/v1/dormitories/room-types/:id` | `updateDormitoryRoomType` | `backend/src/routes/dormitory.routes.ts:27` |
| Dormitory | DELETE | `/api/v1/dormitories/room-types/:id` | `deleteDormitoryRoomType` | `backend/src/routes/dormitory.routes.ts:28` |
| Dormitory | GET | `/api/v1/dormitories/rooms` | `listDormitoryRooms` | `backend/src/routes/dormitory.routes.ts:30` |
| Dormitory | POST | `/api/v1/dormitories/rooms` | `createDormitoryRoom` | `backend/src/routes/dormitory.routes.ts:31` |
| Dormitory | PATCH | `/api/v1/dormitories/rooms/:id` | `updateDormitoryRoom` | `backend/src/routes/dormitory.routes.ts:32` |
| Dormitory | DELETE | `/api/v1/dormitories/rooms/:id` | `deleteDormitoryRoom` | `backend/src/routes/dormitory.routes.ts:33` |
| Dormitory | GET | `/api/v1/dormitories/` | `listDormitories` | `backend/src/routes/dormitory.routes.ts:35` |
| Dormitory | POST | `/api/v1/dormitories/` | `createDormitory` | `backend/src/routes/dormitory.routes.ts:36` |
| Dormitory | PATCH | `/api/v1/dormitories/:id` | `updateDormitory` | `backend/src/routes/dormitory.routes.ts:37` |
| Dormitory | DELETE | `/api/v1/dormitories/:id` | `deleteDormitory` | `backend/src/routes/dormitory.routes.ts:38` |
| Attendance & Leave | POST | `/api/v1/attendance/evidence/` | `createEvidence` | `backend/src/routes/evidence.routes.ts:9` |
| Attendance & Leave | GET | `/api/v1/attendance/evidence/:recordId` | `listEvidence` | `backend/src/routes/evidence.routes.ts:11` |
| Exams & Marks | POST | `/api/v1/exams/` | `createExam` | `backend/src/routes/exam.routes.ts:26` |
| Exams & Marks | GET | `/api/v1/exams/` | `listExams` | `backend/src/routes/exam.routes.ts:27` |
| Exams & Marks | GET | `/api/v1/exams/grading-settings` | `getExamGradingSettingsApi` | `backend/src/routes/exam.routes.ts:28` |
| Exams & Marks | PUT | `/api/v1/exams/grading-settings` | `updateExamGradingSettingsApi` | `backend/src/routes/exam.routes.ts:29` |
| Exams & Marks | GET | `/api/v1/exams/marks` | `listMarks` | `backend/src/routes/exam.routes.ts:30` |
| Exams & Marks | GET | `/api/v1/exams/:id` | `getExam` | `backend/src/routes/exam.routes.ts:31` |
| Exams & Marks | PATCH | `/api/v1/exams/:id` | `updateExam` | `backend/src/routes/exam.routes.ts:32` |
| Exams & Marks | DELETE | `/api/v1/exams/:id` | `deleteExam` | `backend/src/routes/exam.routes.ts:33` |
| Exams & Marks | POST | `/api/v1/exams/papers` | `createExamPaper` | `backend/src/routes/exam.routes.ts:35` |
| Exams & Marks | POST | `/api/v1/exams/marks/upload` | `uploadMarks` | `backend/src/routes/exam.routes.ts:36` |
| Exams & Marks | POST | `/api/v1/exams/marks/:id/moderate` | `moderateMark` | `backend/src/routes/exam.routes.ts:37` |
| Exams & Marks | POST | `/api/v1/exams/marks/:id/revaluation` | `requestRevaluation` | `backend/src/routes/exam.routes.ts:38` |
| General | POST | `/api/v1/faces/enroll` | `enrollFace` | `backend/src/routes/face.routes.ts:16` |
| General | POST | `/api/v1/faces/re-enroll` | `reEnroll` | `backend/src/routes/face.routes.ts:17` |
| General | POST | `/api/v1/faces/:id/approve` | `approveFace` | `backend/src/routes/face.routes.ts:18` |
| General | POST | `/api/v1/faces/:id/reject` | `rejectFace` | `backend/src/routes/face.routes.ts:19` |
| General | GET | `/api/v1/faces/:id` | `getFaceProfile` | `backend/src/routes/face.routes.ts:20` |
| Student Information | GET | `/api/v1/faces/by-student/:studentId` | `getStudentFaceProfile` | `backend/src/routes/face.routes.ts:21` |
| Institution Setup & Branding | GET | `/api/v1/features/login-experience` | `getLoginExperienceSettings` | `backend/src/routes/feature-flag.routes.ts:26` |
| Institution Setup & Branding | PUT | `/api/v1/features/login-experience` | `updateLoginExperienceSettings` | `backend/src/routes/feature-flag.routes.ts:27` |
| Authentication & Security | GET | `/api/v1/features/auth-security` | `getAuthSecuritySettingsApi` | `backend/src/routes/feature-flag.routes.ts:28` |
| Authentication & Security | PUT | `/api/v1/features/auth-security` | `updateAuthSecuritySettingsApi` | `backend/src/routes/feature-flag.routes.ts:29` |
| Institution Setup & Branding | POST | `/api/v1/features/flags` | `createFeatureFlag` | `backend/src/routes/feature-flag.routes.ts:31` |
| Institution Setup & Branding | GET | `/api/v1/features/flags` | `listFeatureFlags` | `backend/src/routes/feature-flag.routes.ts:32` |
| Institution Setup & Branding | PATCH | `/api/v1/features/flags/:id` | `updateFeatureFlag` | `backend/src/routes/feature-flag.routes.ts:33` |
| Institution Setup & Branding | DELETE | `/api/v1/features/flags/:id` | `deleteFeatureFlag` | `backend/src/routes/feature-flag.routes.ts:34` |
| Institution Setup & Branding | POST | `/api/v1/features/overrides` | `setFeatureOverride` | `backend/src/routes/feature-flag.routes.ts:35` |
| Institution Setup & Branding | POST | `/api/v1/features/configs` | `createConfigEntry` | `backend/src/routes/feature-flag.routes.ts:37` |
| Institution Setup & Branding | GET | `/api/v1/features/configs` | `listConfigEntries` | `backend/src/routes/feature-flag.routes.ts:38` |
| Institution Setup & Branding | PATCH | `/api/v1/features/configs/:id` | `updateConfigEntry` | `backend/src/routes/feature-flag.routes.ts:39` |
| Institution Setup & Branding | POST | `/api/v1/features/configs/overrides` | `setTenantConfigOverride` | `backend/src/routes/feature-flag.routes.ts:40` |
| Fees | GET | `/api/v1/fees/metadata` | `getFeeMetadata` | `backend/src/routes/feeManagement.routes.ts:36` |
| Fees | GET | `/api/v1/fees/particulars` | `listFeeParticulars` | `backend/src/routes/feeManagement.routes.ts:38` |
| Fees | POST | `/api/v1/fees/particulars` | `createFeeParticular` | `backend/src/routes/feeManagement.routes.ts:39` |
| Fees | PATCH | `/api/v1/fees/particulars/:id` | `updateFeeParticular` | `backend/src/routes/feeManagement.routes.ts:40` |
| Fees | DELETE | `/api/v1/fees/particulars/:id` | `deleteFeeParticular` | `backend/src/routes/feeManagement.routes.ts:41` |
| Fees | GET | `/api/v1/fees/types` | `listFeeTypes` | `backend/src/routes/feeManagement.routes.ts:43` |
| Fees | POST | `/api/v1/fees/types` | `createFeeType` | `backend/src/routes/feeManagement.routes.ts:44` |
| Fees | PATCH | `/api/v1/fees/types/:id` | `updateFeeType` | `backend/src/routes/feeManagement.routes.ts:45` |
| Fees | DELETE | `/api/v1/fees/types/:id` | `deleteFeeType` | `backend/src/routes/feeManagement.routes.ts:46` |
| Fees | GET | `/api/v1/fees/structures` | `listFeeStructures` | `backend/src/routes/feeManagement.routes.ts:48` |
| Fees | POST | `/api/v1/fees/structures` | `createFeeStructure` | `backend/src/routes/feeManagement.routes.ts:49` |
| Fees | PATCH | `/api/v1/fees/structures/:id` | `updateFeeStructure` | `backend/src/routes/feeManagement.routes.ts:50` |
| Fees | DELETE | `/api/v1/fees/structures/:id` | `deleteFeeStructure` | `backend/src/routes/feeManagement.routes.ts:51` |
| Fees | POST | `/api/v1/fees/structures/:id/duplicate` | `duplicateFeeStructure` | `backend/src/routes/feeManagement.routes.ts:52` |
| Fees | GET | `/api/v1/fees/assignments` | `listFeeAssignments` | `backend/src/routes/feeManagement.routes.ts:54` |
| Fees | POST | `/api/v1/fees/assignments` | `assignStudentFees` | `backend/src/routes/feeManagement.routes.ts:55` |
| Fees | GET | `/api/v1/fees/invoices` | `listFeeInvoices` | `backend/src/routes/feeManagement.routes.ts:57` |
| Fees | POST | `/api/v1/fees/invoices/generate` | `generateFeeInvoices` | `backend/src/routes/feeManagement.routes.ts:58` |
| Fees | GET | `/api/v1/fees/payments` | `listFeePayments` | `backend/src/routes/feeManagement.routes.ts:60` |
| Fees | POST | `/api/v1/fees/payments` | `collectFeePayment` | `backend/src/routes/feeManagement.routes.ts:61` |
| Student Information | GET | `/api/v1/fees/ledger/:studentId` | `getStudentFeeLedger` | `backend/src/routes/feeManagement.routes.ts:63` |
| Fees | GET | `/api/v1/fees/discounts` | `listFeeDiscounts` | `backend/src/routes/feeManagement.routes.ts:65` |
| Fees | POST | `/api/v1/fees/discounts` | `createFeeDiscount` | `backend/src/routes/feeManagement.routes.ts:66` |
| Fees | GET | `/api/v1/fees/fines` | `listFeeFines` | `backend/src/routes/feeManagement.routes.ts:68` |
| Fees | POST | `/api/v1/fees/fines` | `createFeeFine` | `backend/src/routes/feeManagement.routes.ts:69` |
| Fees | GET | `/api/v1/fees/reports` | `getFeeReports` | `backend/src/routes/feeManagement.routes.ts:71` |
| Homework | POST | `/api/v1/homework/attachments` | `uploadHomeworkAttachment` | `backend/src/routes/homework.routes.ts:19` |
| Homework | GET | `/api/v1/homework/evaluation-report` | `getHomeworkEvaluationReport` | `backend/src/routes/homework.routes.ts:20` |
| Homework | GET | `/api/v1/homework/` | `listHomeworks` | `backend/src/routes/homework.routes.ts:22` |
| Homework | POST | `/api/v1/homework/` | `createHomework` | `backend/src/routes/homework.routes.ts:23` |
| Homework | PATCH | `/api/v1/homework/:id` | `updateHomework` | `backend/src/routes/homework.routes.ts:24` |
| Homework | DELETE | `/api/v1/homework/:id` | `deleteHomework` | `backend/src/routes/homework.routes.ts:25` |
| Homework | GET | `/api/v1/homework/:id/evaluations` | `getHomeworkEvaluation` | `backend/src/routes/homework.routes.ts:26` |
| Homework | POST | `/api/v1/homework/:id/evaluations` | `saveHomeworkEvaluation` | `backend/src/routes/homework.routes.ts:27` |
| General | POST | `/api/v1/imports/` | `createImport` | `backend/src/routes/import.routes.ts:15` |
| General | GET | `/api/v1/imports/` | `listImports` | `backend/src/routes/import.routes.ts:16` |
| General | GET | `/api/v1/imports/:id` | `getImport` | `backend/src/routes/import.routes.ts:17` |
| General | GET | `/api/v1/imports/:id/errors` | `listImportErrors` | `backend/src/routes/import.routes.ts:18` |
| General | GET | `/api/v1/jobs/:queue/:id` | `getJobStatus` | `backend/src/routes/job.routes.ts:9` |
| Attendance & Leave | GET | `/api/v1/leave/types` | `listLeaveTypes` | `backend/src/routes/leave.routes.ts:28` |
| Attendance & Leave | POST | `/api/v1/leave/types` | `createLeaveType` | `backend/src/routes/leave.routes.ts:29` |
| Attendance & Leave | PATCH | `/api/v1/leave/types/:id` | `updateLeaveType` | `backend/src/routes/leave.routes.ts:30` |
| Attendance & Leave | DELETE | `/api/v1/leave/types/:id` | `deleteLeaveType` | `backend/src/routes/leave.routes.ts:31` |
| Attendance & Leave | GET | `/api/v1/leave/defines` | `listLeaveDefines` | `backend/src/routes/leave.routes.ts:33` |
| Attendance & Leave | POST | `/api/v1/leave/defines` | `createLeaveDefine` | `backend/src/routes/leave.routes.ts:34` |
| Attendance & Leave | PATCH | `/api/v1/leave/defines/:id` | `updateLeaveDefine` | `backend/src/routes/leave.routes.ts:35` |
| Attendance & Leave | DELETE | `/api/v1/leave/defines/:id` | `deleteLeaveDefine` | `backend/src/routes/leave.routes.ts:36` |
| Attendance & Leave | GET | `/api/v1/leave/balances/me` | `listMyLeaveBalances` | `backend/src/routes/leave.routes.ts:38` |
| Attendance & Leave | GET | `/api/v1/leave/applications` | `listLeaveApplications` | `backend/src/routes/leave.routes.ts:40` |
| Attendance & Leave | POST | `/api/v1/leave/applications` | `createLeaveApplication` | `backend/src/routes/leave.routes.ts:41` |
| Attendance & Leave | GET | `/api/v1/leave/applications/:id` | `getLeaveApplication` | `backend/src/routes/leave.routes.ts:42` |
| Attendance & Leave | PATCH | `/api/v1/leave/applications/:id` | `updateLeaveApplication` | `backend/src/routes/leave.routes.ts:43` |
| Attendance & Leave | DELETE | `/api/v1/leave/applications/:id` | `deleteLeaveApplication` | `backend/src/routes/leave.routes.ts:44` |
| Attendance & Leave | PATCH | `/api/v1/leave/applications/:id/status` | `updateLeaveStatus` | `backend/src/routes/leave.routes.ts:45` |
| Attendance & Leave | GET | `/api/v1/leave/requests` | `listLeaveApplications` | `backend/src/routes/leave.routes.ts:48` |
| Attendance & Leave | POST | `/api/v1/leave/requests` | `createLeaveApplication` | `backend/src/routes/leave.routes.ts:49` |
| Attendance & Leave | PATCH | `/api/v1/leave/requests/:id` | `updateLeaveApplication` | `backend/src/routes/leave.routes.ts:50` |
| Attendance & Leave | DELETE | `/api/v1/leave/requests/:id` | `deleteLeaveApplication` | `backend/src/routes/leave.routes.ts:51` |
| Attendance & Leave | PATCH | `/api/v1/leave/requests/:id/approve` | `approveLeaveApplication` | `backend/src/routes/leave.routes.ts:52` |
| Attendance & Leave | PATCH | `/api/v1/leave/requests/:id/reject` | `rejectLeaveApplication` | `backend/src/routes/leave.routes.ts:53` |
| Library | GET | `/api/v1/library/issued` | `listIssuedLibraryBooks` | `backend/src/routes/library.routes.ts:25` |
| Library | PATCH | `/api/v1/library/issues/:id/return` | `returnLibraryBook` | `backend/src/routes/library.routes.ts:26` |
| Library | GET | `/api/v1/library/categories` | `listLibraryCategories` | `backend/src/routes/library.routes.ts:28` |
| Library | POST | `/api/v1/library/categories` | `createLibraryCategory` | `backend/src/routes/library.routes.ts:29` |
| Library | PATCH | `/api/v1/library/categories/:id` | `updateLibraryCategory` | `backend/src/routes/library.routes.ts:30` |
| Library | DELETE | `/api/v1/library/categories/:id` | `deleteLibraryCategory` | `backend/src/routes/library.routes.ts:31` |
| Library | GET | `/api/v1/library/books` | `listLibraryBooks` | `backend/src/routes/library.routes.ts:33` |
| Library | POST | `/api/v1/library/books` | `createLibraryBook` | `backend/src/routes/library.routes.ts:34` |
| Library | PATCH | `/api/v1/library/books/:id` | `updateLibraryBook` | `backend/src/routes/library.routes.ts:35` |
| Library | DELETE | `/api/v1/library/books/:id` | `deleteLibraryBook` | `backend/src/routes/library.routes.ts:36` |
| Library | GET | `/api/v1/library/members` | `listLibraryMembers` | `backend/src/routes/library.routes.ts:38` |
| Library | POST | `/api/v1/library/members` | `createLibraryMember` | `backend/src/routes/library.routes.ts:39` |
| Library | DELETE | `/api/v1/library/members/:id` | `cancelLibraryMember` | `backend/src/routes/library.routes.ts:40` |
| Library | GET | `/api/v1/library/members/:memberId/issues` | `listMemberIssues` | `backend/src/routes/library.routes.ts:41` |
| Library | POST | `/api/v1/library/members/:memberId/issues` | `issueLibraryBook` | `backend/src/routes/library.routes.ts:42` |
| Platform Administration | GET | `/api/v1/admin/messaging-services/` | `listMessagingServicesAdminApi` | `backend/src/routes/messagingAdmin.routes.ts:17` |
| Platform Administration | GET | `/api/v1/admin/messaging-services/platform-email-config` | `getPlatformEmailConfigApi` | `backend/src/routes/messagingAdmin.routes.ts:18` |
| Platform Administration | PUT | `/api/v1/admin/messaging-services/platform-email-config` | `upsertPlatformEmailConfigApi` | `backend/src/routes/messagingAdmin.routes.ts:19` |
| Platform Administration | PATCH | `/api/v1/admin/messaging-services/platform-email-config/status` | `togglePlatformEmailConfigApi` | `backend/src/routes/messagingAdmin.routes.ts:20` |
| Platform Administration | PATCH | `/api/v1/admin/messaging-services/:id/status` | `updateMessagingServiceStatusApi` | `backend/src/routes/messagingAdmin.routes.ts:21` |
| Notifications & Messaging | GET | `/api/v1/messaging-services/services` | `listMessagingServicesForSchoolApi` | `backend/src/routes/messagingSettings.routes.ts:16` |
| Notifications & Messaging | GET | `/api/v1/messaging-services/config` | `getSchoolMessagingConfigApi` | `backend/src/routes/messagingSettings.routes.ts:17` |
| Notifications & Messaging | PUT | `/api/v1/messaging-services/config` | `upsertSchoolMessagingConfigApi` | `backend/src/routes/messagingSettings.routes.ts:18` |
| Notifications & Messaging | PATCH | `/api/v1/messaging-services/config/status` | `toggleSchoolMessagingConfigApi` | `backend/src/routes/messagingSettings.routes.ts:19` |
| Notifications & Messaging | POST | `/api/v1/notifications/templates` | `createTemplate` | `backend/src/routes/notification.routes.ts:15` |
| Notifications & Messaging | GET | `/api/v1/notifications/templates` | `listTemplates` | `backend/src/routes/notification.routes.ts:16` |
| Notifications & Messaging | POST | `/api/v1/notifications/send` | `sendNotificationApi` | `backend/src/routes/notification.routes.ts:17` |
| Notifications & Messaging | GET | `/api/v1/notifications/logs` | `listNotificationLogs` | `backend/src/routes/notification.routes.ts:18` |
| Notifications & Messaging | GET | `/api/v1/notifications/summary` | `listNotificationSummary` | `backend/src/routes/notification.routes.ts:19` |
| General | POST | `/api/v1/otp/request` | `requestOtpApi` | `backend/src/routes/otp.routes.ts:7` |
| General | POST | `/api/v1/otp/verify` | `verifyOtpApi` | `backend/src/routes/otp.routes.ts:9` |
| Parent Portal | GET | `/api/v1/parents/portal/children` | `listParentChildren` | `backend/src/routes/parentPortal.routes.ts:22` |
| Parent Portal | GET | `/api/v1/parents/portal/profile` | `getParentProfile` | `backend/src/routes/parentPortal.routes.ts:23` |
| Parent Portal | GET | `/api/v1/parents/portal/dashboard` | `getParentDashboard` | `backend/src/routes/parentPortal.routes.ts:24` |
| Parent Portal | GET | `/api/v1/parents/portal/exams` | `listParentExams` | `backend/src/routes/parentPortal.routes.ts:25` |
| Parent Portal | GET | `/api/v1/parents/portal/results` | `getParentResults` | `backend/src/routes/parentPortal.routes.ts:26` |
| Parent Portal | GET | `/api/v1/parents/portal/subjects` | `listParentSubjects` | `backend/src/routes/parentPortal.routes.ts:27` |
| Parent Portal | GET | `/api/v1/parents/portal/attendance` | `getParentAttendance` | `backend/src/routes/parentPortal.routes.ts:28` |
| Parent Portal | GET | `/api/v1/parents/portal/notices` | `listParentNotices` | `backend/src/routes/parentPortal.routes.ts:29` |
| Parent Portal | GET | `/api/v1/parents/portal/timetable` | `listParentTimetable` | `backend/src/routes/parentPortal.routes.ts:30` |
| Parent Portal | GET | `/api/v1/parents/portal/fees` | `listParentFees` | `backend/src/routes/parentPortal.routes.ts:31` |
| Institution Setup & Branding | GET | `/api/v1/public/assets/branding` | `getPublicBrandingAsset` | `backend/src/routes/publicAsset.routes.ts:6` |
| Institution Setup & Branding | GET | `/api/v1/public/branding/login` | `getPublicLoginBranding` | `backend/src/routes/publicBranding.routes.ts:6` |
| General | POST | `/api/v1/recognition/match` | `recognize` | `backend/src/routes/recognition.routes.ts:11` |
| Exams & Marks | GET | `/api/v1/reports/term` | `downloadTermReport` | `backend/src/routes/report.routes.ts:13` |
| Exams & Marks | GET | `/api/v1/reports/annual` | `downloadAnnualReport` | `backend/src/routes/report.routes.ts:14` |
| Exams & Marks | GET | `/api/v1/reports/rank` | `downloadRankCard` | `backend/src/routes/report.routes.ts:15` |
| Platform Administration | POST | `/api/v1/admin/schools/` | `createSchoolApi` | `backend/src/routes/schoolAdmin.routes.ts:22` |
| Platform Administration | GET | `/api/v1/admin/schools/` | `listSchoolsApi` | `backend/src/routes/schoolAdmin.routes.ts:23` |
| Platform Administration | GET | `/api/v1/admin/schools/:id/admins` | `listSchoolAdminsApi` | `backend/src/routes/schoolAdmin.routes.ts:24` |
| Platform Administration | PATCH | `/api/v1/admin/schools/:id` | `updateSchoolApi` | `backend/src/routes/schoolAdmin.routes.ts:25` |
| Platform Administration | PATCH | `/api/v1/admin/schools/:id/admins/:adminId/status` | `setSchoolAdminStatusApi` | `backend/src/routes/schoolAdmin.routes.ts:26` |
| Platform Administration | POST | `/api/v1/admin/schools/:id/activate` | `activateSchoolApi` | `backend/src/routes/schoolAdmin.routes.ts:27` |
| Platform Administration | POST | `/api/v1/admin/schools/:id/suspend` | `suspendSchoolApi` | `backend/src/routes/schoolAdmin.routes.ts:28` |
| Platform Administration | POST | `/api/v1/admin/schools/:id/admins` | `createSchoolAdminApi` | `backend/src/routes/schoolAdmin.routes.ts:29` |
| Platform Administration | DELETE | `/api/v1/admin/schools/:id` | `deleteSchoolApi` | `backend/src/routes/schoolAdmin.routes.ts:30` |
| Platform Administration | POST | `/api/v1/admin/schools/:id/restore` | `restoreSchoolApi` | `backend/src/routes/schoolAdmin.routes.ts:31` |
| General | GET | `/api/v1/public/school-domain/` | `resolvePublicSchoolDomain` | `backend/src/routes/schoolDomain.routes.ts:6` |
| Institution Setup & Branding | GET | `/api/v1/system-settings/school` | `getSchoolSystemSettings` | `backend/src/routes/schoolSystemSettings.routes.ts:11` |
| Institution Setup & Branding | PUT | `/api/v1/system-settings/school` | `updateSchoolSystemSettings` | `backend/src/routes/schoolSystemSettings.routes.ts:12` |
| Teachers & Staff / Payroll | GET | `/api/v1/staff/departments` | `listDepartments` | `backend/src/routes/staff.routes.ts:38` |
| Teachers & Staff / Payroll | POST | `/api/v1/staff/departments` | `createDepartment` | `backend/src/routes/staff.routes.ts:39` |
| Teachers & Staff / Payroll | GET | `/api/v1/staff/designations` | `listDesignations` | `backend/src/routes/staff.routes.ts:40` |
| Teachers & Staff / Payroll | POST | `/api/v1/staff/designations` | `createDesignation` | `backend/src/routes/staff.routes.ts:41` |
| Teachers & Staff / Payroll | POST | `/api/v1/staff/defaults` | `seedStaffDefaults` | `backend/src/routes/staff.routes.ts:42` |
| Attendance & Leave | GET | `/api/v1/staff/attendance` | `loadStaffAttendance` | `backend/src/routes/staff.routes.ts:44` |
| Attendance & Leave | POST | `/api/v1/staff/attendance` | `saveStaffAttendance` | `backend/src/routes/staff.routes.ts:45` |
| Attendance & Leave | GET | `/api/v1/staff/attendance/report` | `getStaffAttendanceReport` | `backend/src/routes/staff.routes.ts:46` |
| Teachers & Staff / Payroll | GET | `/api/v1/staff/payroll` | `listPayroll` | `backend/src/routes/staff.routes.ts:48` |
| Teachers & Staff / Payroll | POST | `/api/v1/staff/payroll/generate` | `generatePayroll` | `backend/src/routes/staff.routes.ts:49` |
| Teachers & Staff / Payroll | GET | `/api/v1/staff/payroll/report` | `getPayrollReport` | `backend/src/routes/staff.routes.ts:50` |
| Teachers & Staff / Payroll | POST | `/api/v1/staff/payroll/:id/pay` | `payPayroll` | `backend/src/routes/staff.routes.ts:51` |
| Teachers & Staff / Payroll | GET | `/api/v1/staff/` | `listStaff` | `backend/src/routes/staff.routes.ts:53` |
| Teachers & Staff / Payroll | POST | `/api/v1/staff/` | `createStaff` | `backend/src/routes/staff.routes.ts:54` |
| Teachers & Staff / Payroll | GET | `/api/v1/staff/:id` | `getStaff` | `backend/src/routes/staff.routes.ts:55` |
| Teachers & Staff / Payroll | PATCH | `/api/v1/staff/:id` | `updateStaff` | `backend/src/routes/staff.routes.ts:56` |
| Teachers & Staff / Payroll | DELETE | `/api/v1/staff/:id` | `deleteStaff` | `backend/src/routes/staff.routes.ts:57` |
| Teachers & Staff / Payroll | POST | `/api/v1/staff/:id/documents` | `addStaffDocument` | `backend/src/routes/staff.routes.ts:58` |
| Teachers & Staff / Payroll | DELETE | `/api/v1/staff/:id/documents/:documentId` | `deleteStaffDocument` | `backend/src/routes/staff.routes.ts:59` |
| Teachers & Staff / Payroll | POST | `/api/v1/staff/:id/timeline` | `addStaffTimeline` | `backend/src/routes/staff.routes.ts:60` |
| Teachers & Staff / Payroll | DELETE | `/api/v1/staff/:id/timeline/:timelineId` | `deleteStaffTimeline` | `backend/src/routes/staff.routes.ts:61` |
| Student Information | GET | `/api/v1/students/students/import/sample` | `downloadStudentImportSample` | `backend/src/routes/student.routes.ts:67` |
| Student Information | POST | `/api/v1/students/students/import` | `importStudents` | `backend/src/routes/student.routes.ts:68` |
| Student Information | GET | `/api/v1/students/attendance` | `loadStudentAttendance` | `backend/src/routes/student.routes.ts:69` |
| Student Information | POST | `/api/v1/students/attendance` | `saveStudentAttendance` | `backend/src/routes/student.routes.ts:70` |
| Student Information | GET | `/api/v1/students/attendance/report` | `getStudentAttendanceReport` | `backend/src/routes/student.routes.ts:71` |
| Student Information | GET | `/api/v1/students/groups` | `listStudentGroups` | `backend/src/routes/student.routes.ts:72` |
| Student Information | POST | `/api/v1/students/groups` | `createStudentGroup` | `backend/src/routes/student.routes.ts:73` |
| Student Information | PATCH | `/api/v1/students/groups/:id` | `updateStudentGroup` | `backend/src/routes/student.routes.ts:74` |
| Student Information | DELETE | `/api/v1/students/groups/:id` | `deleteStudentGroup` | `backend/src/routes/student.routes.ts:75` |
| Student Information | GET | `/api/v1/students/categories` | `listStudentCategories` | `backend/src/routes/student.routes.ts:76` |
| Student Information | POST | `/api/v1/students/categories` | `createStudentCategory` | `backend/src/routes/student.routes.ts:77` |
| Student Information | PATCH | `/api/v1/students/categories/:id` | `updateStudentCategory` | `backend/src/routes/student.routes.ts:78` |
| Student Information | DELETE | `/api/v1/students/categories/:id` | `deleteStudentCategory` | `backend/src/routes/student.routes.ts:79` |
| Student Information | GET | `/api/v1/students/promotions/preview` | `previewStudentPromotion` | `backend/src/routes/student.routes.ts:80` |
| Student Information | POST | `/api/v1/students/promotions` | `promoteStudents` | `backend/src/routes/student.routes.ts:81` |
| Student Information | GET | `/api/v1/students/disabled` | `listDisabledStudents` | `backend/src/routes/student.routes.ts:82` |
| Student Information | POST | `/api/v1/students/students/:id/disable` | `disableStudent` | `backend/src/routes/student.routes.ts:83` |
| Student Information | POST | `/api/v1/students/disabled/:id/restore` | `restoreDisabledStudent` | `backend/src/routes/student.routes.ts:84` |
| Student Information | DELETE | `/api/v1/students/disabled/:id` | `deleteDisabledStudent` | `backend/src/routes/student.routes.ts:85` |
| Student Information | POST | `/api/v1/students/students` | `createStudent` | `backend/src/routes/student.routes.ts:86` |
| Student Information | GET | `/api/v1/students/students` | `listStudents` | `backend/src/routes/student.routes.ts:87` |
| Student Information | GET | `/api/v1/students/students/:id` | `getStudent` | `backend/src/routes/student.routes.ts:88` |
| Student Information | PATCH | `/api/v1/students/students/:id` | `updateStudent` | `backend/src/routes/student.routes.ts:89` |
| Student Information | DELETE | `/api/v1/students/students/:id` | `deleteStudent` | `backend/src/routes/student.routes.ts:90` |
| Student Information | POST | `/api/v1/students/students/:id/photos` | `addStudentPhoto` | `backend/src/routes/student.routes.ts:91` |
| Student Information | DELETE | `/api/v1/students/students/:id/photos/:photoId` | `deleteStudentPhoto` | `backend/src/routes/student.routes.ts:92` |
| Student Information | POST | `/api/v1/students/students/:id/documents` | `addStudentDocument` | `backend/src/routes/student.routes.ts:93` |
| Student Information | DELETE | `/api/v1/students/students/:id/documents/:documentId` | `deleteStudentDocument` | `backend/src/routes/student.routes.ts:94` |
| Student Information | POST | `/api/v1/students/students/:id/timeline` | `addStudentTimeline` | `backend/src/routes/student.routes.ts:95` |
| Student Information | DELETE | `/api/v1/students/students/:id/timeline/:timelineId` | `deleteStudentTimeline` | `backend/src/routes/student.routes.ts:96` |
| Student Information | POST | `/api/v1/students/students/:id/parents` | `linkParent` | `backend/src/routes/student.routes.ts:97` |
| Student Information | DELETE | `/api/v1/students/students/:id/parents/:parentId` | `unlinkParent` | `backend/src/routes/student.routes.ts:98` |
| Student Information | POST | `/api/v1/students/students/:id/status` | `changeStudentStatus` | `backend/src/routes/student.routes.ts:99` |
| Student Information | GET | `/api/v1/students/transfer-targets` | `listTransferTargets` | `backend/src/routes/student.routes.ts:100` |
| Student Information | POST | `/api/v1/students/students/:id/transfer-requests` | `createTransferRequest` | `backend/src/routes/student.routes.ts:101` |
| Student Information | GET | `/api/v1/students/transfer-requests` | `listIncomingTransferRequests` | `backend/src/routes/student.routes.ts:102` |
| Student Information | POST | `/api/v1/students/transfer-requests/:id/accept` | `acceptTransferRequest` | `backend/src/routes/student.routes.ts:103` |
| Student Information | POST | `/api/v1/students/transfer-requests/:id/reject` | `rejectTransferRequest` | `backend/src/routes/student.routes.ts:104` |
| Student Information | POST | `/api/v1/students/parents` | `createParent` | `backend/src/routes/student.routes.ts:106` |
| Student Information | GET | `/api/v1/students/parents` | `listParents` | `backend/src/routes/student.routes.ts:107` |
| Student Information | GET | `/api/v1/students/parents/lookup` | `lookupParentByPhone` | `backend/src/routes/student.routes.ts:108` |
| Student Information | GET | `/api/v1/students/parents/:id` | `getParent` | `backend/src/routes/student.routes.ts:109` |
| Student Information | PATCH | `/api/v1/students/parents/:id` | `updateParent` | `backend/src/routes/student.routes.ts:110` |
| Student Information | DELETE | `/api/v1/students/parents/:id` | `deleteParent` | `backend/src/routes/student.routes.ts:111` |
| Platform Administration | GET | `/api/v1/subscriptions/plans` | `listActivePlansApi` | `backend/src/routes/subscription.routes.ts:34` |
| Platform Administration | GET | `/api/v1/subscriptions/usage` | `getSubscriptionUsageApi` | `backend/src/routes/subscription.routes.ts:35` |
| Platform Administration | GET | `/api/v1/subscriptions/invoices` | `getSubscriptionInvoicesApi` | `backend/src/routes/subscription.routes.ts:36` |
| Platform Administration | GET | `/api/v1/subscriptions/` | `getSubscriptionApi` | `backend/src/routes/subscription.routes.ts:37` |
| Platform Administration | POST | `/api/v1/subscriptions/` | `upsertSubscriptionApi` | `backend/src/routes/subscription.routes.ts:38` |
| Platform Administration | GET | `/api/v1/admin/subscriptions/` | `listAdminSchoolSubscriptionsApi` | `backend/src/routes/subscription.routes.ts:43` |
| Platform Administration | GET | `/api/v1/admin/subscriptions/summary` | `getAdminSubscriptionSummaryApi` | `backend/src/routes/subscription.routes.ts:44` |
| Platform Administration | GET | `/api/v1/admin/subscriptions/:schoolId` | `getAdminSchoolSubscriptionDetailApi` | `backend/src/routes/subscription.routes.ts:45` |
| Platform Administration | POST | `/api/v1/admin/subscriptions/:schoolId/assign-plan` | `assignSchoolSubscriptionPlanApi` | `backend/src/routes/subscription.routes.ts:46` |
| Platform Administration | POST | `/api/v1/admin/subscriptions/:schoolId/start-trial` | `startSchoolSubscriptionTrialApi` | `backend/src/routes/subscription.routes.ts:47` |
| Platform Administration | POST | `/api/v1/admin/subscriptions/:schoolId/extend-trial` | `extendSchoolSubscriptionTrialApi` | `backend/src/routes/subscription.routes.ts:48` |
| Platform Administration | POST | `/api/v1/admin/subscriptions/:schoolId/upgrade` | `upgradeSchoolSubscriptionApi` | `backend/src/routes/subscription.routes.ts:49` |
| Platform Administration | POST | `/api/v1/admin/subscriptions/:schoolId/downgrade` | `downgradeSchoolSubscriptionApi` | `backend/src/routes/subscription.routes.ts:50` |
| Platform Administration | POST | `/api/v1/admin/subscriptions/:schoolId/pause` | `pauseSchoolSubscriptionApi` | `backend/src/routes/subscription.routes.ts:51` |
| Platform Administration | POST | `/api/v1/admin/subscriptions/:schoolId/resume` | `resumeSchoolSubscriptionApi` | `backend/src/routes/subscription.routes.ts:52` |
| Platform Administration | POST | `/api/v1/admin/subscriptions/:schoolId/cancel` | `cancelSchoolSubscriptionApi` | `backend/src/routes/subscription.routes.ts:53` |
| Platform Administration | POST | `/api/v1/admin/subscriptions/:schoolId/renew` | `renewSchoolSubscriptionApi` | `backend/src/routes/subscription.routes.ts:54` |
| Platform Administration | PATCH | `/api/v1/admin/subscriptions/:schoolId/limits` | `overrideSchoolSubscriptionLimitsApi` | `backend/src/routes/subscription.routes.ts:55` |
| Platform Administration | GET | `/api/v1/admin/subscriptions/:schoolId/history` | `getAdminSubscriptionHistoryApi` | `backend/src/routes/subscription.routes.ts:56` |
| Platform Administration | GET | `/api/v1/admin/subscriptions/:schoolId/usage` | `getAdminSubscriptionUsageApi` | `backend/src/routes/subscription.routes.ts:57` |
| Platform Administration | GET | `/api/v1/admin/subscriptions/:schoolId/invoices` | `getAdminSubscriptionInvoicesApi` | `backend/src/routes/subscription.routes.ts:58` |
| Platform Administration | POST | `/api/v1/admin/subscriptions/:schoolId/manual-payment` | `recordSchoolSubscriptionManualPaymentApi` | `backend/src/routes/subscription.routes.ts:59` |
| Platform Administration | GET | `/api/v1/admin/subscription-metrics/:schoolId` | `getSubscriptionMetricsApi` | `backend/src/routes/subscriptionMetrics.routes.ts:11` |
| Platform Administration | GET | `/api/v1/admin/subscription-plans/` | `listSubscriptionPlansApi` | `backend/src/routes/subscriptionPlan.routes.ts:19` |
| Platform Administration | GET | `/api/v1/admin/subscription-plans/:id/schools` | `listPlanSchoolsApi` | `backend/src/routes/subscriptionPlan.routes.ts:20` |
| Platform Administration | GET | `/api/v1/admin/subscription-plans/:id/permissions` | `listPlanPermissionsApi` | `backend/src/routes/subscriptionPlan.routes.ts:21` |
| Platform Administration | POST | `/api/v1/admin/subscription-plans/` | `createSubscriptionPlanApi` | `backend/src/routes/subscriptionPlan.routes.ts:22` |
| Platform Administration | PATCH | `/api/v1/admin/subscription-plans/:id` | `updateSubscriptionPlanApi` | `backend/src/routes/subscriptionPlan.routes.ts:23` |
| Platform Administration | PUT | `/api/v1/admin/subscription-plans/:id/permissions` | `updatePlanPermissionsApi` | `backend/src/routes/subscriptionPlan.routes.ts:24` |
| Platform Administration | DELETE | `/api/v1/admin/subscription-plans/:id` | `deleteSubscriptionPlanApi` | `backend/src/routes/subscriptionPlan.routes.ts:25` |
| Teachers & Staff / Payroll | POST | `/api/v1/teachers/` | `createTeacherApi` | `backend/src/routes/teacher.routes.ts:11` |
| Teachers & Staff / Payroll | GET | `/api/v1/teachers/` | `listTeachersApi` | `backend/src/routes/teacher.routes.ts:12` |
| Teachers & Staff / Payroll | GET | `/api/v1/teachers/:id` | `getTeacherApi` | `backend/src/routes/teacher.routes.ts:13` |
| Teachers & Staff / Payroll | PATCH | `/api/v1/teachers/:id` | `updateTeacherApi` | `backend/src/routes/teacher.routes.ts:14` |
| Teachers & Staff / Payroll | DELETE | `/api/v1/teachers/:id` | `deleteTeacherApi` | `backend/src/routes/teacher.routes.ts:15` |
| Teachers & Staff / Payroll | PATCH | `/api/v1/teacher-assignments/teachers/:teacherId/status` | `setTeacherStatus` | `backend/src/routes/teacherAssignment.routes.ts:15` |
| Teachers & Staff / Payroll | POST | `/api/v1/teacher-assignments/classes/assign` | `assignClass` | `backend/src/routes/teacherAssignment.routes.ts:16` |
| Teachers & Staff / Payroll | POST | `/api/v1/teacher-assignments/classes/unassign` | `unassignClass` | `backend/src/routes/teacherAssignment.routes.ts:17` |
| Teachers & Staff / Payroll | POST | `/api/v1/teacher-assignments/subjects/assign` | `assignSubject` | `backend/src/routes/teacherAssignment.routes.ts:18` |
| Teachers & Staff / Payroll | POST | `/api/v1/teacher-assignments/subjects/unassign` | `unassignSubject` | `backend/src/routes/teacherAssignment.routes.ts:19` |
| Institution Setup & Branding | POST | `/api/v1/themes/` | `createTheme` | `backend/src/routes/theme.routes.ts:23` |
| Institution Setup & Branding | GET | `/api/v1/themes/` | `listThemes` | `backend/src/routes/theme.routes.ts:25` |
| Institution Setup & Branding | GET | `/api/v1/themes/active` | `getActiveTheme` | `backend/src/routes/theme.routes.ts:27` |
| Institution Setup & Branding | GET | `/api/v1/themes/login-branding` | `getLoginBrandingSettings` | `backend/src/routes/theme.routes.ts:29` |
| Institution Setup & Branding | PUT | `/api/v1/themes/login-branding` | `updateLoginBrandingSettings` | `backend/src/routes/theme.routes.ts:31` |
| Institution Setup & Branding | POST | `/api/v1/themes/login-branding/publish` | `publishLoginBranding` | `backend/src/routes/theme.routes.ts:33` |
| Institution Setup & Branding | POST | `/api/v1/themes/login-branding/rollback` | `rollbackLoginBranding` | `backend/src/routes/theme.routes.ts:35` |
| Institution Setup & Branding | POST | `/api/v1/themes/login-branding/reset` | `resetLoginBranding` | `backend/src/routes/theme.routes.ts:37` |
| Institution Setup & Branding | PATCH | `/api/v1/themes/:id` | `updateThemeTokens` | `backend/src/routes/theme.routes.ts:39` |
| Institution Setup & Branding | POST | `/api/v1/themes/:id/publish` | `publishTheme` | `backend/src/routes/theme.routes.ts:41` |
| Institution Setup & Branding | POST | `/api/v1/themes/:id/rollback` | `rollbackTheme` | `backend/src/routes/theme.routes.ts:43` |
| General | POST | `/api/v1/tickets/` | `createTicketApi` | `backend/src/routes/ticket.routes.ts:27` |
| General | GET | `/api/v1/tickets/` | `listTicketsApi` | `backend/src/routes/ticket.routes.ts:28` |
| General | GET | `/api/v1/tickets/:id` | `getTicketApi` | `backend/src/routes/ticket.routes.ts:29` |
| General | POST | `/api/v1/tickets/:id/comments` | `addTicketCommentApi` | `backend/src/routes/ticket.routes.ts:30` |
| General | PATCH | `/api/v1/tickets/:id` | `updateTicketApi` | `backend/src/routes/ticket.routes.ts:31` |
| General | PATCH | `/api/v1/tickets/:id/status` | `updateTicketStatusApi` | `backend/src/routes/ticket.routes.ts:32` |
| General | PATCH | `/api/v1/tickets/:id/priority` | `updateTicketPriorityApi` | `backend/src/routes/ticket.routes.ts:33` |
| Platform Administration | GET | `/api/v1/admin/support/` | `listAdminTicketsApi` | `backend/src/routes/ticket.routes.ts:38` |
| Platform Administration | GET | `/api/v1/admin/support/assignable-users` | `listAssignableSupportUsersApi` | `backend/src/routes/ticket.routes.ts:39` |
| Platform Administration | GET | `/api/v1/admin/support/:id` | `getAdminTicketApi` | `backend/src/routes/ticket.routes.ts:40` |
| Platform Administration | POST | `/api/v1/admin/support/:id/comments` | `addAdminTicketCommentApi` | `backend/src/routes/ticket.routes.ts:41` |
| Platform Administration | PATCH | `/api/v1/admin/support/:id` | `updateAdminTicketApi` | `backend/src/routes/ticket.routes.ts:42` |
| Platform Administration | PATCH | `/api/v1/admin/support/:id/assign` | `assignAdminTicketApi` | `backend/src/routes/ticket.routes.ts:43` |
| Platform Administration | PATCH | `/api/v1/admin/support/:id/status` | `updateAdminTicketStatusApi` | `backend/src/routes/ticket.routes.ts:44` |
| Platform Administration | PATCH | `/api/v1/admin/support/:id/priority` | `updateAdminTicketPriorityApi` | `backend/src/routes/ticket.routes.ts:45` |
| Transport | GET | `/api/v1/transport/report` | `getStudentTransportReport` | `backend/src/routes/transport.routes.ts:23` |
| Transport | GET | `/api/v1/transport/assignments` | `listTransportAssignments` | `backend/src/routes/transport.routes.ts:25` |
| Transport | POST | `/api/v1/transport/assignments` | `assignVehiclesToRoute` | `backend/src/routes/transport.routes.ts:26` |
| Transport | PATCH | `/api/v1/transport/assignments/:id` | `updateTransportAssignment` | `backend/src/routes/transport.routes.ts:27` |
| Transport | DELETE | `/api/v1/transport/assignments/:id` | `deleteTransportAssignment` | `backend/src/routes/transport.routes.ts:28` |
| Transport | GET | `/api/v1/transport/routes` | `listTransportRoutes` | `backend/src/routes/transport.routes.ts:30` |
| Transport | POST | `/api/v1/transport/routes` | `createTransportRoute` | `backend/src/routes/transport.routes.ts:31` |
| Transport | PATCH | `/api/v1/transport/routes/:id` | `updateTransportRoute` | `backend/src/routes/transport.routes.ts:32` |
| Transport | DELETE | `/api/v1/transport/routes/:id` | `deleteTransportRoute` | `backend/src/routes/transport.routes.ts:33` |
| Transport | GET | `/api/v1/transport/vehicles` | `listTransportVehicles` | `backend/src/routes/transport.routes.ts:35` |
| Transport | POST | `/api/v1/transport/vehicles` | `createTransportVehicle` | `backend/src/routes/transport.routes.ts:36` |
| Transport | PATCH | `/api/v1/transport/vehicles/:id` | `updateTransportVehicle` | `backend/src/routes/transport.routes.ts:37` |
| Transport | DELETE | `/api/v1/transport/vehicles/:id` | `deleteTransportVehicle` | `backend/src/routes/transport.routes.ts:38` |
| General | GET | `/api/v1/uploads/signed` | `res` | `backend/src/routes/upload.routes.ts:76` |
| Institution Setup & Branding | POST | `/api/v1/uploads/branding` | `res` | `backend/src/routes/upload.routes.ts:120` |
| General | POST | `/api/v1/uploads/photos` | `res` | `backend/src/routes/upload.routes.ts:189` |
| General | POST | `/api/v1/uploads/documents` | `res` | `backend/src/routes/upload.routes.ts:218` |
| General | GET | `/api/v1/users/me` | `getMe` | `backend/src/routes/user.routes.ts:16` |
| General | POST | `/api/v1/users/school-users` | `createSchoolUserApi` | `backend/src/routes/user.routes.ts:17` |
| General | GET | `/api/v1/users/employee-permissions` | `listEmployeePermissionsApi` | `backend/src/routes/user.routes.ts:18` |
| General | PUT | `/api/v1/users/employee-permissions` | `updateEmployeePermissionsApi` | `backend/src/routes/user.routes.ts:19` |
| General | GET | `/api/v1/users/:id` | `getUserById` | `backend/src/routes/user.routes.ts:20` |
