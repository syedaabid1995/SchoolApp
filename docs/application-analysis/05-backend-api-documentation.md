# Document 5 - Backend API Documentation

Generated from repository code on 2026-06-04. Source root: `/Users/syedaabidahamedarshad/Documents/TechStageIT/SchoolApp`.

## Mounted Routers

| Router | Base URL(s) |
|---|---|
| `academicRouter` | `/api/v1/academics` |
| `academicSetupRouter` | `/api/v1/academic-setup` |
| `adminAuditExportRouter` | `/api/v1/admin/audit-exports` |
| `adminAuditLogRouter` | `/api/v1/admin/audit-logs` |
| `adminDashboardRouter` | `/api/v1/admin/dashboard` |
| `adminDataComplianceRouter` | `/api/v1/admin/compliance` |
| `adminSubscriptionRouter` | `/api/v1/admin/subscriptions` |
| `adminSupportRouter` | `/api/v1/admin/support` |
| `adminSystemRouter` | `/api/v1/admin` |
| `adminUserRouter` | `/api/v1/admin/users` |
| `analyticsRouter` | `/api/v1/analytics` |
| `attendanceApprovalRouter` | `/api/v1/attendance-approval` |
| `attendanceRouter` | `/api/v1/attendance` |
| `attendanceSummaryRouter` | `/api/v1/attendance-summary` |
| `auditLogRouter` | `/api/v1/audit-logs` |
| `authRouter` | `/api/v1/auth`<br>`/api/auth` |
| `backupRouter` | `/api/v1/backups`<br>`/api/v1/admin` |
| `consentRouter` | `/api/v1/consents` |
| `dataComplianceRouter` | `/api/v1/compliance` |
| `dormitoryRouter` | `/api/v1/dormitories` |
| `evidenceRouter` | `/api/v1/attendance/evidence` |
| `examRouter` | `/api/v1/exams` |
| `faceRouter` | `/api/v1/faces` |
| `featureFlagRouter` | `/api/v1/features` |
| `feeManagementRouter` | `/api/v1/fees` |
| `homeworkRouter` | `/api/v1/homework` |
| `importRouter` | `/api/v1/imports` |
| `jobRouter` | `/api/v1/jobs` |
| `leaveRouter` | `/api/v1/leave` |
| `libraryRouter` | `/api/v1/library` |
| `messagingAdminRouter` | `/api/v1/admin/messaging-services` |
| `messagingSettingsRouter` | `/api/v1/messaging-services` |
| `notificationRouter` | `/api/v1/notifications` |
| `otpRouter` | `/api/v1/otp` |
| `parentPortalRouter` | `/api/v1/parents/portal` |
| `publicAssetRouter` | `/api/v1/public/assets` |
| `publicBrandingRouter` | `/api/v1/public/branding` |
| `recognitionRouter` | `/api/v1/recognition` |
| `reportRouter` | `/api/v1/reports` |
| `schoolAdminRouter` | `/api/v1/admin/schools` |
| `schoolDomainRouter` | `/api/v1/public/school-domain` |
| `schoolSystemSettingsRouter` | `/api/v1/system-settings` |
| `staffRouter` | `/api/v1/staff` |
| `studentRouter` | `/api/v1/students` |
| `subscriptionMetricsRouter` | `/api/v1/admin/subscription-metrics` |
| `subscriptionPlanRouter` | `/api/v1/admin/subscription-plans` |
| `subscriptionRouter` | `/api/v1/subscriptions` |
| `teacherAssignmentRouter` | `/api/v1/teacher-assignments` |
| `teacherRouter` | `/api/v1/teachers` |
| `themeRouter` | `/api/v1/themes` |
| `ticketRouter` | `/api/v1/tickets` |
| `transportRouter` | `/api/v1/transport` |
| `uploadRouter` | `/api/v1/uploads` |
| `userRouter` | `/api/v1/users` |

## Endpoint Catalog

| Method | URL | Controller/Handler | Middleware / Restrictions | Auth | Source |
|---|---|---|---|---|---|
| POST | `/api/v1/academics/academic-years` | `createAcademicYear` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:71` |
| GET | `/api/v1/academics/academic-years` | `listAcademicYears` | Router-level or none | Yes/guarded | `backend/src/routes/academic.routes.ts:72` |
| GET | `/api/v1/academics/academic-years/:id` | `getAcademicYear` | Router-level or none | Yes/guarded | `backend/src/routes/academic.routes.ts:73` |
| PATCH | `/api/v1/academics/academic-years/:id` | `updateAcademicYear` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:74` |
| DELETE | `/api/v1/academics/academic-years/:id` | `deleteAcademicYear` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:75` |
| POST | `/api/v1/academics/terms` | `createTerm` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:77` |
| GET | `/api/v1/academics/terms` | `listTerms` | Router-level or none | Yes/guarded | `backend/src/routes/academic.routes.ts:78` |
| GET | `/api/v1/academics/terms/:id` | `getTerm` | Router-level or none | Yes/guarded | `backend/src/routes/academic.routes.ts:79` |
| PATCH | `/api/v1/academics/terms/:id` | `updateTerm` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:80` |
| DELETE | `/api/v1/academics/terms/:id` | `deleteTerm` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:81` |
| POST | `/api/v1/academics/classes` | `createClass` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:83` |
| GET | `/api/v1/academics/classes` | `listClasses` | Router-level or none | Yes/guarded | `backend/src/routes/academic.routes.ts:84` |
| GET | `/api/v1/academics/classes/:id` | `getClass` | Router-level or none | Yes/guarded | `backend/src/routes/academic.routes.ts:85` |
| PATCH | `/api/v1/academics/classes/:id` | `updateClass` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:86` |
| DELETE | `/api/v1/academics/classes/:id` | `deleteClass` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:87` |
| POST | `/api/v1/academics/sections` | `createSection` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:89` |
| GET | `/api/v1/academics/sections` | `listSections` | Router-level or none | Yes/guarded | `backend/src/routes/academic.routes.ts:90` |
| GET | `/api/v1/academics/sections/:id` | `getSection` | Router-level or none | Yes/guarded | `backend/src/routes/academic.routes.ts:91` |
| PATCH | `/api/v1/academics/sections/:id` | `updateSection` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:92` |
| DELETE | `/api/v1/academics/sections/:id` | `deleteSection` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:93` |
| POST | `/api/v1/academics/subjects` | `createSubject` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:95` |
| GET | `/api/v1/academics/subjects` | `listSubjects` | Router-level or none | Yes/guarded | `backend/src/routes/academic.routes.ts:96` |
| GET | `/api/v1/academics/subjects/:id` | `getSubject` | Router-level or none | Yes/guarded | `backend/src/routes/academic.routes.ts:97` |
| PATCH | `/api/v1/academics/subjects/:id` | `updateSubject` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:98` |
| DELETE | `/api/v1/academics/subjects/:id` | `deleteSubject` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:99` |
| GET | `/api/v1/academics/exam-types` | `listExamTypes` | Router-level or none | Yes/guarded | `backend/src/routes/academic.routes.ts:101` |
| POST | `/api/v1/academics/exam-types` | `createExamType` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:102` |
| PATCH | `/api/v1/academics/exam-types/:id` | `updateExamType` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:103` |
| POST | `/api/v1/academics/attendance-periods` | `createAttendancePeriod` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:104` |
| GET | `/api/v1/academics/attendance-periods` | `listAttendancePeriods` | Router-level or none | Yes/guarded | `backend/src/routes/academic.routes.ts:105` |
| DELETE | `/api/v1/academics/attendance-periods/:id` | `deleteAttendancePeriod` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:106` |
| GET | `/api/v1/academics/attendance-mode` | `getAttendanceMode` | Router-level or none | Yes/guarded | `backend/src/routes/academic.routes.ts:108` |
| PUT | `/api/v1/academics/attendance-mode` | `updateAttendanceMode` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:109` |
| POST | `/api/v1/academics/timetable/versions` | `createTimetableVersionApi` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:111` |
| GET | `/api/v1/academics/timetable/versions` | `listTimetableVersionsApi` | Router-level or none | Yes/guarded | `backend/src/routes/academic.routes.ts:112` |
| POST | `/api/v1/academics/timetable/entries/bulk` | `bulkUpsertTimetableEntriesApi` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:113` |
| GET | `/api/v1/academics/timetable/entries` | `listTimetableEntriesApi` | Router-level or none | Yes/guarded | `backend/src/routes/academic.routes.ts:114` |
| GET | `/api/v1/academics/timetable/teachers` | `listTimetableTeachersApi` | Router-level or none | Yes/guarded | `backend/src/routes/academic.routes.ts:115` |
| POST | `/api/v1/academics/timetable/versions/:id/publish` | `publishTimetableVersionApi` | `schoolAdminOnly` | Yes/guarded | `backend/src/routes/academic.routes.ts:116` |
| GET | `/api/v1/academics/timetable/teacher` | `getTeacherTimetableApi` | Router-level or none | Yes/guarded | `backend/src/routes/academic.routes.ts:117` |
| GET | `/api/v1/academic-setup/classes` | `listSetupClasses` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:43` |
| POST | `/api/v1/academic-setup/classes` | `createSetupClass` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:44` |
| PATCH | `/api/v1/academic-setup/classes/:id` | `updateSetupClass` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:45` |
| DELETE | `/api/v1/academic-setup/classes/:id` | `deleteSetupClass` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:46` |
| GET | `/api/v1/academic-setup/sections` | `listSetupSections` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:48` |
| POST | `/api/v1/academic-setup/sections` | `createSetupSection` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:49` |
| PATCH | `/api/v1/academic-setup/sections/:id` | `updateSetupSection` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:50` |
| DELETE | `/api/v1/academic-setup/sections/:id` | `deleteSetupSection` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:51` |
| GET | `/api/v1/academic-setup/subjects` | `listSetupSubjects` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:53` |
| POST | `/api/v1/academic-setup/subjects` | `createSetupSubject` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:54` |
| PATCH | `/api/v1/academic-setup/subjects/:id` | `updateSetupSubject` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:55` |
| DELETE | `/api/v1/academic-setup/subjects/:id` | `deleteSetupSubject` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:56` |
| GET | `/api/v1/academic-setup/rooms` | `listClassRooms` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:58` |
| POST | `/api/v1/academic-setup/rooms` | `createClassRoom` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:59` |
| PATCH | `/api/v1/academic-setup/rooms/:id` | `updateClassRoom` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:60` |
| DELETE | `/api/v1/academic-setup/rooms/:id` | `deleteClassRoom` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:61` |
| GET | `/api/v1/academic-setup/time-periods` | `listTimePeriods` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:63` |
| POST | `/api/v1/academic-setup/time-periods/defaults` | `seedDefaultTimePeriods` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:64` |
| POST | `/api/v1/academic-setup/time-periods` | `createTimePeriod` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:65` |
| PATCH | `/api/v1/academic-setup/time-periods/:id` | `updateTimePeriod` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:66` |
| DELETE | `/api/v1/academic-setup/time-periods/:id` | `deleteTimePeriod` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:67` |
| GET | `/api/v1/academic-setup/assign-subjects` | `listAssignSubjects` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:69` |
| POST | `/api/v1/academic-setup/assign-subjects` | `saveAssignSubjects` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:70` |
| DELETE | `/api/v1/academic-setup/assign-subjects/:id` | `deleteAssignSubject` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:71` |
| GET | `/api/v1/academic-setup/class-teachers` | `listClassTeachers` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:73` |
| POST | `/api/v1/academic-setup/class-teachers` | `saveClassTeacher` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:74` |
| PATCH | `/api/v1/academic-setup/class-teachers/:id` | `updateClassTeacher` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:75` |
| DELETE | `/api/v1/academic-setup/class-teachers/:id` | `deleteClassTeacher` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:76` |
| GET | `/api/v1/academic-setup/routines` | `listClassRoutines` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:78` |
| POST | `/api/v1/academic-setup/routines` | `createClassRoutine` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:79` |
| POST | `/api/v1/academic-setup/routines/generate` | `generateClassRoutine` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:80` |
| PATCH | `/api/v1/academic-setup/routines/:id` | `updateClassRoutine` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:81` |
| DELETE | `/api/v1/academic-setup/routines/:id` | `deleteClassRoutine` | Router-level or none | Yes/guarded | `backend/src/routes/academicSetup.routes.ts:82` |
| GET | `/api/v1/admin/dashboard/` | `getAdminDashboardApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminDashboard.routes.ts:23` |
| GET | `/api/v1/admin/dashboard/summary` | `getDashboardSummaryApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminDashboard.routes.ts:24` |
| GET | `/api/v1/admin/dashboard/school-growth` | `getSchoolGrowthApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminDashboard.routes.ts:25` |
| GET | `/api/v1/admin/dashboard/revenue` | `getRevenueSummaryApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminDashboard.routes.ts:26` |
| GET | `/api/v1/admin/dashboard/activity` | `getPlatformActivityApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminDashboard.routes.ts:27` |
| GET | `/api/v1/admin/dashboard/support-summary` | `getSupportSummaryApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminDashboard.routes.ts:28` |
| GET | `/api/v1/admin/dashboard/top-schools` | `getTopSchoolsApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminDashboard.routes.ts:29` |
| GET | `/api/v1/admin/dashboard/analytics/weekly` | `getWeeklyAnalyticsApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminDashboard.routes.ts:30` |
| GET | `/api/v1/admin/dashboard/performance` | `getPerformanceMetricsApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminDashboard.routes.ts:31` |
| GET | `/api/v1/admin/dashboard/activities` | `getRecentActivitiesApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminDashboard.routes.ts:32` |
| GET | `/api/v1/admin/dashboard/system-status` | `getSystemStatusApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminDashboard.routes.ts:33` |
| GET | `/api/v1/admin/system-health` | `getSystemHealthApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminSystem.routes.ts:11` |
| GET | `/api/v1/admin/users/` | `listAdminUsersApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminUser.routes.ts:23` |
| GET | `/api/v1/admin/users/summary` | `getAdminUsersSummaryApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminUser.routes.ts:24` |
| GET | `/api/v1/admin/users/:id` | `getAdminUserByIdApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminUser.routes.ts:25` |
| PATCH | `/api/v1/admin/users/:id/status` | `updateAdminUserStatusApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminUser.routes.ts:26` |
| PATCH | `/api/v1/admin/users/:id/lock` | `lockAdminUserApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminUser.routes.ts:27` |
| PATCH | `/api/v1/admin/users/:id/unlock` | `unlockAdminUserApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminUser.routes.ts:28` |
| POST | `/api/v1/admin/users/:id/force-password-reset` | `forceAdminPasswordResetApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminUser.routes.ts:29` |
| POST | `/api/v1/admin/users/:id/revoke-sessions` | `revokeAdminUserSessionsApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminUser.routes.ts:30` |
| POST | `/api/v1/admin/users/:id/disable-mfa` | `disableAdminUserMfaApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminUser.routes.ts:31` |
| GET | `/api/v1/admin/users/:id/activity` | `getAdminUserActivityApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminUser.routes.ts:32` |
| GET | `/api/v1/admin/users/:id/sessions` | `getAdminUserSessionsApi` | Router-level or none | Yes/guarded | `backend/src/routes/adminUser.routes.ts:33` |
| GET | `/api/v1/analytics/` | `getAnalytics` | Router-level or none | Yes/guarded | `backend/src/routes/analytics.routes.ts:9` |
| POST | `/api/v1/attendance/sessions` | `createAttendanceSessionApi` | `requireRole('SCHOOL_ADMIN', 'TEACHER')` | Yes/guarded | `backend/src/routes/attendance.routes.ts:39` |
| PATCH | `/api/v1/attendance/sessions/:id` | `updateAttendanceSessionApi` | `requireRole('SCHOOL_ADMIN', 'TEACHER')` | Yes/guarded | `backend/src/routes/attendance.routes.ts:40` |
| POST | `/api/v1/attendance/sessions/:id/lock` | `lockAttendanceSessionApi` | `requireRole('SCHOOL_ADMIN')` | Yes/guarded | `backend/src/routes/attendance.routes.ts:41` |
| GET | `/api/v1/attendance/summary` | `attendanceSummaryApi` | `requireRole('SCHOOL_ADMIN', 'TEACHER')` | Yes/guarded | `backend/src/routes/attendance.routes.ts:42` |
| POST | `/api/v1/attendance/teacher/self` | `markTeacherSelfAttendanceApi` | `requireRole('SCHOOL_ADMIN', 'TEACHER')` | Yes/guarded | `backend/src/routes/attendance.routes.ts:43` |
| GET | `/api/v1/attendance/teacher/self` | `listTeacherSelfAttendanceApi` | `requireRole('SCHOOL_ADMIN', 'TEACHER')` | Yes/guarded | `backend/src/routes/attendance.routes.ts:44` |
| POST | `/api/v1/attendance/substitutions` | `createAttendanceSubstitutionApi` | `requirePermission('attendance.substitute.manage')` | Yes/guarded | `backend/src/routes/attendance.routes.ts:45` |
| GET | `/api/v1/attendance/substitutions` | `listAttendanceSubstitutionsApi` | `requirePermission('attendance.substitute.manage')` | Yes/guarded | `backend/src/routes/attendance.routes.ts:46` |
| PATCH | `/api/v1/attendance/substitutions/:id/cancel` | `cancelAttendanceSubstitutionApi` | `requirePermission('attendance.substitute.manage')` | Yes/guarded | `backend/src/routes/attendance.routes.ts:47` |
| POST | `/api/v1/attendance/periods` | `createAttendancePeriod` | Router-level or none | Yes/guarded | `backend/src/routes/attendance.routes.ts:50` |
| GET | `/api/v1/attendance/periods` | `listAttendancePeriods` | Router-level or none | Yes/guarded | `backend/src/routes/attendance.routes.ts:51` |
| GET | `/api/v1/attendance/periods/:id` | `getAttendancePeriod` | Router-level or none | Yes/guarded | `backend/src/routes/attendance.routes.ts:52` |
| PATCH | `/api/v1/attendance/periods/:id` | `updateAttendancePeriod` | Router-level or none | Yes/guarded | `backend/src/routes/attendance.routes.ts:53` |
| DELETE | `/api/v1/attendance/periods/:id` | `deleteAttendancePeriod` | Router-level or none | Yes/guarded | `backend/src/routes/attendance.routes.ts:54` |
| POST | `/api/v1/attendance/legacy/sessions` | `startSession` | Router-level or none | Yes/guarded | `backend/src/routes/attendance.routes.ts:56` |
| GET | `/api/v1/attendance/legacy/sessions` | `listSessions` | Router-level or none | Yes/guarded | `backend/src/routes/attendance.routes.ts:57` |
| POST | `/api/v1/attendance/legacy/sessions/:id/close` | `closeSession` | Router-level or none | Yes/guarded | `backend/src/routes/attendance.routes.ts:58` |
| POST | `/api/v1/attendance/legacy/records` | `markAttendance` | `idempotencyMiddleware` | Yes/guarded | `backend/src/routes/attendance.routes.ts:59` |
| PATCH | `/api/v1/attendance/legacy/records/:id/override` | `overrideAttendance` | Router-level or none | Yes/guarded | `backend/src/routes/attendance.routes.ts:60` |
| GET | `/api/v1/attendance/legacy/sessions/:sessionId/records` | `listSessionRecords` | Router-level or none | Yes/guarded | `backend/src/routes/attendance.routes.ts:61` |
| POST | `/api/v1/attendance-approval/sessions/:sessionId/approve` | `approveSession` | Router-level or none | Yes/guarded | `backend/src/routes/attendanceApproval.routes.ts:9` |
| POST | `/api/v1/attendance-approval/sessions/:sessionId/reject` | `rejectSession` | Router-level or none | Yes/guarded | `backend/src/routes/attendanceApproval.routes.ts:10` |
| GET | `/api/v1/attendance-summary/` | `getAttendanceSummaryApi` | Router-level or none | Yes/guarded | `backend/src/routes/attendanceSummary.routes.ts:11` |
| GET | `/api/v1/audit-logs/` | `listAuditLogs` | Router-level or none | Yes/guarded | `backend/src/routes/auditLog.routes.ts:22` |
| GET | `/api/v1/admin/audit-logs/` | `listAdminAuditLogsApi` | Router-level or none | Yes/guarded | `backend/src/routes/auditLog.routes.ts:26` |
| GET | `/api/v1/admin/audit-logs/summary` | `getAdminAuditSummaryApi` | Router-level or none | Yes/guarded | `backend/src/routes/auditLog.routes.ts:27` |
| GET | `/api/v1/admin/audit-logs/high-risk` | `getAdminHighRiskAuditLogsApi` | Router-level or none | Yes/guarded | `backend/src/routes/auditLog.routes.ts:28` |
| POST | `/api/v1/admin/audit-logs/export` | `requestAdminAuditExportApi` | Router-level or none | Yes/guarded | `backend/src/routes/auditLog.routes.ts:29` |
| GET | `/api/v1/admin/audit-logs/:id` | `getAdminAuditLogDetailApi` | Router-level or none | Yes/guarded | `backend/src/routes/auditLog.routes.ts:30` |
| GET | `/api/v1/admin/audit-exports/` | `listAdminAuditExportsApi` | Router-level or none | Yes/guarded | `backend/src/routes/auditLog.routes.ts:34` |
| GET | `/api/v1/admin/audit-exports/:id` | `getAdminAuditExportApi` | Router-level or none | Yes/guarded | `backend/src/routes/auditLog.routes.ts:35` |
| GET | `/api/v1/admin/audit-exports/:id/download` | `downloadAdminAuditExportApi` | Router-level or none | Yes/guarded | `backend/src/routes/auditLog.routes.ts:36` |
| GET | `/api/v1/auth/login-experience` | `getPublicLoginExperience` | Router-level or none | Route-specific/open | `backend/src/routes/auth.routes.ts:30` |
| GET | `/api/auth/login-experience` | `getPublicLoginExperience` | Router-level or none | Route-specific/open | `backend/src/routes/auth.routes.ts:30` |
| POST | `/api/v1/auth/login` | `login` | `loginIpRateLimit()` | Route-specific/open | `backend/src/routes/auth.routes.ts:32` |
| POST | `/api/auth/login` | `login` | `loginIpRateLimit()` | Route-specific/open | `backend/src/routes/auth.routes.ts:32` |
| POST | `/api/v1/auth/verify-2fa` | `verifyTwoFactor` | `mfaVerifyRateLimit()` | Route-specific/open | `backend/src/routes/auth.routes.ts:34` |
| POST | `/api/auth/verify-2fa` | `verifyTwoFactor` | `mfaVerifyRateLimit()` | Route-specific/open | `backend/src/routes/auth.routes.ts:34` |
| POST | `/api/v1/auth/resend-2fa` | `resendTwoFactor` | `mfaResendIpRateLimit()` | Route-specific/open | `backend/src/routes/auth.routes.ts:36` |
| POST | `/api/auth/resend-2fa` | `resendTwoFactor` | `mfaResendIpRateLimit()` | Route-specific/open | `backend/src/routes/auth.routes.ts:36` |
| POST | `/api/v1/auth/totp/setup` | `startTotpSetup` | `authMiddleware` | Yes/guarded | `backend/src/routes/auth.routes.ts:38` |
| POST | `/api/auth/totp/setup` | `startTotpSetup` | `authMiddleware` | Yes/guarded | `backend/src/routes/auth.routes.ts:38` |
| POST | `/api/v1/auth/totp/verify-setup` | `verifyTotpSetup` | `authMiddleware` | Yes/guarded | `backend/src/routes/auth.routes.ts:40` |
| POST | `/api/auth/totp/verify-setup` | `verifyTotpSetup` | `authMiddleware` | Yes/guarded | `backend/src/routes/auth.routes.ts:40` |
| POST | `/api/v1/auth/totp/disable` | `disableTotp` | `authMiddleware` | Yes/guarded | `backend/src/routes/auth.routes.ts:42` |
| POST | `/api/auth/totp/disable` | `disableTotp` | `authMiddleware` | Yes/guarded | `backend/src/routes/auth.routes.ts:42` |
| POST | `/api/v1/auth/totp/verify-login` | `verifyTotpLogin` | `mfaVerifyRateLimit()` | Route-specific/open | `backend/src/routes/auth.routes.ts:44` |
| POST | `/api/auth/totp/verify-login` | `verifyTotpLogin` | `mfaVerifyRateLimit()` | Route-specific/open | `backend/src/routes/auth.routes.ts:44` |
| POST | `/api/v1/auth/forgot-password` | `forgotPassword` | `forgotPasswordRateLimit()` | Route-specific/open | `backend/src/routes/auth.routes.ts:46` |
| POST | `/api/auth/forgot-password` | `forgotPassword` | `forgotPasswordRateLimit()` | Route-specific/open | `backend/src/routes/auth.routes.ts:46` |
| POST | `/api/v1/auth/reset-password` | `resetPassword` | Router-level or none | Route-specific/open | `backend/src/routes/auth.routes.ts:48` |
| POST | `/api/auth/reset-password` | `resetPassword` | Router-level or none | Route-specific/open | `backend/src/routes/auth.routes.ts:48` |
| POST | `/api/v1/auth/refresh` | `refreshToken` | Router-level or none | Route-specific/open | `backend/src/routes/auth.routes.ts:50` |
| POST | `/api/auth/refresh` | `refreshToken` | Router-level or none | Route-specific/open | `backend/src/routes/auth.routes.ts:50` |
| POST | `/api/v1/auth/logout` | `logout` | Router-level or none | Route-specific/open | `backend/src/routes/auth.routes.ts:52` |
| POST | `/api/auth/logout` | `logout` | Router-level or none | Route-specific/open | `backend/src/routes/auth.routes.ts:52` |
| POST | `/api/v1/auth/change-password` | `changePassword` | `authMiddleware` | Yes/guarded | `backend/src/routes/auth.routes.ts:54` |
| POST | `/api/auth/change-password` | `changePassword` | `authMiddleware` | Yes/guarded | `backend/src/routes/auth.routes.ts:54` |
| GET | `/api/v1/auth/sessions` | `listSessions` | `authMiddleware` | Yes/guarded | `backend/src/routes/auth.routes.ts:56` |
| GET | `/api/auth/sessions` | `listSessions` | `authMiddleware` | Yes/guarded | `backend/src/routes/auth.routes.ts:56` |
| DELETE | `/api/v1/auth/sessions/:sessionId` | `revokeSession` | `authMiddleware` | Yes/guarded | `backend/src/routes/auth.routes.ts:58` |
| DELETE | `/api/auth/sessions/:sessionId` | `revokeSession` | `authMiddleware` | Yes/guarded | `backend/src/routes/auth.routes.ts:58` |
| POST | `/api/v1/auth/logout-all` | `logoutAll` | `authMiddleware` | Yes/guarded | `backend/src/routes/auth.routes.ts:60` |
| POST | `/api/auth/logout-all` | `logoutAll` | `authMiddleware` | Yes/guarded | `backend/src/routes/auth.routes.ts:60` |
| POST | `/api/v1/backups/backups` | `requestBackup` | Router-level or none | Yes/guarded | `backend/src/routes/backup.routes.ts:20` |
| POST | `/api/v1/admin/backups` | `requestBackup` | Router-level or none | Yes/guarded | `backend/src/routes/backup.routes.ts:20` |
| GET | `/api/v1/backups/backups` | `listBackups` | Router-level or none | Yes/guarded | `backend/src/routes/backup.routes.ts:21` |
| GET | `/api/v1/admin/backups` | `listBackups` | Router-level or none | Yes/guarded | `backend/src/routes/backup.routes.ts:21` |
| GET | `/api/v1/backups/backups/:id` | `getBackup` | Router-level or none | Yes/guarded | `backend/src/routes/backup.routes.ts:22` |
| GET | `/api/v1/admin/backups/:id` | `getBackup` | Router-level or none | Yes/guarded | `backend/src/routes/backup.routes.ts:22` |
| POST | `/api/v1/backups/restores` | `requestRestore` | Router-level or none | Yes/guarded | `backend/src/routes/backup.routes.ts:23` |
| POST | `/api/v1/admin/restores` | `requestRestore` | Router-level or none | Yes/guarded | `backend/src/routes/backup.routes.ts:23` |
| GET | `/api/v1/backups/restores` | `listRestores` | Router-level or none | Yes/guarded | `backend/src/routes/backup.routes.ts:24` |
| GET | `/api/v1/admin/restores` | `listRestores` | Router-level or none | Yes/guarded | `backend/src/routes/backup.routes.ts:24` |
| GET | `/api/v1/backups/restores/:id` | `getRestore` | Router-level or none | Yes/guarded | `backend/src/routes/backup.routes.ts:25` |
| GET | `/api/v1/admin/restores/:id` | `getRestore` | Router-level or none | Yes/guarded | `backend/src/routes/backup.routes.ts:25` |
| POST | `/api/v1/backups/restores/:id/approve` | `approveRestore` | Router-level or none | Yes/guarded | `backend/src/routes/backup.routes.ts:26` |
| POST | `/api/v1/admin/restores/:id/approve` | `approveRestore` | Router-level or none | Yes/guarded | `backend/src/routes/backup.routes.ts:26` |
| POST | `/api/v1/backups/restores/:id/reject` | `rejectRestore` | Router-level or none | Yes/guarded | `backend/src/routes/backup.routes.ts:27` |
| POST | `/api/v1/admin/restores/:id/reject` | `rejectRestore` | Router-level or none | Yes/guarded | `backend/src/routes/backup.routes.ts:27` |
| POST | `/api/v1/consents/documents` | `createDocumentApi` | Router-level or none | Yes/guarded | `backend/src/routes/consent.routes.ts:14` |
| POST | `/api/v1/consents/records` | `grantConsentApi` | Router-level or none | Yes/guarded | `backend/src/routes/consent.routes.ts:15` |
| GET | `/api/v1/consents/records` | `listConsentApi` | Router-level or none | Yes/guarded | `backend/src/routes/consent.routes.ts:16` |
| POST | `/api/v1/consents/records/:id/withdraw` | `withdrawConsentApi` | Router-level or none | Yes/guarded | `backend/src/routes/consent.routes.ts:17` |
| POST | `/api/v1/compliance/exports` | `requestExport` | `requireSchoolAdminOrSuperAdmin` | Yes/guarded | `backend/src/routes/dataCompliance.routes.ts:29` |
| GET | `/api/v1/compliance/exports/:id` | `getExportStatus` | `requireSchoolAdminOrSuperAdmin` | Yes/guarded | `backend/src/routes/dataCompliance.routes.ts:30` |
| POST | `/api/v1/compliance/deletions` | `requestDeletionApi` | `requireSchoolAdminOrSuperAdmin` | Yes/guarded | `backend/src/routes/dataCompliance.routes.ts:32` |
| GET | `/api/v1/compliance/deletions` | `listDeletionJobsApi` | `requireSchoolAdminOrSuperAdmin` | Yes/guarded | `backend/src/routes/dataCompliance.routes.ts:33` |
| POST | `/api/v1/compliance/deletions/:id/approve` | `approveDeletionApi` | `requireSuperAdmin` | Yes/guarded | `backend/src/routes/dataCompliance.routes.ts:34` |
| POST | `/api/v1/compliance/deletions/:id/execute` | `executeDeletionApi` | `requireSuperAdmin` | Yes/guarded | `backend/src/routes/dataCompliance.routes.ts:35` |
| GET | `/api/v1/admin/compliance/summary` | `getComplianceSummaryApi` | Router-level or none | Yes/guarded | `backend/src/routes/dataCompliance.routes.ts:40` |
| GET | `/api/v1/admin/compliance/export-requests` | `listExportRequestsApi` | Router-level or none | Yes/guarded | `backend/src/routes/dataCompliance.routes.ts:41` |
| GET | `/api/v1/admin/compliance/export-requests/:id` | `getExportRequestByIdApi` | Router-level or none | Yes/guarded | `backend/src/routes/dataCompliance.routes.ts:42` |
| POST | `/api/v1/admin/compliance/export-requests/:id/approve` | `approveExportRequestApi` | Router-level or none | Yes/guarded | `backend/src/routes/dataCompliance.routes.ts:43` |
| POST | `/api/v1/admin/compliance/export-requests/:id/reject` | `rejectExportRequestApi` | Router-level or none | Yes/guarded | `backend/src/routes/dataCompliance.routes.ts:44` |
| GET | `/api/v1/admin/compliance/deletion-requests` | `listDeletionRequestsApi` | Router-level or none | Yes/guarded | `backend/src/routes/dataCompliance.routes.ts:46` |
| GET | `/api/v1/admin/compliance/deletion-requests/:id` | `getDeletionRequestByIdApi` | Router-level or none | Yes/guarded | `backend/src/routes/dataCompliance.routes.ts:47` |
| POST | `/api/v1/admin/compliance/deletion-requests/:id/approve` | `approveDeletionRequestApi` | Router-level or none | Yes/guarded | `backend/src/routes/dataCompliance.routes.ts:48` |
| POST | `/api/v1/admin/compliance/deletion-requests/:id/reject` | `rejectDeletionRequestApi` | Router-level or none | Yes/guarded | `backend/src/routes/dataCompliance.routes.ts:49` |
| GET | `/api/v1/admin/compliance/consents` | `listConsentRecordsApi` | Router-level or none | Yes/guarded | `backend/src/routes/dataCompliance.routes.ts:51` |
| GET | `/api/v1/admin/compliance/jobs` | `listComplianceJobsApi` | Router-level or none | Yes/guarded | `backend/src/routes/dataCompliance.routes.ts:52` |
| GET | `/api/v1/dormitories/report` | `getStudentDormitoryReport` | Router-level or none | Yes/guarded | `backend/src/routes/dormitory.routes.ts:23` |
| GET | `/api/v1/dormitories/room-types` | `listDormitoryRoomTypes` | Router-level or none | Yes/guarded | `backend/src/routes/dormitory.routes.ts:25` |
| POST | `/api/v1/dormitories/room-types` | `createDormitoryRoomType` | Router-level or none | Yes/guarded | `backend/src/routes/dormitory.routes.ts:26` |
| PATCH | `/api/v1/dormitories/room-types/:id` | `updateDormitoryRoomType` | Router-level or none | Yes/guarded | `backend/src/routes/dormitory.routes.ts:27` |
| DELETE | `/api/v1/dormitories/room-types/:id` | `deleteDormitoryRoomType` | Router-level or none | Yes/guarded | `backend/src/routes/dormitory.routes.ts:28` |
| GET | `/api/v1/dormitories/rooms` | `listDormitoryRooms` | Router-level or none | Yes/guarded | `backend/src/routes/dormitory.routes.ts:30` |
| POST | `/api/v1/dormitories/rooms` | `createDormitoryRoom` | Router-level or none | Yes/guarded | `backend/src/routes/dormitory.routes.ts:31` |
| PATCH | `/api/v1/dormitories/rooms/:id` | `updateDormitoryRoom` | Router-level or none | Yes/guarded | `backend/src/routes/dormitory.routes.ts:32` |
| DELETE | `/api/v1/dormitories/rooms/:id` | `deleteDormitoryRoom` | Router-level or none | Yes/guarded | `backend/src/routes/dormitory.routes.ts:33` |
| GET | `/api/v1/dormitories/` | `listDormitories` | Router-level or none | Yes/guarded | `backend/src/routes/dormitory.routes.ts:35` |
| POST | `/api/v1/dormitories/` | `createDormitory` | Router-level or none | Yes/guarded | `backend/src/routes/dormitory.routes.ts:36` |
| PATCH | `/api/v1/dormitories/:id` | `updateDormitory` | Router-level or none | Yes/guarded | `backend/src/routes/dormitory.routes.ts:37` |
| DELETE | `/api/v1/dormitories/:id` | `deleteDormitory` | Router-level or none | Yes/guarded | `backend/src/routes/dormitory.routes.ts:38` |
| POST | `/api/v1/attendance/evidence/` | `createEvidence` | Router-level or none | Yes/guarded | `backend/src/routes/evidence.routes.ts:9` |
| GET | `/api/v1/attendance/evidence/:recordId` | `listEvidence` | Router-level or none | Yes/guarded | `backend/src/routes/evidence.routes.ts:11` |
| POST | `/api/v1/exams/` | `createExam` | Router-level or none | Yes/guarded | `backend/src/routes/exam.routes.ts:26` |
| GET | `/api/v1/exams/` | `listExams` | Router-level or none | Yes/guarded | `backend/src/routes/exam.routes.ts:27` |
| GET | `/api/v1/exams/grading-settings` | `getExamGradingSettingsApi` | Router-level or none | Yes/guarded | `backend/src/routes/exam.routes.ts:28` |
| PUT | `/api/v1/exams/grading-settings` | `updateExamGradingSettingsApi` | Router-level or none | Yes/guarded | `backend/src/routes/exam.routes.ts:29` |
| GET | `/api/v1/exams/marks` | `listMarks` | Router-level or none | Yes/guarded | `backend/src/routes/exam.routes.ts:30` |
| GET | `/api/v1/exams/:id` | `getExam` | Router-level or none | Yes/guarded | `backend/src/routes/exam.routes.ts:31` |
| PATCH | `/api/v1/exams/:id` | `updateExam` | Router-level or none | Yes/guarded | `backend/src/routes/exam.routes.ts:32` |
| DELETE | `/api/v1/exams/:id` | `deleteExam` | Router-level or none | Yes/guarded | `backend/src/routes/exam.routes.ts:33` |
| POST | `/api/v1/exams/papers` | `createExamPaper` | Router-level or none | Yes/guarded | `backend/src/routes/exam.routes.ts:35` |
| POST | `/api/v1/exams/marks/upload` | `uploadMarks` | Router-level or none | Yes/guarded | `backend/src/routes/exam.routes.ts:36` |
| POST | `/api/v1/exams/marks/:id/moderate` | `moderateMark` | Router-level or none | Yes/guarded | `backend/src/routes/exam.routes.ts:37` |
| POST | `/api/v1/exams/marks/:id/revaluation` | `requestRevaluation` | Router-level or none | Yes/guarded | `backend/src/routes/exam.routes.ts:38` |
| POST | `/api/v1/faces/enroll` | `enrollFace` | Router-level or none | Yes/guarded | `backend/src/routes/face.routes.ts:16` |
| POST | `/api/v1/faces/re-enroll` | `reEnroll` | Router-level or none | Yes/guarded | `backend/src/routes/face.routes.ts:17` |
| POST | `/api/v1/faces/:id/approve` | `approveFace` | Router-level or none | Yes/guarded | `backend/src/routes/face.routes.ts:18` |
| POST | `/api/v1/faces/:id/reject` | `rejectFace` | Router-level or none | Yes/guarded | `backend/src/routes/face.routes.ts:19` |
| GET | `/api/v1/faces/:id` | `getFaceProfile` | Router-level or none | Yes/guarded | `backend/src/routes/face.routes.ts:20` |
| GET | `/api/v1/faces/by-student/:studentId` | `getStudentFaceProfile` | Router-level or none | Yes/guarded | `backend/src/routes/face.routes.ts:21` |
| GET | `/api/v1/features/login-experience` | `getLoginExperienceSettings` | Router-level or none | Yes/guarded | `backend/src/routes/feature-flag.routes.ts:26` |
| PUT | `/api/v1/features/login-experience` | `updateLoginExperienceSettings` | Router-level or none | Yes/guarded | `backend/src/routes/feature-flag.routes.ts:27` |
| GET | `/api/v1/features/auth-security` | `getAuthSecuritySettingsApi` | Router-level or none | Yes/guarded | `backend/src/routes/feature-flag.routes.ts:28` |
| PUT | `/api/v1/features/auth-security` | `updateAuthSecuritySettingsApi` | Router-level or none | Yes/guarded | `backend/src/routes/feature-flag.routes.ts:29` |
| POST | `/api/v1/features/flags` | `createFeatureFlag` | Router-level or none | Yes/guarded | `backend/src/routes/feature-flag.routes.ts:31` |
| GET | `/api/v1/features/flags` | `listFeatureFlags` | Router-level or none | Yes/guarded | `backend/src/routes/feature-flag.routes.ts:32` |
| PATCH | `/api/v1/features/flags/:id` | `updateFeatureFlag` | Router-level or none | Yes/guarded | `backend/src/routes/feature-flag.routes.ts:33` |
| DELETE | `/api/v1/features/flags/:id` | `deleteFeatureFlag` | Router-level or none | Yes/guarded | `backend/src/routes/feature-flag.routes.ts:34` |
| POST | `/api/v1/features/overrides` | `setFeatureOverride` | Router-level or none | Yes/guarded | `backend/src/routes/feature-flag.routes.ts:35` |
| POST | `/api/v1/features/configs` | `createConfigEntry` | Router-level or none | Yes/guarded | `backend/src/routes/feature-flag.routes.ts:37` |
| GET | `/api/v1/features/configs` | `listConfigEntries` | Router-level or none | Yes/guarded | `backend/src/routes/feature-flag.routes.ts:38` |
| PATCH | `/api/v1/features/configs/:id` | `updateConfigEntry` | Router-level or none | Yes/guarded | `backend/src/routes/feature-flag.routes.ts:39` |
| POST | `/api/v1/features/configs/overrides` | `setTenantConfigOverride` | Router-level or none | Yes/guarded | `backend/src/routes/feature-flag.routes.ts:40` |
| GET | `/api/v1/fees/metadata` | `getFeeMetadata` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:36` |
| GET | `/api/v1/fees/particulars` | `listFeeParticulars` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:38` |
| POST | `/api/v1/fees/particulars` | `createFeeParticular` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:39` |
| PATCH | `/api/v1/fees/particulars/:id` | `updateFeeParticular` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:40` |
| DELETE | `/api/v1/fees/particulars/:id` | `deleteFeeParticular` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:41` |
| GET | `/api/v1/fees/types` | `listFeeTypes` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:43` |
| POST | `/api/v1/fees/types` | `createFeeType` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:44` |
| PATCH | `/api/v1/fees/types/:id` | `updateFeeType` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:45` |
| DELETE | `/api/v1/fees/types/:id` | `deleteFeeType` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:46` |
| GET | `/api/v1/fees/structures` | `listFeeStructures` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:48` |
| POST | `/api/v1/fees/structures` | `createFeeStructure` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:49` |
| PATCH | `/api/v1/fees/structures/:id` | `updateFeeStructure` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:50` |
| DELETE | `/api/v1/fees/structures/:id` | `deleteFeeStructure` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:51` |
| POST | `/api/v1/fees/structures/:id/duplicate` | `duplicateFeeStructure` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:52` |
| GET | `/api/v1/fees/assignments` | `listFeeAssignments` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:54` |
| POST | `/api/v1/fees/assignments` | `assignStudentFees` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:55` |
| GET | `/api/v1/fees/invoices` | `listFeeInvoices` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:57` |
| POST | `/api/v1/fees/invoices/generate` | `generateFeeInvoices` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:58` |
| GET | `/api/v1/fees/payments` | `listFeePayments` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:60` |
| POST | `/api/v1/fees/payments` | `collectFeePayment` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:61` |
| GET | `/api/v1/fees/ledger/:studentId` | `getStudentFeeLedger` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:63` |
| GET | `/api/v1/fees/discounts` | `listFeeDiscounts` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:65` |
| POST | `/api/v1/fees/discounts` | `createFeeDiscount` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:66` |
| GET | `/api/v1/fees/fines` | `listFeeFines` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:68` |
| POST | `/api/v1/fees/fines` | `createFeeFine` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:69` |
| GET | `/api/v1/fees/reports` | `getFeeReports` | Router-level or none | Yes/guarded | `backend/src/routes/feeManagement.routes.ts:71` |
| POST | `/api/v1/homework/attachments` | `uploadHomeworkAttachment` | `homeworkAttachmentUpload.single('file')` | Yes/guarded | `backend/src/routes/homework.routes.ts:19` |
| GET | `/api/v1/homework/evaluation-report` | `getHomeworkEvaluationReport` | Router-level or none | Yes/guarded | `backend/src/routes/homework.routes.ts:20` |
| GET | `/api/v1/homework/` | `listHomeworks` | Router-level or none | Yes/guarded | `backend/src/routes/homework.routes.ts:22` |
| POST | `/api/v1/homework/` | `createHomework` | Router-level or none | Yes/guarded | `backend/src/routes/homework.routes.ts:23` |
| PATCH | `/api/v1/homework/:id` | `updateHomework` | Router-level or none | Yes/guarded | `backend/src/routes/homework.routes.ts:24` |
| DELETE | `/api/v1/homework/:id` | `deleteHomework` | Router-level or none | Yes/guarded | `backend/src/routes/homework.routes.ts:25` |
| GET | `/api/v1/homework/:id/evaluations` | `getHomeworkEvaluation` | Router-level or none | Yes/guarded | `backend/src/routes/homework.routes.ts:26` |
| POST | `/api/v1/homework/:id/evaluations` | `saveHomeworkEvaluation` | Router-level or none | Yes/guarded | `backend/src/routes/homework.routes.ts:27` |
| POST | `/api/v1/imports/` | `createImport` | `uploadMiddleware` | Yes/guarded | `backend/src/routes/import.routes.ts:15` |
| GET | `/api/v1/imports/` | `listImports` | Router-level or none | Yes/guarded | `backend/src/routes/import.routes.ts:16` |
| GET | `/api/v1/imports/:id` | `getImport` | Router-level or none | Yes/guarded | `backend/src/routes/import.routes.ts:17` |
| GET | `/api/v1/imports/:id/errors` | `listImportErrors` | Router-level or none | Yes/guarded | `backend/src/routes/import.routes.ts:18` |
| GET | `/api/v1/jobs/:queue/:id` | `getJobStatus` | Router-level or none | Yes/guarded | `backend/src/routes/job.routes.ts:9` |
| GET | `/api/v1/leave/types` | `listLeaveTypes` | Router-level or none | Yes/guarded | `backend/src/routes/leave.routes.ts:28` |
| POST | `/api/v1/leave/types` | `createLeaveType` | Router-level or none | Yes/guarded | `backend/src/routes/leave.routes.ts:29` |
| PATCH | `/api/v1/leave/types/:id` | `updateLeaveType` | Router-level or none | Yes/guarded | `backend/src/routes/leave.routes.ts:30` |
| DELETE | `/api/v1/leave/types/:id` | `deleteLeaveType` | Router-level or none | Yes/guarded | `backend/src/routes/leave.routes.ts:31` |
| GET | `/api/v1/leave/defines` | `listLeaveDefines` | Router-level or none | Yes/guarded | `backend/src/routes/leave.routes.ts:33` |
| POST | `/api/v1/leave/defines` | `createLeaveDefine` | Router-level or none | Yes/guarded | `backend/src/routes/leave.routes.ts:34` |
| PATCH | `/api/v1/leave/defines/:id` | `updateLeaveDefine` | Router-level or none | Yes/guarded | `backend/src/routes/leave.routes.ts:35` |
| DELETE | `/api/v1/leave/defines/:id` | `deleteLeaveDefine` | Router-level or none | Yes/guarded | `backend/src/routes/leave.routes.ts:36` |
| GET | `/api/v1/leave/balances/me` | `listMyLeaveBalances` | Router-level or none | Yes/guarded | `backend/src/routes/leave.routes.ts:38` |
| GET | `/api/v1/leave/applications` | `listLeaveApplications` | Router-level or none | Yes/guarded | `backend/src/routes/leave.routes.ts:40` |
| POST | `/api/v1/leave/applications` | `createLeaveApplication` | `leaveAttachmentUploadMiddleware` | Yes/guarded | `backend/src/routes/leave.routes.ts:41` |
| GET | `/api/v1/leave/applications/:id` | `getLeaveApplication` | Router-level or none | Yes/guarded | `backend/src/routes/leave.routes.ts:42` |
| PATCH | `/api/v1/leave/applications/:id` | `updateLeaveApplication` | `leaveAttachmentUploadMiddleware` | Yes/guarded | `backend/src/routes/leave.routes.ts:43` |
| DELETE | `/api/v1/leave/applications/:id` | `deleteLeaveApplication` | Router-level or none | Yes/guarded | `backend/src/routes/leave.routes.ts:44` |
| PATCH | `/api/v1/leave/applications/:id/status` | `updateLeaveStatus` | Router-level or none | Yes/guarded | `backend/src/routes/leave.routes.ts:45` |
| GET | `/api/v1/leave/requests` | `listLeaveApplications` | Router-level or none | Yes/guarded | `backend/src/routes/leave.routes.ts:48` |
| POST | `/api/v1/leave/requests` | `createLeaveApplication` | `leaveAttachmentUploadMiddleware` | Yes/guarded | `backend/src/routes/leave.routes.ts:49` |
| PATCH | `/api/v1/leave/requests/:id` | `updateLeaveApplication` | `leaveAttachmentUploadMiddleware` | Yes/guarded | `backend/src/routes/leave.routes.ts:50` |
| DELETE | `/api/v1/leave/requests/:id` | `deleteLeaveApplication` | Router-level or none | Yes/guarded | `backend/src/routes/leave.routes.ts:51` |
| PATCH | `/api/v1/leave/requests/:id/approve` | `approveLeaveApplication` | Router-level or none | Yes/guarded | `backend/src/routes/leave.routes.ts:52` |
| PATCH | `/api/v1/leave/requests/:id/reject` | `rejectLeaveApplication` | Router-level or none | Yes/guarded | `backend/src/routes/leave.routes.ts:53` |
| GET | `/api/v1/library/issued` | `listIssuedLibraryBooks` | Router-level or none | Yes/guarded | `backend/src/routes/library.routes.ts:25` |
| PATCH | `/api/v1/library/issues/:id/return` | `returnLibraryBook` | Router-level or none | Yes/guarded | `backend/src/routes/library.routes.ts:26` |
| GET | `/api/v1/library/categories` | `listLibraryCategories` | Router-level or none | Yes/guarded | `backend/src/routes/library.routes.ts:28` |
| POST | `/api/v1/library/categories` | `createLibraryCategory` | Router-level or none | Yes/guarded | `backend/src/routes/library.routes.ts:29` |
| PATCH | `/api/v1/library/categories/:id` | `updateLibraryCategory` | Router-level or none | Yes/guarded | `backend/src/routes/library.routes.ts:30` |
| DELETE | `/api/v1/library/categories/:id` | `deleteLibraryCategory` | Router-level or none | Yes/guarded | `backend/src/routes/library.routes.ts:31` |
| GET | `/api/v1/library/books` | `listLibraryBooks` | Router-level or none | Yes/guarded | `backend/src/routes/library.routes.ts:33` |
| POST | `/api/v1/library/books` | `createLibraryBook` | Router-level or none | Yes/guarded | `backend/src/routes/library.routes.ts:34` |
| PATCH | `/api/v1/library/books/:id` | `updateLibraryBook` | Router-level or none | Yes/guarded | `backend/src/routes/library.routes.ts:35` |
| DELETE | `/api/v1/library/books/:id` | `deleteLibraryBook` | Router-level or none | Yes/guarded | `backend/src/routes/library.routes.ts:36` |
| GET | `/api/v1/library/members` | `listLibraryMembers` | Router-level or none | Yes/guarded | `backend/src/routes/library.routes.ts:38` |
| POST | `/api/v1/library/members` | `createLibraryMember` | Router-level or none | Yes/guarded | `backend/src/routes/library.routes.ts:39` |
| DELETE | `/api/v1/library/members/:id` | `cancelLibraryMember` | Router-level or none | Yes/guarded | `backend/src/routes/library.routes.ts:40` |
| GET | `/api/v1/library/members/:memberId/issues` | `listMemberIssues` | Router-level or none | Yes/guarded | `backend/src/routes/library.routes.ts:41` |
| POST | `/api/v1/library/members/:memberId/issues` | `issueLibraryBook` | Router-level or none | Yes/guarded | `backend/src/routes/library.routes.ts:42` |
| GET | `/api/v1/admin/messaging-services/` | `listMessagingServicesAdminApi` | Router-level or none | Yes/guarded | `backend/src/routes/messagingAdmin.routes.ts:17` |
| GET | `/api/v1/admin/messaging-services/platform-email-config` | `getPlatformEmailConfigApi` | Router-level or none | Yes/guarded | `backend/src/routes/messagingAdmin.routes.ts:18` |
| PUT | `/api/v1/admin/messaging-services/platform-email-config` | `upsertPlatformEmailConfigApi` | Router-level or none | Yes/guarded | `backend/src/routes/messagingAdmin.routes.ts:19` |
| PATCH | `/api/v1/admin/messaging-services/platform-email-config/status` | `togglePlatformEmailConfigApi` | Router-level or none | Yes/guarded | `backend/src/routes/messagingAdmin.routes.ts:20` |
| PATCH | `/api/v1/admin/messaging-services/:id/status` | `updateMessagingServiceStatusApi` | Router-level or none | Yes/guarded | `backend/src/routes/messagingAdmin.routes.ts:21` |
| GET | `/api/v1/messaging-services/services` | `listMessagingServicesForSchoolApi` | Router-level or none | Yes/guarded | `backend/src/routes/messagingSettings.routes.ts:16` |
| GET | `/api/v1/messaging-services/config` | `getSchoolMessagingConfigApi` | Router-level or none | Yes/guarded | `backend/src/routes/messagingSettings.routes.ts:17` |
| PUT | `/api/v1/messaging-services/config` | `upsertSchoolMessagingConfigApi` | Router-level or none | Yes/guarded | `backend/src/routes/messagingSettings.routes.ts:18` |
| PATCH | `/api/v1/messaging-services/config/status` | `toggleSchoolMessagingConfigApi` | Router-level or none | Yes/guarded | `backend/src/routes/messagingSettings.routes.ts:19` |
| POST | `/api/v1/notifications/templates` | `createTemplate` | Router-level or none | Yes/guarded | `backend/src/routes/notification.routes.ts:15` |
| GET | `/api/v1/notifications/templates` | `listTemplates` | Router-level or none | Yes/guarded | `backend/src/routes/notification.routes.ts:16` |
| POST | `/api/v1/notifications/send` | `sendNotificationApi` | Router-level or none | Yes/guarded | `backend/src/routes/notification.routes.ts:17` |
| GET | `/api/v1/notifications/logs` | `listNotificationLogs` | Router-level or none | Yes/guarded | `backend/src/routes/notification.routes.ts:18` |
| GET | `/api/v1/notifications/summary` | `listNotificationSummary` | Router-level or none | Yes/guarded | `backend/src/routes/notification.routes.ts:19` |
| POST | `/api/v1/otp/request` | `requestOtpApi` | `otpRateLimit()` | Route-specific/open | `backend/src/routes/otp.routes.ts:7` |
| POST | `/api/v1/otp/verify` | `verifyOtpApi` | `otpRateLimit()` | Route-specific/open | `backend/src/routes/otp.routes.ts:9` |
| GET | `/api/v1/parents/portal/children` | `listParentChildren` | Router-level or none | Yes/guarded | `backend/src/routes/parentPortal.routes.ts:22` |
| GET | `/api/v1/parents/portal/profile` | `getParentProfile` | Router-level or none | Yes/guarded | `backend/src/routes/parentPortal.routes.ts:23` |
| GET | `/api/v1/parents/portal/dashboard` | `getParentDashboard` | Router-level or none | Yes/guarded | `backend/src/routes/parentPortal.routes.ts:24` |
| GET | `/api/v1/parents/portal/exams` | `listParentExams` | Router-level or none | Yes/guarded | `backend/src/routes/parentPortal.routes.ts:25` |
| GET | `/api/v1/parents/portal/results` | `getParentResults` | Router-level or none | Yes/guarded | `backend/src/routes/parentPortal.routes.ts:26` |
| GET | `/api/v1/parents/portal/subjects` | `listParentSubjects` | Router-level or none | Yes/guarded | `backend/src/routes/parentPortal.routes.ts:27` |
| GET | `/api/v1/parents/portal/attendance` | `getParentAttendance` | Router-level or none | Yes/guarded | `backend/src/routes/parentPortal.routes.ts:28` |
| GET | `/api/v1/parents/portal/notices` | `listParentNotices` | Router-level or none | Yes/guarded | `backend/src/routes/parentPortal.routes.ts:29` |
| GET | `/api/v1/parents/portal/timetable` | `listParentTimetable` | Router-level or none | Yes/guarded | `backend/src/routes/parentPortal.routes.ts:30` |
| GET | `/api/v1/parents/portal/fees` | `listParentFees` | Router-level or none | Yes/guarded | `backend/src/routes/parentPortal.routes.ts:31` |
| GET | `/api/v1/public/assets/branding` | `getPublicBrandingAsset` | Router-level or none | Route-specific/open | `backend/src/routes/publicAsset.routes.ts:6` |
| GET | `/api/v1/public/branding/login` | `getPublicLoginBranding` | Router-level or none | Route-specific/open | `backend/src/routes/publicBranding.routes.ts:6` |
| POST | `/api/v1/recognition/match` | `recognize` | `aiRateLimit(), aiProtection` | Yes/guarded | `backend/src/routes/recognition.routes.ts:11` |
| GET | `/api/v1/reports/term` | `downloadTermReport` | Router-level or none | Yes/guarded | `backend/src/routes/report.routes.ts:13` |
| GET | `/api/v1/reports/annual` | `downloadAnnualReport` | Router-level or none | Yes/guarded | `backend/src/routes/report.routes.ts:14` |
| GET | `/api/v1/reports/rank` | `downloadRankCard` | Router-level or none | Yes/guarded | `backend/src/routes/report.routes.ts:15` |
| POST | `/api/v1/admin/schools/` | `createSchoolApi` | Router-level or none | Yes/guarded | `backend/src/routes/schoolAdmin.routes.ts:22` |
| GET | `/api/v1/admin/schools/` | `listSchoolsApi` | Router-level or none | Yes/guarded | `backend/src/routes/schoolAdmin.routes.ts:23` |
| GET | `/api/v1/admin/schools/:id/admins` | `listSchoolAdminsApi` | Router-level or none | Yes/guarded | `backend/src/routes/schoolAdmin.routes.ts:24` |
| PATCH | `/api/v1/admin/schools/:id` | `updateSchoolApi` | Router-level or none | Yes/guarded | `backend/src/routes/schoolAdmin.routes.ts:25` |
| PATCH | `/api/v1/admin/schools/:id/admins/:adminId/status` | `setSchoolAdminStatusApi` | Router-level or none | Yes/guarded | `backend/src/routes/schoolAdmin.routes.ts:26` |
| POST | `/api/v1/admin/schools/:id/activate` | `activateSchoolApi` | Router-level or none | Yes/guarded | `backend/src/routes/schoolAdmin.routes.ts:27` |
| POST | `/api/v1/admin/schools/:id/suspend` | `suspendSchoolApi` | Router-level or none | Yes/guarded | `backend/src/routes/schoolAdmin.routes.ts:28` |
| POST | `/api/v1/admin/schools/:id/admins` | `createSchoolAdminApi` | Router-level or none | Yes/guarded | `backend/src/routes/schoolAdmin.routes.ts:29` |
| DELETE | `/api/v1/admin/schools/:id` | `deleteSchoolApi` | Router-level or none | Yes/guarded | `backend/src/routes/schoolAdmin.routes.ts:30` |
| POST | `/api/v1/admin/schools/:id/restore` | `restoreSchoolApi` | Router-level or none | Yes/guarded | `backend/src/routes/schoolAdmin.routes.ts:31` |
| GET | `/api/v1/public/school-domain/` | `resolvePublicSchoolDomain` | Router-level or none | Route-specific/open | `backend/src/routes/schoolDomain.routes.ts:6` |
| GET | `/api/v1/system-settings/school` | `getSchoolSystemSettings` | Router-level or none | Yes/guarded | `backend/src/routes/schoolSystemSettings.routes.ts:11` |
| PUT | `/api/v1/system-settings/school` | `updateSchoolSystemSettings` | Router-level or none | Yes/guarded | `backend/src/routes/schoolSystemSettings.routes.ts:12` |
| GET | `/api/v1/staff/departments` | `listDepartments` | Router-level or none | Yes/guarded | `backend/src/routes/staff.routes.ts:38` |
| POST | `/api/v1/staff/departments` | `createDepartment` | Router-level or none | Yes/guarded | `backend/src/routes/staff.routes.ts:39` |
| GET | `/api/v1/staff/designations` | `listDesignations` | Router-level or none | Yes/guarded | `backend/src/routes/staff.routes.ts:40` |
| POST | `/api/v1/staff/designations` | `createDesignation` | Router-level or none | Yes/guarded | `backend/src/routes/staff.routes.ts:41` |
| POST | `/api/v1/staff/defaults` | `seedStaffDefaults` | Router-level or none | Yes/guarded | `backend/src/routes/staff.routes.ts:42` |
| GET | `/api/v1/staff/attendance` | `loadStaffAttendance` | Router-level or none | Yes/guarded | `backend/src/routes/staff.routes.ts:44` |
| POST | `/api/v1/staff/attendance` | `saveStaffAttendance` | Router-level or none | Yes/guarded | `backend/src/routes/staff.routes.ts:45` |
| GET | `/api/v1/staff/attendance/report` | `getStaffAttendanceReport` | Router-level or none | Yes/guarded | `backend/src/routes/staff.routes.ts:46` |
| GET | `/api/v1/staff/payroll` | `listPayroll` | Router-level or none | Yes/guarded | `backend/src/routes/staff.routes.ts:48` |
| POST | `/api/v1/staff/payroll/generate` | `generatePayroll` | Router-level or none | Yes/guarded | `backend/src/routes/staff.routes.ts:49` |
| GET | `/api/v1/staff/payroll/report` | `getPayrollReport` | Router-level or none | Yes/guarded | `backend/src/routes/staff.routes.ts:50` |
| POST | `/api/v1/staff/payroll/:id/pay` | `payPayroll` | Router-level or none | Yes/guarded | `backend/src/routes/staff.routes.ts:51` |
| GET | `/api/v1/staff/` | `listStaff` | Router-level or none | Yes/guarded | `backend/src/routes/staff.routes.ts:53` |
| POST | `/api/v1/staff/` | `createStaff` | Router-level or none | Yes/guarded | `backend/src/routes/staff.routes.ts:54` |
| GET | `/api/v1/staff/:id` | `getStaff` | Router-level or none | Yes/guarded | `backend/src/routes/staff.routes.ts:55` |
| PATCH | `/api/v1/staff/:id` | `updateStaff` | Router-level or none | Yes/guarded | `backend/src/routes/staff.routes.ts:56` |
| DELETE | `/api/v1/staff/:id` | `deleteStaff` | Router-level or none | Yes/guarded | `backend/src/routes/staff.routes.ts:57` |
| POST | `/api/v1/staff/:id/documents` | `addStaffDocument` | `uploadStaffDocumentMiddleware` | Yes/guarded | `backend/src/routes/staff.routes.ts:58` |
| DELETE | `/api/v1/staff/:id/documents/:documentId` | `deleteStaffDocument` | Router-level or none | Yes/guarded | `backend/src/routes/staff.routes.ts:59` |
| POST | `/api/v1/staff/:id/timeline` | `addStaffTimeline` | Router-level or none | Yes/guarded | `backend/src/routes/staff.routes.ts:60` |
| DELETE | `/api/v1/staff/:id/timeline/:timelineId` | `deleteStaffTimeline` | Router-level or none | Yes/guarded | `backend/src/routes/staff.routes.ts:61` |
| GET | `/api/v1/students/students/import/sample` | `downloadStudentImportSample` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:67` |
| POST | `/api/v1/students/students/import` | `importStudents` | `uploadStudentImportMiddleware` | Yes/guarded | `backend/src/routes/student.routes.ts:68` |
| GET | `/api/v1/students/attendance` | `loadStudentAttendance` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:69` |
| POST | `/api/v1/students/attendance` | `saveStudentAttendance` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:70` |
| GET | `/api/v1/students/attendance/report` | `getStudentAttendanceReport` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:71` |
| GET | `/api/v1/students/groups` | `listStudentGroups` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:72` |
| POST | `/api/v1/students/groups` | `createStudentGroup` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:73` |
| PATCH | `/api/v1/students/groups/:id` | `updateStudentGroup` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:74` |
| DELETE | `/api/v1/students/groups/:id` | `deleteStudentGroup` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:75` |
| GET | `/api/v1/students/categories` | `listStudentCategories` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:76` |
| POST | `/api/v1/students/categories` | `createStudentCategory` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:77` |
| PATCH | `/api/v1/students/categories/:id` | `updateStudentCategory` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:78` |
| DELETE | `/api/v1/students/categories/:id` | `deleteStudentCategory` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:79` |
| GET | `/api/v1/students/promotions/preview` | `previewStudentPromotion` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:80` |
| POST | `/api/v1/students/promotions` | `promoteStudents` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:81` |
| GET | `/api/v1/students/disabled` | `listDisabledStudents` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:82` |
| POST | `/api/v1/students/students/:id/disable` | `disableStudent` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:83` |
| POST | `/api/v1/students/disabled/:id/restore` | `restoreDisabledStudent` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:84` |
| DELETE | `/api/v1/students/disabled/:id` | `deleteDisabledStudent` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:85` |
| POST | `/api/v1/students/students` | `createStudent` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:86` |
| GET | `/api/v1/students/students` | `listStudents` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:87` |
| GET | `/api/v1/students/students/:id` | `getStudent` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:88` |
| PATCH | `/api/v1/students/students/:id` | `updateStudent` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:89` |
| DELETE | `/api/v1/students/students/:id` | `deleteStudent` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:90` |
| POST | `/api/v1/students/students/:id/photos` | `addStudentPhoto` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:91` |
| DELETE | `/api/v1/students/students/:id/photos/:photoId` | `deleteStudentPhoto` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:92` |
| POST | `/api/v1/students/students/:id/documents` | `addStudentDocument` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:93` |
| DELETE | `/api/v1/students/students/:id/documents/:documentId` | `deleteStudentDocument` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:94` |
| POST | `/api/v1/students/students/:id/timeline` | `addStudentTimeline` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:95` |
| DELETE | `/api/v1/students/students/:id/timeline/:timelineId` | `deleteStudentTimeline` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:96` |
| POST | `/api/v1/students/students/:id/parents` | `linkParent` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:97` |
| DELETE | `/api/v1/students/students/:id/parents/:parentId` | `unlinkParent` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:98` |
| POST | `/api/v1/students/students/:id/status` | `changeStudentStatus` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:99` |
| GET | `/api/v1/students/transfer-targets` | `listTransferTargets` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:100` |
| POST | `/api/v1/students/students/:id/transfer-requests` | `createTransferRequest` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:101` |
| GET | `/api/v1/students/transfer-requests` | `listIncomingTransferRequests` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:102` |
| POST | `/api/v1/students/transfer-requests/:id/accept` | `acceptTransferRequest` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:103` |
| POST | `/api/v1/students/transfer-requests/:id/reject` | `rejectTransferRequest` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:104` |
| POST | `/api/v1/students/parents` | `createParent` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:106` |
| GET | `/api/v1/students/parents` | `listParents` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:107` |
| GET | `/api/v1/students/parents/lookup` | `lookupParentByPhone` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:108` |
| GET | `/api/v1/students/parents/:id` | `getParent` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:109` |
| PATCH | `/api/v1/students/parents/:id` | `updateParent` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:110` |
| DELETE | `/api/v1/students/parents/:id` | `deleteParent` | Router-level or none | Yes/guarded | `backend/src/routes/student.routes.ts:111` |
| GET | `/api/v1/subscriptions/plans` | `listActivePlansApi` | `requireSchoolAdminOrSuperAdmin` | Yes/guarded | `backend/src/routes/subscription.routes.ts:34` |
| GET | `/api/v1/subscriptions/usage` | `getSubscriptionUsageApi` | `requireSchoolAdminOrSuperAdmin` | Yes/guarded | `backend/src/routes/subscription.routes.ts:35` |
| GET | `/api/v1/subscriptions/invoices` | `getSubscriptionInvoicesApi` | `requireSchoolAdminOrSuperAdmin` | Yes/guarded | `backend/src/routes/subscription.routes.ts:36` |
| GET | `/api/v1/subscriptions/` | `getSubscriptionApi` | `requireSchoolAdminOrSuperAdmin` | Yes/guarded | `backend/src/routes/subscription.routes.ts:37` |
| POST | `/api/v1/subscriptions/` | `upsertSubscriptionApi` | `requireSuperAdmin` | Yes/guarded | `backend/src/routes/subscription.routes.ts:38` |
| GET | `/api/v1/admin/subscriptions/` | `listAdminSchoolSubscriptionsApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscription.routes.ts:43` |
| GET | `/api/v1/admin/subscriptions/summary` | `getAdminSubscriptionSummaryApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscription.routes.ts:44` |
| GET | `/api/v1/admin/subscriptions/:schoolId` | `getAdminSchoolSubscriptionDetailApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscription.routes.ts:45` |
| POST | `/api/v1/admin/subscriptions/:schoolId/assign-plan` | `assignSchoolSubscriptionPlanApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscription.routes.ts:46` |
| POST | `/api/v1/admin/subscriptions/:schoolId/start-trial` | `startSchoolSubscriptionTrialApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscription.routes.ts:47` |
| POST | `/api/v1/admin/subscriptions/:schoolId/extend-trial` | `extendSchoolSubscriptionTrialApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscription.routes.ts:48` |
| POST | `/api/v1/admin/subscriptions/:schoolId/upgrade` | `upgradeSchoolSubscriptionApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscription.routes.ts:49` |
| POST | `/api/v1/admin/subscriptions/:schoolId/downgrade` | `downgradeSchoolSubscriptionApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscription.routes.ts:50` |
| POST | `/api/v1/admin/subscriptions/:schoolId/pause` | `pauseSchoolSubscriptionApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscription.routes.ts:51` |
| POST | `/api/v1/admin/subscriptions/:schoolId/resume` | `resumeSchoolSubscriptionApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscription.routes.ts:52` |
| POST | `/api/v1/admin/subscriptions/:schoolId/cancel` | `cancelSchoolSubscriptionApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscription.routes.ts:53` |
| POST | `/api/v1/admin/subscriptions/:schoolId/renew` | `renewSchoolSubscriptionApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscription.routes.ts:54` |
| PATCH | `/api/v1/admin/subscriptions/:schoolId/limits` | `overrideSchoolSubscriptionLimitsApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscription.routes.ts:55` |
| GET | `/api/v1/admin/subscriptions/:schoolId/history` | `getAdminSubscriptionHistoryApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscription.routes.ts:56` |
| GET | `/api/v1/admin/subscriptions/:schoolId/usage` | `getAdminSubscriptionUsageApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscription.routes.ts:57` |
| GET | `/api/v1/admin/subscriptions/:schoolId/invoices` | `getAdminSubscriptionInvoicesApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscription.routes.ts:58` |
| POST | `/api/v1/admin/subscriptions/:schoolId/manual-payment` | `recordSchoolSubscriptionManualPaymentApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscription.routes.ts:59` |
| GET | `/api/v1/admin/subscription-metrics/:schoolId` | `getSubscriptionMetricsApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscriptionMetrics.routes.ts:11` |
| GET | `/api/v1/admin/subscription-plans/` | `listSubscriptionPlansApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscriptionPlan.routes.ts:19` |
| GET | `/api/v1/admin/subscription-plans/:id/schools` | `listPlanSchoolsApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscriptionPlan.routes.ts:20` |
| GET | `/api/v1/admin/subscription-plans/:id/permissions` | `listPlanPermissionsApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscriptionPlan.routes.ts:21` |
| POST | `/api/v1/admin/subscription-plans/` | `createSubscriptionPlanApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscriptionPlan.routes.ts:22` |
| PATCH | `/api/v1/admin/subscription-plans/:id` | `updateSubscriptionPlanApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscriptionPlan.routes.ts:23` |
| PUT | `/api/v1/admin/subscription-plans/:id/permissions` | `updatePlanPermissionsApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscriptionPlan.routes.ts:24` |
| DELETE | `/api/v1/admin/subscription-plans/:id` | `deleteSubscriptionPlanApi` | Router-level or none | Yes/guarded | `backend/src/routes/subscriptionPlan.routes.ts:25` |
| POST | `/api/v1/teachers/` | `createTeacherApi` | Router-level or none | Yes/guarded | `backend/src/routes/teacher.routes.ts:11` |
| GET | `/api/v1/teachers/` | `listTeachersApi` | Router-level or none | Yes/guarded | `backend/src/routes/teacher.routes.ts:12` |
| GET | `/api/v1/teachers/:id` | `getTeacherApi` | Router-level or none | Yes/guarded | `backend/src/routes/teacher.routes.ts:13` |
| PATCH | `/api/v1/teachers/:id` | `updateTeacherApi` | Router-level or none | Yes/guarded | `backend/src/routes/teacher.routes.ts:14` |
| DELETE | `/api/v1/teachers/:id` | `deleteTeacherApi` | Router-level or none | Yes/guarded | `backend/src/routes/teacher.routes.ts:15` |
| PATCH | `/api/v1/teacher-assignments/teachers/:teacherId/status` | `setTeacherStatus` | Router-level or none | Yes/guarded | `backend/src/routes/teacherAssignment.routes.ts:15` |
| POST | `/api/v1/teacher-assignments/classes/assign` | `assignClass` | Router-level or none | Yes/guarded | `backend/src/routes/teacherAssignment.routes.ts:16` |
| POST | `/api/v1/teacher-assignments/classes/unassign` | `unassignClass` | Router-level or none | Yes/guarded | `backend/src/routes/teacherAssignment.routes.ts:17` |
| POST | `/api/v1/teacher-assignments/subjects/assign` | `assignSubject` | Router-level or none | Yes/guarded | `backend/src/routes/teacherAssignment.routes.ts:18` |
| POST | `/api/v1/teacher-assignments/subjects/unassign` | `unassignSubject` | Router-level or none | Yes/guarded | `backend/src/routes/teacherAssignment.routes.ts:19` |
| POST | `/api/v1/themes/` | `createTheme` | Router-level or none | Yes/guarded | `backend/src/routes/theme.routes.ts:23` |
| GET | `/api/v1/themes/` | `listThemes` | Router-level or none | Yes/guarded | `backend/src/routes/theme.routes.ts:25` |
| GET | `/api/v1/themes/active` | `getActiveTheme` | Router-level or none | Yes/guarded | `backend/src/routes/theme.routes.ts:27` |
| GET | `/api/v1/themes/login-branding` | `getLoginBrandingSettings` | Router-level or none | Yes/guarded | `backend/src/routes/theme.routes.ts:29` |
| PUT | `/api/v1/themes/login-branding` | `updateLoginBrandingSettings` | Router-level or none | Yes/guarded | `backend/src/routes/theme.routes.ts:31` |
| POST | `/api/v1/themes/login-branding/publish` | `publishLoginBranding` | Router-level or none | Yes/guarded | `backend/src/routes/theme.routes.ts:33` |
| POST | `/api/v1/themes/login-branding/rollback` | `rollbackLoginBranding` | Router-level or none | Yes/guarded | `backend/src/routes/theme.routes.ts:35` |
| POST | `/api/v1/themes/login-branding/reset` | `resetLoginBranding` | Router-level or none | Yes/guarded | `backend/src/routes/theme.routes.ts:37` |
| PATCH | `/api/v1/themes/:id` | `updateThemeTokens` | Router-level or none | Yes/guarded | `backend/src/routes/theme.routes.ts:39` |
| POST | `/api/v1/themes/:id/publish` | `publishTheme` | Router-level or none | Yes/guarded | `backend/src/routes/theme.routes.ts:41` |
| POST | `/api/v1/themes/:id/rollback` | `rollbackTheme` | Router-level or none | Yes/guarded | `backend/src/routes/theme.routes.ts:43` |
| POST | `/api/v1/tickets/` | `createTicketApi` | Router-level or none | Yes/guarded | `backend/src/routes/ticket.routes.ts:27` |
| GET | `/api/v1/tickets/` | `listTicketsApi` | Router-level or none | Yes/guarded | `backend/src/routes/ticket.routes.ts:28` |
| GET | `/api/v1/tickets/:id` | `getTicketApi` | Router-level or none | Yes/guarded | `backend/src/routes/ticket.routes.ts:29` |
| POST | `/api/v1/tickets/:id/comments` | `addTicketCommentApi` | Router-level or none | Yes/guarded | `backend/src/routes/ticket.routes.ts:30` |
| PATCH | `/api/v1/tickets/:id` | `updateTicketApi` | Router-level or none | Yes/guarded | `backend/src/routes/ticket.routes.ts:31` |
| PATCH | `/api/v1/tickets/:id/status` | `updateTicketStatusApi` | Router-level or none | Yes/guarded | `backend/src/routes/ticket.routes.ts:32` |
| PATCH | `/api/v1/tickets/:id/priority` | `updateTicketPriorityApi` | Router-level or none | Yes/guarded | `backend/src/routes/ticket.routes.ts:33` |
| GET | `/api/v1/admin/support/` | `listAdminTicketsApi` | Router-level or none | Yes/guarded | `backend/src/routes/ticket.routes.ts:38` |
| GET | `/api/v1/admin/support/assignable-users` | `listAssignableSupportUsersApi` | Router-level or none | Yes/guarded | `backend/src/routes/ticket.routes.ts:39` |
| GET | `/api/v1/admin/support/:id` | `getAdminTicketApi` | Router-level or none | Yes/guarded | `backend/src/routes/ticket.routes.ts:40` |
| POST | `/api/v1/admin/support/:id/comments` | `addAdminTicketCommentApi` | Router-level or none | Yes/guarded | `backend/src/routes/ticket.routes.ts:41` |
| PATCH | `/api/v1/admin/support/:id` | `updateAdminTicketApi` | Router-level or none | Yes/guarded | `backend/src/routes/ticket.routes.ts:42` |
| PATCH | `/api/v1/admin/support/:id/assign` | `assignAdminTicketApi` | Router-level or none | Yes/guarded | `backend/src/routes/ticket.routes.ts:43` |
| PATCH | `/api/v1/admin/support/:id/status` | `updateAdminTicketStatusApi` | Router-level or none | Yes/guarded | `backend/src/routes/ticket.routes.ts:44` |
| PATCH | `/api/v1/admin/support/:id/priority` | `updateAdminTicketPriorityApi` | Router-level or none | Yes/guarded | `backend/src/routes/ticket.routes.ts:45` |
| GET | `/api/v1/transport/report` | `getStudentTransportReport` | Router-level or none | Yes/guarded | `backend/src/routes/transport.routes.ts:23` |
| GET | `/api/v1/transport/assignments` | `listTransportAssignments` | Router-level or none | Yes/guarded | `backend/src/routes/transport.routes.ts:25` |
| POST | `/api/v1/transport/assignments` | `assignVehiclesToRoute` | Router-level or none | Yes/guarded | `backend/src/routes/transport.routes.ts:26` |
| PATCH | `/api/v1/transport/assignments/:id` | `updateTransportAssignment` | Router-level or none | Yes/guarded | `backend/src/routes/transport.routes.ts:27` |
| DELETE | `/api/v1/transport/assignments/:id` | `deleteTransportAssignment` | Router-level or none | Yes/guarded | `backend/src/routes/transport.routes.ts:28` |
| GET | `/api/v1/transport/routes` | `listTransportRoutes` | Router-level or none | Yes/guarded | `backend/src/routes/transport.routes.ts:30` |
| POST | `/api/v1/transport/routes` | `createTransportRoute` | Router-level or none | Yes/guarded | `backend/src/routes/transport.routes.ts:31` |
| PATCH | `/api/v1/transport/routes/:id` | `updateTransportRoute` | Router-level or none | Yes/guarded | `backend/src/routes/transport.routes.ts:32` |
| DELETE | `/api/v1/transport/routes/:id` | `deleteTransportRoute` | Router-level or none | Yes/guarded | `backend/src/routes/transport.routes.ts:33` |
| GET | `/api/v1/transport/vehicles` | `listTransportVehicles` | Router-level or none | Yes/guarded | `backend/src/routes/transport.routes.ts:35` |
| POST | `/api/v1/transport/vehicles` | `createTransportVehicle` | Router-level or none | Yes/guarded | `backend/src/routes/transport.routes.ts:36` |
| PATCH | `/api/v1/transport/vehicles/:id` | `updateTransportVehicle` | Router-level or none | Yes/guarded | `backend/src/routes/transport.routes.ts:37` |
| DELETE | `/api/v1/transport/vehicles/:id` | `deleteTransportVehicle` | Router-level or none | Yes/guarded | `backend/src/routes/transport.routes.ts:38` |
| GET | `/api/v1/uploads/signed` | `res` | `async (req` | Yes/guarded | `backend/src/routes/upload.routes.ts:76` |
| POST | `/api/v1/uploads/branding` | `res` | `requireSchoolAdminOrSuperAdmin, runBrandingUpload, async (req` | Yes/guarded | `backend/src/routes/upload.routes.ts:120` |
| POST | `/api/v1/uploads/photos` | `res` | `upload.single('file'), (req` | Yes/guarded | `backend/src/routes/upload.routes.ts:189` |
| POST | `/api/v1/uploads/documents` | `res` | `docUpload.single('file'), (req` | Yes/guarded | `backend/src/routes/upload.routes.ts:218` |
| GET | `/api/v1/users/me` | `getMe` | Router-level or none | Yes/guarded | `backend/src/routes/user.routes.ts:16` |
| POST | `/api/v1/users/school-users` | `createSchoolUserApi` | `requireRole('SCHOOL_ADMIN')` | Yes/guarded | `backend/src/routes/user.routes.ts:17` |
| GET | `/api/v1/users/employee-permissions` | `listEmployeePermissionsApi` | `requireRole('SCHOOL_ADMIN')` | Yes/guarded | `backend/src/routes/user.routes.ts:18` |
| PUT | `/api/v1/users/employee-permissions` | `updateEmployeePermissionsApi` | `requireRole('SCHOOL_ADMIN')` | Yes/guarded | `backend/src/routes/user.routes.ts:19` |
| GET | `/api/v1/users/:id` | `getUserById` | Router-level or none | Yes/guarded | `backend/src/routes/user.routes.ts:20` |

## API Behavior Notes

- Request parameter and response shapes are implemented in the controller and service listed in each endpoint row. Route declarations alone do not always expose DTO shape.
- Global error handling is centralized in `backend/src/middlewares/error.middleware.ts`.
- API documentation is also mounted from `backend/openapi.yaml` at `/docs` by `backend/src/app.ts`.
