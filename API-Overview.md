# API Overview

This document is generated from `backend/src/app.ts` and `backend/src/routes`. It lists the route groups and route patterns discovered in code. Where a route file does not include explicit OpenAPI examples or a schema file was not directly referenced, examples are marked as "Not Found In Codebase" instead of inventing payloads.

## Infrastructure Routes

| Method | Endpoint | Description | Required Permissions | Request Example | Response Example |
| --- | --- | --- | --- | --- | --- |
| GET | `/health` | Infrastructure health check | Public | N/A | Health object |
| GET | `/metrics` | Prometheus-compatible metrics | Public | N/A | Prometheus text format |
| GET | `/docs` | Swagger UI for `openapi.yaml` | Public | N/A | HTML |

## Route Group Inventory

| Prefix | Route file | Purpose | Protection |
| --- | --- | --- | --- |
| `/api/v1/auth` | `auth.routes.ts` | Authentication, MFA, sessions, password reset | Public and authenticated routes |
| `/api/auth` | `auth.routes.ts` | Compatibility auth mount | Public and authenticated routes |
| `/api/v1/public/branding` | `publicBranding.routes.ts` | Public branding | Public |
| `/api/v1/public/assets` | `publicAsset.routes.ts` | Public assets | Public |
| `/api/v1/public/school-domain` | `schoolDomain.routes.ts` | School-domain lookup | Public |
| `/api/v1/academics` | `academic.routes.ts` | Modern academics/timetable | Auth/permission protected |
| `/api/v1/academic-setup` | `academicSetup.routes.ts` | Academic setup compatibility routes | Auth/permission protected |
| `/api/v1/students` | `student.routes.ts` | Student CRUD, operations, attendance | Auth/permission protected |
| `/api/v1/attendance` | `attendance.routes.ts` | Attendance summary/self/P1 routes | Auth/permission protected |
| `/api/v1/attendance-summary` | `attendanceSummary.routes.ts` | Attendance summary APIs | Auth/permission protected |
| `/api/v1/attendance-approval` | `attendanceApproval.routes.ts` | Attendance session approval | Auth/permission protected |
| `/api/v1/attendance/evidence` | `evidence.routes.ts` | Attendance evidence | Auth/permission protected |
| `/api/v1/exams` | `exam.routes.ts` | Exams, marks, rooms, seating, invigilation | Auth/permission protected |
| `/api/v1/fees` | `feeManagement.routes.ts` | Fee management | Auth/permission protected |
| `/api/v1/homework` | `homework.routes.ts` | Homework and evaluations | Auth/permission protected |
| `/api/v1/leave` | `leave.routes.ts` | Leave types, balances, applications | Auth/permission protected |
| `/api/v1/library` | `library.routes.ts` | Library | Auth/permission protected |
| `/api/v1/transport` | `transport.routes.ts` | Transport | Auth/permission protected |
| `/api/v1/dormitories` | `dormitory.routes.ts` | Dormitory | Auth/permission protected |
| `/api/v1/reports` | `report.routes.ts` | Reports and exports | Auth/permission protected |
| `/api/v1/analytics` | `analytics.routes.ts` | Analytics | Auth/permission protected |
| `/api/v1/notifications` | `notification.routes.ts` | Notifications/templates/logs | Auth/permission protected |
| `/api/v1/uploads` | `upload.routes.ts` | Signed uploads and file uploads | Auth/permission protected |
| `/api/v1/backups` | `backup.routes.ts` | Backup and restore | Auth/permission protected |
| `/api/v1/subscriptions` | `subscription.routes.ts` | School subscription | Auth/permission protected |
| `/api/v1/admin/subscriptions` | `subscription.routes.ts` | Admin subscription operations | Admin protected |
| `/api/v1/admin/schools` | `schoolAdmin.routes.ts` | School administration | Admin protected |
| `/api/v1/admin/subscription-plans` | `subscriptionPlan.routes.ts` | Subscription plan administration | Admin protected |
| `/api/v1/admin/subscription-metrics` | `subscriptionMetrics.routes.ts` | Subscription metrics | Admin protected |
| `/api/v1/admin/dashboard` | `adminDashboard.routes.ts` | Super-admin dashboard | Admin protected |
| `/api/v1/admin/users` | `adminUser.routes.ts` | Admin users | Admin protected |
| `/api/v1/admin/support` | `ticket.routes.ts` | Support administration | Admin protected |
| `/api/v1/admin/compliance` | `dataCompliance.routes.ts` | Compliance administration | Admin protected |
| `/api/v1/parents/portal` | `parentPortal.routes.ts` | Parent portal APIs | Auth/parent protected |
| `/api/v1/ai-assistant` | `aiAssistant.routes.ts` | AI assistant | Auth/permission protected |
| `/api/v1/consents` | `consent.routes.ts` | Consent documents and records | Auth/permission protected |
| `/api/v1/compliance` | `dataCompliance.routes.ts` | Compliance data jobs | Auth/permission protected |
| `/api/v1/tickets` | `ticket.routes.ts` | Support tickets | Auth/permission protected |
| `/api/v1/themes` | `theme.routes.ts` | Theme and branding | Auth/permission protected |
| `/api/v1/features` | `feature-flag.routes.ts` | Feature flags/config entries | Auth/permission protected |
| `/api/v1/jobs` | `job.routes.ts` | Job visibility | Auth/permission protected |
| `/api/v1/otp` | `otp.routes.ts` | OTP | Auth/public depending route |
| `/api/v1/faces` | `face.routes.ts` | Face enrollment/management | Auth/permission protected |
| `/api/v1/recognition` | `recognition.routes.ts` | Face recognition | Auth/permission protected |
| `/api/v1/teachers` | `teacher.routes.ts` | Teacher management | Auth/permission protected |
| `/api/v1/staff` | `staff.routes.ts` | Staff management, attendance, payroll | Auth/permission protected |
| `/api/v1/users` | `user.routes.ts` | Current user and assigned data | Auth protected |
| `/api/v1/imports` | `import.routes.ts` | Import jobs | Auth/permission protected |
| `/api/v1/system-settings` | `schoolSystemSettings.routes.ts` | School system settings | Auth/permission protected |
| `/api/v1/messaging-services` | `messagingSettings.routes.ts` | Messaging service settings | Auth/permission protected |
| `/api/v1/admin/messaging-services` | `messagingAdmin.routes.ts` | Messaging admin routes | Admin protected |

## Authentication Routes

| Method | Endpoint | Description | Required Permissions | Request Example | Response Example |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/auth/login` | Login | Public | Login identifier/password body | Auth response |
| POST | `/api/v1/auth/verify-2fa` | Verify two-factor challenge | Public with challenge | Not Found In Codebase | Not Found In Codebase |
| POST | `/api/v1/auth/resend-2fa` | Resend 2FA code | Public with challenge | Not Found In Codebase | Not Found In Codebase |
| POST | `/api/v1/auth/totp/setup` | Start TOTP setup | Authenticated | Not Found In Codebase | Not Found In Codebase |
| POST | `/api/v1/auth/totp/verify` | Verify TOTP setup/code | Authenticated | Not Found In Codebase | Not Found In Codebase |
| POST | `/api/v1/auth/totp/disable` | Disable TOTP | Authenticated | Not Found In Codebase | Not Found In Codebase |
| POST | `/api/v1/auth/forgot-password` | Request password reset | Public | Not Found In Codebase | Not Found In Codebase |
| POST | `/api/v1/auth/reset-password` | Reset password | Public | Not Found In Codebase | Not Found In Codebase |
| POST | `/api/v1/auth/refresh` | Refresh access token | Refresh session | Not Found In Codebase | Not Found In Codebase |
| POST | `/api/v1/auth/logout` | Logout | Authenticated | Not Found In Codebase | Not Found In Codebase |
| POST | `/api/v1/auth/change-password` | Change password | Authenticated | Not Found In Codebase | Not Found In Codebase |
| GET | `/api/v1/auth/sessions` | List sessions | Authenticated | N/A | Not Found In Codebase |
| DELETE | `/api/v1/auth/sessions/:id` | Revoke session | Authenticated | N/A | Not Found In Codebase |
| POST | `/api/v1/auth/logout-all` | Revoke all sessions | Authenticated | Not Found In Codebase | Not Found In Codebase |

## Academic Setup and Timetable Routes

| Method | Endpoint | Description | Required Permissions | Request Example | Response Example |
| --- | --- | --- | --- | --- | --- |
| GET/POST | `/api/v1/academic-setup/classes` | List/create classes | Academic setup permissions | Not Found In Codebase | Not Found In Codebase |
| GET/PUT/DELETE | `/api/v1/academic-setup/classes/:id` | Class detail/update/delete | Academic setup permissions | Not Found In Codebase | Not Found In Codebase |
| GET/POST | `/api/v1/academic-setup/sections` | List/create sections | Academic setup permissions | Not Found In Codebase | Not Found In Codebase |
| GET/PUT/DELETE | `/api/v1/academic-setup/sections/:id` | Section detail/update/delete | Academic setup permissions | Not Found In Codebase | Not Found In Codebase |
| GET/POST | `/api/v1/academic-setup/subjects` | List/create subjects | Academic setup permissions | Not Found In Codebase | Not Found In Codebase |
| GET/PUT/DELETE | `/api/v1/academic-setup/subjects/:id` | Subject detail/update/delete | Academic setup permissions | Not Found In Codebase | Not Found In Codebase |
| GET/POST | `/api/v1/academic-setup/rooms` | List/create rooms | Academic setup permissions | Not Found In Codebase | Not Found In Codebase |
| GET/PUT/DELETE | `/api/v1/academic-setup/rooms/:id` | Room detail/update/delete | Academic setup permissions | Not Found In Codebase | Not Found In Codebase |
| GET/POST | `/api/v1/academic-setup/time-periods` | Compatibility period management backed by modern periods | Academic setup permissions | Not Found In Codebase | Not Found In Codebase |
| POST | `/api/v1/academic-setup/time-periods/defaults` | Create default periods | Academic setup permissions | Not Found In Codebase | Not Found In Codebase |
| GET/POST | `/api/v1/academic-setup/assign-subjects` | Assign subjects to classes/sections/teachers | Academic setup permissions | Not Found In Codebase | Not Found In Codebase |
| GET/POST | `/api/v1/academic-setup/class-teachers` | Class teacher assignment | Academic setup permissions | Not Found In Codebase | Not Found In Codebase |
| GET/POST | `/api/v1/academic-setup/routines` | Compatibility routine management backed by modern timetable | Academic/timetable permissions | Not Found In Codebase | Not Found In Codebase |
| POST | `/api/v1/academic-setup/routines/generate` | Compatibility timetable generator | Academic/timetable permissions | Not Found In Codebase | Not Found In Codebase |
| GET | `/api/v1/academics/timetable/teacher` | Teacher timetable | Timetable/academic permissions | Query params | Timetable list |
| POST | `/api/v1/academics/timetable/entries/generate` | Modern timetable generator | Timetable manage permissions | Not Found In Codebase | Generator result |

## Student and Attendance Routes

| Method | Endpoint | Description | Required Permissions | Request Example | Response Example |
| --- | --- | --- | --- | --- | --- |
| GET/POST | `/api/v1/students` | List/create students | Student permissions | Not Found In Codebase | Not Found In Codebase |
| GET/PUT/DELETE | `/api/v1/students/:id` | Student detail/update/delete | Student permissions | Not Found In Codebase | Not Found In Codebase |
| POST | `/api/v1/students/attendance` | Student attendance write | Attendance/student attendance permissions | Legacy-compatible attendance payload | Legacy-compatible response |
| GET | `/api/v1/students/attendance/options` | Attendance class/section/student options | Attendance permissions | Query params | Options response |
| GET | `/api/v1/attendance/summary` | Attendance summary | Attendance view permissions | Query params | Summary response |
| GET/POST | `/api/v1/attendance/teacher/self` | Teacher self attendance get/mark | Staff/attendance permissions | Not Found In Codebase | Not Found In Codebase |
| POST | `/api/v1/attendance-approval/sessions/:sessionId/approve` | Approve session | Attendance approval permission | Not Found In Codebase | Not Found In Codebase |
| POST | `/api/v1/attendance-approval/sessions/:sessionId/reject` | Reject session | Attendance approval permission | Not Found In Codebase | Not Found In Codebase |
| GET/POST | `/api/v1/attendance/evidence` | List/create evidence | Attendance evidence permission | Not Found In Codebase | Not Found In Codebase |

## Exams, Homework, Leave, Fees, Staff

| Method | Endpoint | Description | Required Permissions | Request Example | Response Example |
| --- | --- | --- | --- | --- | --- |
| GET/POST | `/api/v1/exams` | List/create exams | Exam permissions | Not Found In Codebase | Not Found In Codebase |
| GET/PUT/DELETE | `/api/v1/exams/:id` | Exam detail/update/delete | Exam permissions | Not Found In Codebase | Not Found In Codebase |
| GET/POST | `/api/v1/exams/marks` | Marks listing/entry | Marks permissions | Not Found In Codebase | Not Found In Codebase |
| POST | `/api/v1/exams/marks/upload` | Upload marks | Marks permissions | Not Found In Codebase | Not Found In Codebase |
| GET/POST | `/api/v1/homework` | Homework list/create | Homework permissions | Not Found In Codebase | Not Found In Codebase |
| GET/PUT/DELETE | `/api/v1/homework/:id` | Homework detail/update/delete | Homework permissions | Not Found In Codebase | Not Found In Codebase |
| GET | `/api/v1/homework/evaluation-report` | Homework evaluation report | Homework permissions | N/A | Not Found In Codebase |
| GET/POST | `/api/v1/leave/types` | Leave type list/create | Leave permissions | Not Found In Codebase | Not Found In Codebase |
| GET | `/api/v1/leave/balances/me` | Current user's leave balances | Authenticated/leave permissions | N/A | Not Found In Codebase |
| GET/POST | `/api/v1/leave/applications` | Leave applications | Leave permissions | Not Found In Codebase | Not Found In Codebase |
| GET/POST | `/api/v1/fees/*` | Fee types, particulars, structures, assignments, invoices, payments, reports | Fee permissions | Not Found In Codebase | Not Found In Codebase |
| GET/POST | `/api/v1/staff` | Staff list/create | Staff permissions | Not Found In Codebase | Not Found In Codebase |
| GET/POST | `/api/v1/staff/attendance` | Staff attendance | Staff attendance permissions | Not Found In Codebase | Not Found In Codebase |
| GET/POST | `/api/v1/staff/payroll` | Payroll | Payroll permissions | Not Found In Codebase | Not Found In Codebase |

## Administration and Operations Routes

| Method | Endpoint | Description | Required Permissions | Request Example | Response Example |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/admin/dashboard` | Admin dashboard | Super-admin/admin permission | N/A | Not Found In Codebase |
| GET/POST | `/api/v1/admin/schools` | School administration | Admin protected | Not Found In Codebase | Not Found In Codebase |
| GET/POST | `/api/v1/admin/users` | Admin user management | Admin protected | Not Found In Codebase | Not Found In Codebase |
| GET/POST | `/api/v1/subscriptions` | School subscription operations | Subscription permissions | Not Found In Codebase | Not Found In Codebase |
| GET/POST | `/api/v1/admin/subscriptions` | Platform subscription operations | Admin protected | Not Found In Codebase | Not Found In Codebase |
| GET/POST | `/api/v1/backups` | Backup/restore | Backup permissions | Not Found In Codebase | Not Found In Codebase |
| GET/POST | `/api/v1/notifications` | Templates, sends, logs, summary | Notification permissions | Not Found In Codebase | Not Found In Codebase |
| POST | `/api/v1/uploads/signed` | Signed upload URL | Upload permission/authenticated | Not Found In Codebase | Not Found In Codebase |
| GET/POST | `/api/v1/reports` | Reports and exports | Report permissions | Not Found In Codebase | Not Found In Codebase |
| GET | `/api/v1/analytics` | Analytics | Analytics permission | N/A | Not Found In Codebase |

## Mobile-Facing Endpoints

The Flutter constants currently reference:

| Endpoint | Purpose |
| --- | --- |
| `/auth/login` | Login |
| `/auth/refresh` | Refresh |
| `/auth/logout` | Logout |
| `/users/me` | Current user profile and permissions |
| `/auth/change-password` | Change password |
| `/auth/forgot-password` | Forgot password |
| `/auth/verify-2fa` | Verify 2FA |
| `/auth/resend-2fa` | Resend 2FA |
| `/academics/timetable/teacher` | Teacher timetable |
| `/attendance/summary` | Attendance summary |
| `/attendance/teacher/self` | Teacher self attendance |
| `/students/attendance` | Student attendance |
| `/students/attendance/options` | Student attendance options |
| `/notifications/summary` | Notification summary |
| `/leave/balances/me` | Leave balance |
| `/leave/types` | Leave types |
| `/leave/applications` | Leave applications |
| `/homework` | Homework |
| `/users/me/assigned-classes` | Assigned classes |
| `/users/me/assigned-students` | Assigned students |
| `/users/me/exam-papers` | Current user's exam papers |
| `/exams` | Exams |
| `/exams/marks` | Exam marks |
| `/exams/marks/upload` | Marks upload |

## Notes

- Required permissions are enforced by a combination of route middleware, `authMiddleware`, `requirePermission`, and backend route permission resolution.
- Complete per-field schemas are distributed across controllers, validations, and services; a complete generated OpenAPI specification for every route was Not Found In Codebase.

## Raw Route Appendix

The following appendix is generated from route declarations in `backend/src/routes/*.ts`. Paths are local to their mounted prefix from `backend/src/app.ts`.

### academic.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| POST | `/academic-years` | `backend/src/routes/academic.routes.ts:71` |
| GET | `/academic-years` | `backend/src/routes/academic.routes.ts:72` |
| GET | `/academic-years/:id` | `backend/src/routes/academic.routes.ts:73` |
| PATCH | `/academic-years/:id` | `backend/src/routes/academic.routes.ts:74` |
| DELETE | `/academic-years/:id` | `backend/src/routes/academic.routes.ts:75` |
| POST | `/terms` | `backend/src/routes/academic.routes.ts:77` |
| GET | `/terms` | `backend/src/routes/academic.routes.ts:78` |
| GET | `/terms/:id` | `backend/src/routes/academic.routes.ts:79` |
| PATCH | `/terms/:id` | `backend/src/routes/academic.routes.ts:80` |
| DELETE | `/terms/:id` | `backend/src/routes/academic.routes.ts:81` |
| POST | `/classes` | `backend/src/routes/academic.routes.ts:83` |
| GET | `/classes` | `backend/src/routes/academic.routes.ts:84` |
| GET | `/classes/:id` | `backend/src/routes/academic.routes.ts:85` |
| PATCH | `/classes/:id` | `backend/src/routes/academic.routes.ts:86` |
| DELETE | `/classes/:id` | `backend/src/routes/academic.routes.ts:87` |
| POST | `/sections` | `backend/src/routes/academic.routes.ts:89` |
| GET | `/sections` | `backend/src/routes/academic.routes.ts:90` |
| GET | `/sections/:id` | `backend/src/routes/academic.routes.ts:91` |
| PATCH | `/sections/:id` | `backend/src/routes/academic.routes.ts:92` |
| DELETE | `/sections/:id` | `backend/src/routes/academic.routes.ts:93` |
| POST | `/subjects` | `backend/src/routes/academic.routes.ts:95` |
| GET | `/subjects` | `backend/src/routes/academic.routes.ts:96` |
| GET | `/subjects/:id` | `backend/src/routes/academic.routes.ts:97` |
| PATCH | `/subjects/:id` | `backend/src/routes/academic.routes.ts:98` |
| DELETE | `/subjects/:id` | `backend/src/routes/academic.routes.ts:99` |
| GET | `/exam-types` | `backend/src/routes/academic.routes.ts:101` |
| POST | `/exam-types` | `backend/src/routes/academic.routes.ts:102` |
| PATCH | `/exam-types/:id` | `backend/src/routes/academic.routes.ts:103` |
| POST | `/attendance-periods` | `backend/src/routes/academic.routes.ts:104` |
| GET | `/attendance-periods` | `backend/src/routes/academic.routes.ts:105` |
| PATCH | `/attendance-periods/:id` | `backend/src/routes/academic.routes.ts:106` |
| DELETE | `/attendance-periods/:id` | `backend/src/routes/academic.routes.ts:107` |
| GET | `/attendance-mode` | `backend/src/routes/academic.routes.ts:109` |
| PUT | `/attendance-mode` | `backend/src/routes/academic.routes.ts:110` |
| POST | `/timetable/versions` | `backend/src/routes/academic.routes.ts:112` |
| GET | `/timetable/versions` | `backend/src/routes/academic.routes.ts:113` |
| POST | `/timetable/entries/bulk` | `backend/src/routes/academic.routes.ts:114` |
| POST | `/timetable/entries/generate` | `backend/src/routes/academic.routes.ts:115` |
| GET | `/timetable/entries` | `backend/src/routes/academic.routes.ts:116` |
| PATCH | `/timetable/entries/:id` | `backend/src/routes/academic.routes.ts:117` |
| DELETE | `/timetable/entries/:id` | `backend/src/routes/academic.routes.ts:118` |
| GET | `/timetable/teachers` | `backend/src/routes/academic.routes.ts:119` |
| POST | `/timetable/versions/:id/publish` | `backend/src/routes/academic.routes.ts:120` |
| GET | `/timetable/teacher` | `backend/src/routes/academic.routes.ts:121` |

### academicSetup.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/classes` | `backend/src/routes/academicSetup.routes.ts:45` |
| POST | `/classes` | `backend/src/routes/academicSetup.routes.ts:46` |
| PATCH | `/classes/:id` | `backend/src/routes/academicSetup.routes.ts:47` |
| DELETE | `/classes/:id` | `backend/src/routes/academicSetup.routes.ts:48` |
| GET | `/sections` | `backend/src/routes/academicSetup.routes.ts:50` |
| POST | `/sections` | `backend/src/routes/academicSetup.routes.ts:51` |
| PATCH | `/sections/:id` | `backend/src/routes/academicSetup.routes.ts:52` |
| DELETE | `/sections/:id` | `backend/src/routes/academicSetup.routes.ts:53` |
| GET | `/subjects` | `backend/src/routes/academicSetup.routes.ts:55` |
| POST | `/subjects` | `backend/src/routes/academicSetup.routes.ts:56` |
| PATCH | `/subjects/:id` | `backend/src/routes/academicSetup.routes.ts:57` |
| DELETE | `/subjects/:id` | `backend/src/routes/academicSetup.routes.ts:58` |
| GET | `/rooms` | `backend/src/routes/academicSetup.routes.ts:60` |
| POST | `/rooms` | `backend/src/routes/academicSetup.routes.ts:61` |
| PATCH | `/rooms/:id` | `backend/src/routes/academicSetup.routes.ts:62` |
| DELETE | `/rooms/:id` | `backend/src/routes/academicSetup.routes.ts:63` |
| GET | `/time-periods` | `backend/src/routes/academicSetup.routes.ts:65` |
| POST | `/time-periods/defaults` | `backend/src/routes/academicSetup.routes.ts:66` |
| POST | `/time-periods` | `backend/src/routes/academicSetup.routes.ts:67` |
| PATCH | `/time-periods/:id` | `backend/src/routes/academicSetup.routes.ts:68` |
| DELETE | `/time-periods/:id` | `backend/src/routes/academicSetup.routes.ts:69` |
| GET | `/assign-subjects` | `backend/src/routes/academicSetup.routes.ts:71` |
| POST | `/assign-subjects` | `backend/src/routes/academicSetup.routes.ts:72` |
| DELETE | `/assign-subjects/:id` | `backend/src/routes/academicSetup.routes.ts:73` |
| GET | `/class-teachers` | `backend/src/routes/academicSetup.routes.ts:75` |
| POST | `/class-teachers` | `backend/src/routes/academicSetup.routes.ts:76` |
| PATCH | `/class-teachers/:id` | `backend/src/routes/academicSetup.routes.ts:77` |
| DELETE | `/class-teachers/:id` | `backend/src/routes/academicSetup.routes.ts:78` |
| GET | `/routines` | `backend/src/routes/academicSetup.routes.ts:80` |
| POST | `/routines` | `backend/src/routes/academicSetup.routes.ts:81` |
| POST | `/routines/generate` | `backend/src/routes/academicSetup.routes.ts:82` |
| PATCH | `/routines/:id` | `backend/src/routes/academicSetup.routes.ts:83` |
| DELETE | `/routines/:id` | `backend/src/routes/academicSetup.routes.ts:84` |

### adminDashboard.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/` | `backend/src/routes/adminDashboard.routes.ts:23` |
| GET | `/summary` | `backend/src/routes/adminDashboard.routes.ts:24` |
| GET | `/school-growth` | `backend/src/routes/adminDashboard.routes.ts:25` |
| GET | `/revenue` | `backend/src/routes/adminDashboard.routes.ts:26` |
| GET | `/activity` | `backend/src/routes/adminDashboard.routes.ts:27` |
| GET | `/support-summary` | `backend/src/routes/adminDashboard.routes.ts:28` |
| GET | `/top-schools` | `backend/src/routes/adminDashboard.routes.ts:29` |
| GET | `/analytics/weekly` | `backend/src/routes/adminDashboard.routes.ts:30` |
| GET | `/performance` | `backend/src/routes/adminDashboard.routes.ts:31` |
| GET | `/activities` | `backend/src/routes/adminDashboard.routes.ts:32` |
| GET | `/system-status` | `backend/src/routes/adminDashboard.routes.ts:33` |

### adminSystem.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/system-health` | `backend/src/routes/adminSystem.routes.ts:11` |

### adminUser.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/` | `backend/src/routes/adminUser.routes.ts:23` |
| GET | `/summary` | `backend/src/routes/adminUser.routes.ts:24` |
| GET | `/:id` | `backend/src/routes/adminUser.routes.ts:25` |
| PATCH | `/:id/status` | `backend/src/routes/adminUser.routes.ts:26` |
| PATCH | `/:id/lock` | `backend/src/routes/adminUser.routes.ts:27` |
| PATCH | `/:id/unlock` | `backend/src/routes/adminUser.routes.ts:28` |
| POST | `/:id/force-password-reset` | `backend/src/routes/adminUser.routes.ts:29` |
| POST | `/:id/revoke-sessions` | `backend/src/routes/adminUser.routes.ts:30` |
| POST | `/:id/disable-mfa` | `backend/src/routes/adminUser.routes.ts:31` |
| GET | `/:id/activity` | `backend/src/routes/adminUser.routes.ts:32` |
| GET | `/:id/sessions` | `backend/src/routes/adminUser.routes.ts:33` |

### aiAssistant.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| POST | `/chat` | `backend/src/routes/aiAssistant.routes.ts:8` |

### analytics.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/` | `backend/src/routes/analytics.routes.ts:11` |

### attendance.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| POST | `/sessions` | `backend/src/routes/attendance.routes.ts:58` |
| PATCH | `/sessions/:id` | `backend/src/routes/attendance.routes.ts:59` |
| POST | `/sessions/:id/lock` | `backend/src/routes/attendance.routes.ts:60` |
| GET | `/summary` | `backend/src/routes/attendance.routes.ts:61` |
| POST | `/teacher/self` | `backend/src/routes/attendance.routes.ts:62` |
| GET | `/teacher/self` | `backend/src/routes/attendance.routes.ts:63` |
| POST | `/substitutions` | `backend/src/routes/attendance.routes.ts:64` |
| GET | `/substitutions` | `backend/src/routes/attendance.routes.ts:65` |
| PATCH | `/substitutions/:id/cancel` | `backend/src/routes/attendance.routes.ts:66` |
| POST | `/periods` | `backend/src/routes/attendance.routes.ts:69` |
| GET | `/periods` | `backend/src/routes/attendance.routes.ts:70` |
| GET | `/periods/:id` | `backend/src/routes/attendance.routes.ts:71` |
| PATCH | `/periods/:id` | `backend/src/routes/attendance.routes.ts:72` |
| DELETE | `/periods/:id` | `backend/src/routes/attendance.routes.ts:73` |
| POST | `/legacy/sessions` | `backend/src/routes/attendance.routes.ts:75` |
| GET | `/legacy/sessions` | `backend/src/routes/attendance.routes.ts:76` |
| POST | `/legacy/sessions/:id/close` | `backend/src/routes/attendance.routes.ts:77` |
| POST | `/legacy/records` | `backend/src/routes/attendance.routes.ts:78` |
| PATCH | `/legacy/records/:id/override` | `backend/src/routes/attendance.routes.ts:79` |
| GET | `/legacy/sessions/:sessionId/records` | `backend/src/routes/attendance.routes.ts:80` |

### attendanceApproval.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| POST | `/sessions/:sessionId/approve` | `backend/src/routes/attendanceApproval.routes.ts:17` |
| POST | `/sessions/:sessionId/reject` | `backend/src/routes/attendanceApproval.routes.ts:18` |

### attendanceSummary.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/` | `backend/src/routes/attendanceSummary.routes.ts:12` |

### auditLog.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/` | `backend/src/routes/auditLog.routes.ts:22` |
| GET | `/` | `backend/src/routes/auditLog.routes.ts:26` |
| GET | `/summary` | `backend/src/routes/auditLog.routes.ts:27` |
| GET | `/high-risk` | `backend/src/routes/auditLog.routes.ts:28` |
| POST | `/export` | `backend/src/routes/auditLog.routes.ts:29` |
| GET | `/:id` | `backend/src/routes/auditLog.routes.ts:30` |
| GET | `/` | `backend/src/routes/auditLog.routes.ts:34` |
| GET | `/:id` | `backend/src/routes/auditLog.routes.ts:35` |
| GET | `/:id/download` | `backend/src/routes/auditLog.routes.ts:36` |

### auth.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/login-experience` | `backend/src/routes/auth.routes.ts:44` |
| POST | `/login` | `backend/src/routes/auth.routes.ts:46` |
| POST | `/verify-2fa` | `backend/src/routes/auth.routes.ts:48` |
| POST | `/resend-2fa` | `backend/src/routes/auth.routes.ts:50` |
| POST | `/totp/setup` | `backend/src/routes/auth.routes.ts:52` |
| POST | `/totp/verify-setup` | `backend/src/routes/auth.routes.ts:54` |
| POST | `/totp/disable` | `backend/src/routes/auth.routes.ts:56` |
| POST | `/totp/verify-login` | `backend/src/routes/auth.routes.ts:58` |
| POST | `/forgot-password` | `backend/src/routes/auth.routes.ts:60` |
| POST | `/reset-password` | `backend/src/routes/auth.routes.ts:62` |
| POST | `/refresh` | `backend/src/routes/auth.routes.ts:64` |
| POST | `/logout` | `backend/src/routes/auth.routes.ts:66` |
| POST | `/change-password` | `backend/src/routes/auth.routes.ts:68` |
| GET | `/sessions` | `backend/src/routes/auth.routes.ts:70` |
| DELETE | `/sessions/:sessionId` | `backend/src/routes/auth.routes.ts:72` |
| POST | `/logout-all` | `backend/src/routes/auth.routes.ts:74` |

### backup.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| POST | `/backups` | `backend/src/routes/backup.routes.ts:23` |
| GET | `/backups` | `backend/src/routes/backup.routes.ts:24` |
| GET | `/backups/:id` | `backend/src/routes/backup.routes.ts:25` |
| POST | `/backups/:id/run` | `backend/src/routes/backup.routes.ts:26` |
| GET | `/backups/:id/download` | `backend/src/routes/backup.routes.ts:27` |
| POST | `/restores` | `backend/src/routes/backup.routes.ts:28` |
| GET | `/restores` | `backend/src/routes/backup.routes.ts:29` |
| GET | `/restores/:id` | `backend/src/routes/backup.routes.ts:30` |
| POST | `/restores/:id/approve` | `backend/src/routes/backup.routes.ts:31` |
| POST | `/restores/:id/reject` | `backend/src/routes/backup.routes.ts:32` |
| POST | `/restores/:id/run` | `backend/src/routes/backup.routes.ts:33` |

### consent.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| POST | `/documents` | `backend/src/routes/consent.routes.ts:16` |
| POST | `/records` | `backend/src/routes/consent.routes.ts:17` |
| GET | `/records` | `backend/src/routes/consent.routes.ts:18` |
| POST | `/records/:id/withdraw` | `backend/src/routes/consent.routes.ts:19` |

### dataCompliance.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| POST | `/exports` | `backend/src/routes/dataCompliance.routes.ts:27` |
| GET | `/exports` | `backend/src/routes/dataCompliance.routes.ts:28` |
| POST | `/exports/:id/approve` | `backend/src/routes/dataCompliance.routes.ts:29` |
| POST | `/exports/:id/reject` | `backend/src/routes/dataCompliance.routes.ts:30` |
| GET | `/exports/:id` | `backend/src/routes/dataCompliance.routes.ts:31` |
| POST | `/deletions` | `backend/src/routes/dataCompliance.routes.ts:33` |
| GET | `/deletions` | `backend/src/routes/dataCompliance.routes.ts:34` |
| POST | `/deletions/:id/approve` | `backend/src/routes/dataCompliance.routes.ts:35` |
| POST | `/deletions/:id/reject` | `backend/src/routes/dataCompliance.routes.ts:36` |
| GET | `/deletions/:id` | `backend/src/routes/dataCompliance.routes.ts:37` |
| POST | `/deletions/:id/execute` | `backend/src/routes/dataCompliance.routes.ts:38` |
| GET | `/jobs/:id/history` | `backend/src/routes/dataCompliance.routes.ts:39` |
| GET | `/summary` | `backend/src/routes/dataCompliance.routes.ts:44` |
| GET | `/export-requests` | `backend/src/routes/dataCompliance.routes.ts:45` |
| GET | `/export-requests/:id` | `backend/src/routes/dataCompliance.routes.ts:46` |
| POST | `/export-requests/:id/approve` | `backend/src/routes/dataCompliance.routes.ts:47` |
| POST | `/export-requests/:id/reject` | `backend/src/routes/dataCompliance.routes.ts:48` |
| GET | `/deletion-requests` | `backend/src/routes/dataCompliance.routes.ts:50` |
| GET | `/deletion-requests/:id` | `backend/src/routes/dataCompliance.routes.ts:51` |
| POST | `/deletion-requests/:id/approve` | `backend/src/routes/dataCompliance.routes.ts:52` |
| POST | `/deletion-requests/:id/reject` | `backend/src/routes/dataCompliance.routes.ts:53` |
| GET | `/consents` | `backend/src/routes/dataCompliance.routes.ts:55` |
| GET | `/jobs` | `backend/src/routes/dataCompliance.routes.ts:56` |
| GET | `/jobs/:id/history` | `backend/src/routes/dataCompliance.routes.ts:57` |

### dormitory.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/report` | `backend/src/routes/dormitory.routes.ts:29` |
| GET | `/student-assignments` | `backend/src/routes/dormitory.routes.ts:31` |
| POST | `/student-assignments` | `backend/src/routes/dormitory.routes.ts:32` |
| PATCH | `/student-assignments/:id` | `backend/src/routes/dormitory.routes.ts:33` |
| DELETE | `/student-assignments/:id` | `backend/src/routes/dormitory.routes.ts:34` |
| GET | `/room-types` | `backend/src/routes/dormitory.routes.ts:36` |
| POST | `/room-types` | `backend/src/routes/dormitory.routes.ts:37` |
| PATCH | `/room-types/:id` | `backend/src/routes/dormitory.routes.ts:38` |
| DELETE | `/room-types/:id` | `backend/src/routes/dormitory.routes.ts:39` |
| GET | `/rooms` | `backend/src/routes/dormitory.routes.ts:41` |
| POST | `/rooms` | `backend/src/routes/dormitory.routes.ts:42` |
| PATCH | `/rooms/:id` | `backend/src/routes/dormitory.routes.ts:43` |
| DELETE | `/rooms/:id` | `backend/src/routes/dormitory.routes.ts:44` |
| GET | `/` | `backend/src/routes/dormitory.routes.ts:46` |
| POST | `/` | `backend/src/routes/dormitory.routes.ts:47` |
| PATCH | `/:id` | `backend/src/routes/dormitory.routes.ts:48` |
| DELETE | `/:id` | `backend/src/routes/dormitory.routes.ts:49` |

### evidence.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| POST | `/` | `backend/src/routes/evidence.routes.ts:11` |
| GET | `/:recordId` | `backend/src/routes/evidence.routes.ts:13` |

### exam.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| POST | `/` | `backend/src/routes/exam.routes.ts:47` |
| GET | `/` | `backend/src/routes/exam.routes.ts:48` |
| GET | `/grading-settings` | `backend/src/routes/exam.routes.ts:49` |
| PUT | `/grading-settings` | `backend/src/routes/exam.routes.ts:50` |
| GET | `/marks` | `backend/src/routes/exam.routes.ts:51` |
| GET | `/centers` | `backend/src/routes/exam.routes.ts:52` |
| POST | `/centers` | `backend/src/routes/exam.routes.ts:53` |
| PATCH | `/centers/:centerId` | `backend/src/routes/exam.routes.ts:54` |
| DELETE | `/centers/:centerId` | `backend/src/routes/exam.routes.ts:55` |
| GET | `/rooms` | `backend/src/routes/exam.routes.ts:56` |
| POST | `/rooms` | `backend/src/routes/exam.routes.ts:57` |
| PATCH | `/rooms/:roomId` | `backend/src/routes/exam.routes.ts:58` |
| DELETE | `/rooms/:roomId` | `backend/src/routes/exam.routes.ts:59` |
| POST | `/:examId/seating/generate` | `backend/src/routes/exam.routes.ts:60` |
| GET | `/:examId/seating` | `backend/src/routes/exam.routes.ts:61` |
| DELETE | `/:examId/seating` | `backend/src/routes/exam.routes.ts:62` |
| POST | `/:examId/invigilators/auto-assign` | `backend/src/routes/exam.routes.ts:63` |
| POST | `/:examId/invigilators/assign` | `backend/src/routes/exam.routes.ts:64` |
| GET | `/:examId/invigilators` | `backend/src/routes/exam.routes.ts:65` |
| DELETE | `/:examId/invigilators/:assignmentId` | `backend/src/routes/exam.routes.ts:66` |
| GET | `/:examId/hall-tickets` | `backend/src/routes/exam.routes.ts:67` |
| GET | `/:examId/hall-tickets/:studentId/pdf` | `backend/src/routes/exam.routes.ts:68` |
| GET | `/:id` | `backend/src/routes/exam.routes.ts:69` |
| PATCH | `/:id` | `backend/src/routes/exam.routes.ts:70` |
| DELETE | `/:id` | `backend/src/routes/exam.routes.ts:71` |
| POST | `/papers` | `backend/src/routes/exam.routes.ts:73` |
| POST | `/marks/upload` | `backend/src/routes/exam.routes.ts:74` |
| POST | `/marks/:id/moderate` | `backend/src/routes/exam.routes.ts:75` |
| POST | `/marks/:id/revaluation` | `backend/src/routes/exam.routes.ts:76` |

### face.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| POST | `/enroll` | `backend/src/routes/face.routes.ts:18` |
| POST | `/re-enroll` | `backend/src/routes/face.routes.ts:19` |
| POST | `/:id/approve` | `backend/src/routes/face.routes.ts:20` |
| POST | `/:id/reject` | `backend/src/routes/face.routes.ts:21` |
| GET | `/:id` | `backend/src/routes/face.routes.ts:22` |
| GET | `/by-student/:studentId` | `backend/src/routes/face.routes.ts:23` |

### feature-flag.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/login-experience` | `backend/src/routes/feature-flag.routes.ts:26` |
| PUT | `/login-experience` | `backend/src/routes/feature-flag.routes.ts:27` |
| GET | `/auth-security` | `backend/src/routes/feature-flag.routes.ts:28` |
| PUT | `/auth-security` | `backend/src/routes/feature-flag.routes.ts:29` |
| POST | `/flags` | `backend/src/routes/feature-flag.routes.ts:31` |
| GET | `/flags` | `backend/src/routes/feature-flag.routes.ts:32` |
| PATCH | `/flags/:id` | `backend/src/routes/feature-flag.routes.ts:33` |
| DELETE | `/flags/:id` | `backend/src/routes/feature-flag.routes.ts:34` |
| POST | `/overrides` | `backend/src/routes/feature-flag.routes.ts:35` |
| POST | `/configs` | `backend/src/routes/feature-flag.routes.ts:37` |
| GET | `/configs` | `backend/src/routes/feature-flag.routes.ts:38` |
| PATCH | `/configs/:id` | `backend/src/routes/feature-flag.routes.ts:39` |
| POST | `/configs/overrides` | `backend/src/routes/feature-flag.routes.ts:40` |

### feeManagement.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/metadata` | `backend/src/routes/feeManagement.routes.ts:56` |
| GET | `/particulars` | `backend/src/routes/feeManagement.routes.ts:58` |
| POST | `/particulars` | `backend/src/routes/feeManagement.routes.ts:59` |
| PATCH | `/particulars/:id` | `backend/src/routes/feeManagement.routes.ts:60` |
| DELETE | `/particulars/:id` | `backend/src/routes/feeManagement.routes.ts:61` |
| GET | `/types` | `backend/src/routes/feeManagement.routes.ts:63` |
| POST | `/types` | `backend/src/routes/feeManagement.routes.ts:64` |
| PATCH | `/types/:id` | `backend/src/routes/feeManagement.routes.ts:65` |
| DELETE | `/types/:id` | `backend/src/routes/feeManagement.routes.ts:66` |
| GET | `/structures` | `backend/src/routes/feeManagement.routes.ts:68` |
| POST | `/structures` | `backend/src/routes/feeManagement.routes.ts:69` |
| PATCH | `/structures/:id` | `backend/src/routes/feeManagement.routes.ts:70` |
| DELETE | `/structures/:id` | `backend/src/routes/feeManagement.routes.ts:71` |
| POST | `/structures/:id/duplicate` | `backend/src/routes/feeManagement.routes.ts:72` |
| GET | `/assignments` | `backend/src/routes/feeManagement.routes.ts:74` |
| POST | `/assignments` | `backend/src/routes/feeManagement.routes.ts:75` |
| PATCH | `/assignments/:id` | `backend/src/routes/feeManagement.routes.ts:76` |
| DELETE | `/assignments/:id` | `backend/src/routes/feeManagement.routes.ts:77` |
| PATCH | `/assignments/:id/activate` | `backend/src/routes/feeManagement.routes.ts:78` |
| PATCH | `/assignments/:id/deactivate` | `backend/src/routes/feeManagement.routes.ts:79` |
| GET | `/invoices` | `backend/src/routes/feeManagement.routes.ts:81` |
| POST | `/invoices/preview` | `backend/src/routes/feeManagement.routes.ts:82` |
| POST | `/invoices/generate` | `backend/src/routes/feeManagement.routes.ts:83` |
| PATCH | `/invoices/:id/cancel` | `backend/src/routes/feeManagement.routes.ts:84` |
| GET | `/payments` | `backend/src/routes/feeManagement.routes.ts:86` |
| POST | `/payments` | `backend/src/routes/feeManagement.routes.ts:87` |
| GET | `/collection/students` | `backend/src/routes/feeManagement.routes.ts:88` |
| GET | `/collection/students/:studentId/invoices` | `backend/src/routes/feeManagement.routes.ts:89` |
| GET | `/ledger` | `backend/src/routes/feeManagement.routes.ts:91` |
| GET | `/ledger/export.pdf` | `backend/src/routes/feeManagement.routes.ts:92` |
| GET | `/ledger/export.xlsx` | `backend/src/routes/feeManagement.routes.ts:93` |
| GET | `/ledger/:studentId/export.pdf` | `backend/src/routes/feeManagement.routes.ts:94` |
| GET | `/ledger/:studentId/export.xlsx` | `backend/src/routes/feeManagement.routes.ts:95` |
| GET | `/ledger/:studentId` | `backend/src/routes/feeManagement.routes.ts:96` |
| GET | `/discounts` | `backend/src/routes/feeManagement.routes.ts:98` |
| POST | `/discounts` | `backend/src/routes/feeManagement.routes.ts:99` |
| PATCH | `/discounts/:id` | `backend/src/routes/feeManagement.routes.ts:100` |
| DELETE | `/discounts/:id` | `backend/src/routes/feeManagement.routes.ts:101` |
| PATCH | `/discounts/:id/approve` | `backend/src/routes/feeManagement.routes.ts:102` |
| PATCH | `/discounts/:id/reject` | `backend/src/routes/feeManagement.routes.ts:103` |
| PATCH | `/discounts/:id/activate` | `backend/src/routes/feeManagement.routes.ts:104` |
| PATCH | `/discounts/:id/deactivate` | `backend/src/routes/feeManagement.routes.ts:105` |
| GET | `/fines` | `backend/src/routes/feeManagement.routes.ts:107` |
| POST | `/fines` | `backend/src/routes/feeManagement.routes.ts:108` |
| DELETE | `/fines/:id` | `backend/src/routes/feeManagement.routes.ts:109` |
| GET | `/reports/export` | `backend/src/routes/feeManagement.routes.ts:111` |
| GET | `/reports` | `backend/src/routes/feeManagement.routes.ts:112` |

### homework.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| POST | `/attachments` | `backend/src/routes/homework.routes.ts:21` |
| GET | `/evaluation-report` | `backend/src/routes/homework.routes.ts:22` |
| GET | `/` | `backend/src/routes/homework.routes.ts:24` |
| POST | `/` | `backend/src/routes/homework.routes.ts:25` |
| PATCH | `/:id` | `backend/src/routes/homework.routes.ts:26` |
| DELETE | `/:id` | `backend/src/routes/homework.routes.ts:27` |
| GET | `/:id/evaluations` | `backend/src/routes/homework.routes.ts:28` |
| POST | `/:id/evaluations` | `backend/src/routes/homework.routes.ts:29` |

### import.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| POST | `/` | `backend/src/routes/import.routes.ts:15` |
| GET | `/` | `backend/src/routes/import.routes.ts:16` |
| GET | `/:id` | `backend/src/routes/import.routes.ts:17` |
| GET | `/:id/errors` | `backend/src/routes/import.routes.ts:18` |

### job.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/:queue/:id` | `backend/src/routes/job.routes.ts:11` |

### leave.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/types` | `backend/src/routes/leave.routes.ts:30` |
| POST | `/types` | `backend/src/routes/leave.routes.ts:31` |
| PATCH | `/types/:id` | `backend/src/routes/leave.routes.ts:32` |
| DELETE | `/types/:id` | `backend/src/routes/leave.routes.ts:33` |
| GET | `/defines` | `backend/src/routes/leave.routes.ts:35` |
| POST | `/defines` | `backend/src/routes/leave.routes.ts:36` |
| PATCH | `/defines/:id` | `backend/src/routes/leave.routes.ts:37` |
| DELETE | `/defines/:id` | `backend/src/routes/leave.routes.ts:38` |
| GET | `/balances/me` | `backend/src/routes/leave.routes.ts:40` |
| GET | `/applications` | `backend/src/routes/leave.routes.ts:42` |
| POST | `/applications` | `backend/src/routes/leave.routes.ts:43` |
| GET | `/applications/:id` | `backend/src/routes/leave.routes.ts:44` |
| PATCH | `/applications/:id` | `backend/src/routes/leave.routes.ts:45` |
| DELETE | `/applications/:id` | `backend/src/routes/leave.routes.ts:46` |
| PATCH | `/applications/:id/status` | `backend/src/routes/leave.routes.ts:47` |
| GET | `/requests` | `backend/src/routes/leave.routes.ts:50` |
| POST | `/requests` | `backend/src/routes/leave.routes.ts:51` |
| PATCH | `/requests/:id` | `backend/src/routes/leave.routes.ts:52` |
| DELETE | `/requests/:id` | `backend/src/routes/leave.routes.ts:53` |
| PATCH | `/requests/:id/approve` | `backend/src/routes/leave.routes.ts:54` |
| PATCH | `/requests/:id/reject` | `backend/src/routes/leave.routes.ts:55` |

### library.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/issued` | `backend/src/routes/library.routes.ts:27` |
| PATCH | `/issues/:id/return` | `backend/src/routes/library.routes.ts:28` |
| GET | `/categories` | `backend/src/routes/library.routes.ts:30` |
| POST | `/categories` | `backend/src/routes/library.routes.ts:31` |
| PATCH | `/categories/:id` | `backend/src/routes/library.routes.ts:32` |
| DELETE | `/categories/:id` | `backend/src/routes/library.routes.ts:33` |
| GET | `/books` | `backend/src/routes/library.routes.ts:35` |
| POST | `/books` | `backend/src/routes/library.routes.ts:36` |
| PATCH | `/books/:id` | `backend/src/routes/library.routes.ts:37` |
| DELETE | `/books/:id` | `backend/src/routes/library.routes.ts:38` |
| GET | `/members` | `backend/src/routes/library.routes.ts:40` |
| POST | `/members` | `backend/src/routes/library.routes.ts:41` |
| DELETE | `/members/:id` | `backend/src/routes/library.routes.ts:42` |
| GET | `/members/:memberId/issues` | `backend/src/routes/library.routes.ts:43` |
| POST | `/members/:memberId/issues` | `backend/src/routes/library.routes.ts:44` |

### messagingAdmin.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/` | `backend/src/routes/messagingAdmin.routes.ts:17` |
| GET | `/platform-email-config` | `backend/src/routes/messagingAdmin.routes.ts:18` |
| PUT | `/platform-email-config` | `backend/src/routes/messagingAdmin.routes.ts:19` |
| PATCH | `/platform-email-config/status` | `backend/src/routes/messagingAdmin.routes.ts:20` |
| PATCH | `/:id/status` | `backend/src/routes/messagingAdmin.routes.ts:21` |

### messagingSettings.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/services` | `backend/src/routes/messagingSettings.routes.ts:16` |
| GET | `/config` | `backend/src/routes/messagingSettings.routes.ts:17` |
| PUT | `/config` | `backend/src/routes/messagingSettings.routes.ts:18` |
| PATCH | `/config/status` | `backend/src/routes/messagingSettings.routes.ts:19` |

### notification.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| POST | `/templates` | `backend/src/routes/notification.routes.ts:17` |
| GET | `/templates` | `backend/src/routes/notification.routes.ts:18` |
| POST | `/send` | `backend/src/routes/notification.routes.ts:19` |
| GET | `/logs` | `backend/src/routes/notification.routes.ts:20` |
| GET | `/summary` | `backend/src/routes/notification.routes.ts:21` |

### otp.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| POST | `/request` | `backend/src/routes/otp.routes.ts:7` |
| POST | `/verify` | `backend/src/routes/otp.routes.ts:9` |

### parentPortal.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/children` | `backend/src/routes/parentPortal.routes.ts:22` |
| GET | `/profile` | `backend/src/routes/parentPortal.routes.ts:23` |
| GET | `/dashboard` | `backend/src/routes/parentPortal.routes.ts:24` |
| GET | `/exams` | `backend/src/routes/parentPortal.routes.ts:25` |
| GET | `/results` | `backend/src/routes/parentPortal.routes.ts:26` |
| GET | `/subjects` | `backend/src/routes/parentPortal.routes.ts:27` |
| GET | `/attendance` | `backend/src/routes/parentPortal.routes.ts:28` |
| GET | `/notices` | `backend/src/routes/parentPortal.routes.ts:29` |
| GET | `/timetable` | `backend/src/routes/parentPortal.routes.ts:30` |
| GET | `/fees` | `backend/src/routes/parentPortal.routes.ts:31` |

### publicAsset.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/branding` | `backend/src/routes/publicAsset.routes.ts:6` |

### publicBranding.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/login` | `backend/src/routes/publicBranding.routes.ts:6` |

### recognition.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| POST | `/match` | `backend/src/routes/recognition.routes.ts:13` |

### report.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/term` | `backend/src/routes/report.routes.ts:17` |
| GET | `/annual` | `backend/src/routes/report.routes.ts:18` |
| GET | `/rank` | `backend/src/routes/report.routes.ts:19` |
| GET | `/catalog` | `backend/src/routes/report.routes.ts:20` |
| GET | `/:reportKey/export.csv` | `backend/src/routes/report.routes.ts:21` |
| GET | `/:reportKey/export.pdf` | `backend/src/routes/report.routes.ts:22` |
| GET | `/:reportKey` | `backend/src/routes/report.routes.ts:23` |

### schoolAdmin.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| POST | `/` | `backend/src/routes/schoolAdmin.routes.ts:22` |
| GET | `/` | `backend/src/routes/schoolAdmin.routes.ts:23` |
| GET | `/:id/admins` | `backend/src/routes/schoolAdmin.routes.ts:24` |
| PATCH | `/:id` | `backend/src/routes/schoolAdmin.routes.ts:25` |
| PATCH | `/:id/admins/:adminId/status` | `backend/src/routes/schoolAdmin.routes.ts:26` |
| POST | `/:id/activate` | `backend/src/routes/schoolAdmin.routes.ts:27` |
| POST | `/:id/suspend` | `backend/src/routes/schoolAdmin.routes.ts:28` |
| POST | `/:id/admins` | `backend/src/routes/schoolAdmin.routes.ts:29` |
| DELETE | `/:id` | `backend/src/routes/schoolAdmin.routes.ts:30` |
| POST | `/:id/restore` | `backend/src/routes/schoolAdmin.routes.ts:31` |

### schoolDomain.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/` | `backend/src/routes/schoolDomain.routes.ts:6` |

### schoolOnboarding.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/:schoolId/onboarding` | `backend/src/routes/schoolOnboarding.routes.ts:16` |
| PUT | `/:schoolId/onboarding/checklist/:key` | `backend/src/routes/schoolOnboarding.routes.ts:17` |
| POST | `/:schoolId/onboarding/recalculate` | `backend/src/routes/schoolOnboarding.routes.ts:18` |
| POST | `/:schoolId/onboarding/request-review` | `backend/src/routes/schoolOnboarding.routes.ts:19` |
| POST | `/:schoolId/onboarding/go-live` | `backend/src/routes/schoolOnboarding.routes.ts:20` |
| POST | `/:schoolId/onboarding/block` | `backend/src/routes/schoolOnboarding.routes.ts:21` |

### schoolSystemSettings.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/school` | `backend/src/routes/schoolSystemSettings.routes.ts:11` |
| PUT | `/school` | `backend/src/routes/schoolSystemSettings.routes.ts:12` |

### staff.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/departments` | `backend/src/routes/staff.routes.ts:38` |
| POST | `/departments` | `backend/src/routes/staff.routes.ts:39` |
| GET | `/designations` | `backend/src/routes/staff.routes.ts:40` |
| POST | `/designations` | `backend/src/routes/staff.routes.ts:41` |
| POST | `/defaults` | `backend/src/routes/staff.routes.ts:42` |
| GET | `/attendance` | `backend/src/routes/staff.routes.ts:44` |
| POST | `/attendance` | `backend/src/routes/staff.routes.ts:45` |
| GET | `/attendance/report` | `backend/src/routes/staff.routes.ts:46` |
| GET | `/payroll` | `backend/src/routes/staff.routes.ts:48` |
| POST | `/payroll/generate` | `backend/src/routes/staff.routes.ts:49` |
| GET | `/payroll/report` | `backend/src/routes/staff.routes.ts:50` |
| POST | `/payroll/:id/pay` | `backend/src/routes/staff.routes.ts:51` |
| GET | `/` | `backend/src/routes/staff.routes.ts:53` |
| POST | `/` | `backend/src/routes/staff.routes.ts:54` |
| GET | `/:id` | `backend/src/routes/staff.routes.ts:55` |
| PATCH | `/:id` | `backend/src/routes/staff.routes.ts:56` |
| DELETE | `/:id` | `backend/src/routes/staff.routes.ts:57` |
| POST | `/:id/documents` | `backend/src/routes/staff.routes.ts:58` |
| DELETE | `/:id/documents/:documentId` | `backend/src/routes/staff.routes.ts:59` |
| POST | `/:id/timeline` | `backend/src/routes/staff.routes.ts:60` |
| DELETE | `/:id/timeline/:timelineId` | `backend/src/routes/staff.routes.ts:61` |

### student.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/students/import/sample` | `backend/src/routes/student.routes.ts:68` |
| POST | `/students/import` | `backend/src/routes/student.routes.ts:69` |
| GET | `/attendance/options` | `backend/src/routes/student.routes.ts:70` |
| GET | `/attendance` | `backend/src/routes/student.routes.ts:71` |
| POST | `/attendance` | `backend/src/routes/student.routes.ts:72` |
| GET | `/attendance/report` | `backend/src/routes/student.routes.ts:73` |
| GET | `/groups` | `backend/src/routes/student.routes.ts:74` |
| POST | `/groups` | `backend/src/routes/student.routes.ts:75` |
| PATCH | `/groups/:id` | `backend/src/routes/student.routes.ts:76` |
| DELETE | `/groups/:id` | `backend/src/routes/student.routes.ts:77` |
| GET | `/categories` | `backend/src/routes/student.routes.ts:78` |
| POST | `/categories` | `backend/src/routes/student.routes.ts:79` |
| PATCH | `/categories/:id` | `backend/src/routes/student.routes.ts:80` |
| DELETE | `/categories/:id` | `backend/src/routes/student.routes.ts:81` |
| GET | `/promotions/preview` | `backend/src/routes/student.routes.ts:82` |
| POST | `/promotions` | `backend/src/routes/student.routes.ts:83` |
| GET | `/disabled` | `backend/src/routes/student.routes.ts:84` |
| POST | `/students/:id/disable` | `backend/src/routes/student.routes.ts:85` |
| POST | `/disabled/:id/restore` | `backend/src/routes/student.routes.ts:86` |
| DELETE | `/disabled/:id` | `backend/src/routes/student.routes.ts:87` |
| POST | `/students` | `backend/src/routes/student.routes.ts:88` |
| GET | `/students` | `backend/src/routes/student.routes.ts:89` |
| GET | `/students/:id` | `backend/src/routes/student.routes.ts:90` |
| PATCH | `/students/:id` | `backend/src/routes/student.routes.ts:91` |
| DELETE | `/students/:id` | `backend/src/routes/student.routes.ts:92` |
| POST | `/students/:id/photos` | `backend/src/routes/student.routes.ts:93` |
| DELETE | `/students/:id/photos/:photoId` | `backend/src/routes/student.routes.ts:94` |
| POST | `/students/:id/documents` | `backend/src/routes/student.routes.ts:95` |
| DELETE | `/students/:id/documents/:documentId` | `backend/src/routes/student.routes.ts:96` |
| POST | `/students/:id/timeline` | `backend/src/routes/student.routes.ts:97` |
| DELETE | `/students/:id/timeline/:timelineId` | `backend/src/routes/student.routes.ts:98` |
| POST | `/students/:id/parents` | `backend/src/routes/student.routes.ts:99` |
| DELETE | `/students/:id/parents/:parentId` | `backend/src/routes/student.routes.ts:100` |
| POST | `/students/:id/status` | `backend/src/routes/student.routes.ts:101` |
| GET | `/transfer-targets` | `backend/src/routes/student.routes.ts:102` |
| POST | `/students/:id/transfer-requests` | `backend/src/routes/student.routes.ts:103` |
| GET | `/transfer-requests` | `backend/src/routes/student.routes.ts:104` |
| POST | `/transfer-requests/:id/accept` | `backend/src/routes/student.routes.ts:105` |
| POST | `/transfer-requests/:id/reject` | `backend/src/routes/student.routes.ts:106` |
| POST | `/parents` | `backend/src/routes/student.routes.ts:108` |
| GET | `/parents` | `backend/src/routes/student.routes.ts:109` |
| GET | `/parents/lookup` | `backend/src/routes/student.routes.ts:110` |
| GET | `/parents/:id` | `backend/src/routes/student.routes.ts:111` |
| PATCH | `/parents/:id` | `backend/src/routes/student.routes.ts:112` |
| DELETE | `/parents/:id` | `backend/src/routes/student.routes.ts:113` |

### subscription.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/plans` | `backend/src/routes/subscription.routes.ts:35` |
| GET | `/usage` | `backend/src/routes/subscription.routes.ts:36` |
| GET | `/invoices` | `backend/src/routes/subscription.routes.ts:37` |
| GET | `/` | `backend/src/routes/subscription.routes.ts:38` |
| POST | `/` | `backend/src/routes/subscription.routes.ts:39` |
| GET | `/` | `backend/src/routes/subscription.routes.ts:44` |
| GET | `/summary` | `backend/src/routes/subscription.routes.ts:45` |
| GET | `/:schoolId` | `backend/src/routes/subscription.routes.ts:46` |
| POST | `/:schoolId/assign-plan` | `backend/src/routes/subscription.routes.ts:47` |
| POST | `/:schoolId/start-trial` | `backend/src/routes/subscription.routes.ts:48` |
| POST | `/:schoolId/extend-trial` | `backend/src/routes/subscription.routes.ts:49` |
| POST | `/:schoolId/upgrade` | `backend/src/routes/subscription.routes.ts:50` |
| POST | `/:schoolId/downgrade` | `backend/src/routes/subscription.routes.ts:51` |
| POST | `/:schoolId/pause` | `backend/src/routes/subscription.routes.ts:52` |
| POST | `/:schoolId/resume` | `backend/src/routes/subscription.routes.ts:53` |
| POST | `/:schoolId/cancel` | `backend/src/routes/subscription.routes.ts:54` |
| POST | `/:schoolId/renew` | `backend/src/routes/subscription.routes.ts:55` |
| PATCH | `/:schoolId/limits` | `backend/src/routes/subscription.routes.ts:56` |
| GET | `/:schoolId/history` | `backend/src/routes/subscription.routes.ts:57` |
| GET | `/:schoolId/usage` | `backend/src/routes/subscription.routes.ts:58` |
| GET | `/:schoolId/invoices` | `backend/src/routes/subscription.routes.ts:59` |
| POST | `/:schoolId/invoices/generate` | `backend/src/routes/subscription.routes.ts:60` |
| POST | `/:schoolId/manual-payment` | `backend/src/routes/subscription.routes.ts:61` |

### subscriptionMetrics.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/:schoolId` | `backend/src/routes/subscriptionMetrics.routes.ts:11` |

### subscriptionPlan.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/` | `backend/src/routes/subscriptionPlan.routes.ts:19` |
| GET | `/:id/schools` | `backend/src/routes/subscriptionPlan.routes.ts:20` |
| GET | `/:id/permissions` | `backend/src/routes/subscriptionPlan.routes.ts:21` |
| POST | `/` | `backend/src/routes/subscriptionPlan.routes.ts:22` |
| PATCH | `/:id` | `backend/src/routes/subscriptionPlan.routes.ts:23` |
| PUT | `/:id/permissions` | `backend/src/routes/subscriptionPlan.routes.ts:24` |
| DELETE | `/:id` | `backend/src/routes/subscriptionPlan.routes.ts:25` |

### teacher.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/onboarding` | `backend/src/routes/teacher.routes.ts:23` |
| POST | `/` | `backend/src/routes/teacher.routes.ts:24` |
| GET | `/` | `backend/src/routes/teacher.routes.ts:25` |
| GET | `/:teacherId/onboarding` | `backend/src/routes/teacher.routes.ts:26` |
| POST | `/:teacherId/onboarding/recalculate` | `backend/src/routes/teacher.routes.ts:27` |
| PATCH | `/:teacherId/onboarding` | `backend/src/routes/teacher.routes.ts:28` |
| POST | `/:teacherId/credentials/resend` | `backend/src/routes/teacher.routes.ts:29` |
| POST | `/:teacherId/credentials/manual-share-confirm` | `backend/src/routes/teacher.routes.ts:30` |
| GET | `/:id` | `backend/src/routes/teacher.routes.ts:31` |
| PATCH | `/:id` | `backend/src/routes/teacher.routes.ts:32` |
| DELETE | `/:id` | `backend/src/routes/teacher.routes.ts:33` |

### teacherAssignment.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| PATCH | `/teachers/:teacherId/status` | `backend/src/routes/teacherAssignment.routes.ts:15` |
| POST | `/classes/assign` | `backend/src/routes/teacherAssignment.routes.ts:16` |
| POST | `/classes/unassign` | `backend/src/routes/teacherAssignment.routes.ts:17` |
| POST | `/subjects/assign` | `backend/src/routes/teacherAssignment.routes.ts:18` |
| POST | `/subjects/unassign` | `backend/src/routes/teacherAssignment.routes.ts:19` |

### theme.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| POST | `/` | `backend/src/routes/theme.routes.ts:23` |
| GET | `/` | `backend/src/routes/theme.routes.ts:25` |
| GET | `/active` | `backend/src/routes/theme.routes.ts:27` |
| GET | `/login-branding` | `backend/src/routes/theme.routes.ts:29` |
| PUT | `/login-branding` | `backend/src/routes/theme.routes.ts:31` |
| POST | `/login-branding/publish` | `backend/src/routes/theme.routes.ts:33` |
| POST | `/login-branding/rollback` | `backend/src/routes/theme.routes.ts:35` |
| POST | `/login-branding/reset` | `backend/src/routes/theme.routes.ts:37` |
| PATCH | `/:id` | `backend/src/routes/theme.routes.ts:39` |
| POST | `/:id/publish` | `backend/src/routes/theme.routes.ts:41` |
| POST | `/:id/rollback` | `backend/src/routes/theme.routes.ts:43` |

### ticket.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| POST | `/` | `backend/src/routes/ticket.routes.ts:27` |
| GET | `/` | `backend/src/routes/ticket.routes.ts:28` |
| GET | `/:id` | `backend/src/routes/ticket.routes.ts:29` |
| POST | `/:id/comments` | `backend/src/routes/ticket.routes.ts:30` |
| PATCH | `/:id` | `backend/src/routes/ticket.routes.ts:31` |
| PATCH | `/:id/status` | `backend/src/routes/ticket.routes.ts:32` |
| PATCH | `/:id/priority` | `backend/src/routes/ticket.routes.ts:33` |
| GET | `/` | `backend/src/routes/ticket.routes.ts:38` |
| GET | `/assignable-users` | `backend/src/routes/ticket.routes.ts:39` |
| GET | `/:id` | `backend/src/routes/ticket.routes.ts:40` |
| POST | `/:id/comments` | `backend/src/routes/ticket.routes.ts:41` |
| PATCH | `/:id` | `backend/src/routes/ticket.routes.ts:42` |
| PATCH | `/:id/assign` | `backend/src/routes/ticket.routes.ts:43` |
| PATCH | `/:id/status` | `backend/src/routes/ticket.routes.ts:44` |
| PATCH | `/:id/priority` | `backend/src/routes/ticket.routes.ts:45` |

### transport.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/drivers` | `backend/src/routes/transport.routes.ts:30` |
| GET | `/report` | `backend/src/routes/transport.routes.ts:31` |
| GET | `/student-assignments` | `backend/src/routes/transport.routes.ts:33` |
| POST | `/student-assignments` | `backend/src/routes/transport.routes.ts:34` |
| PATCH | `/student-assignments/:id` | `backend/src/routes/transport.routes.ts:35` |
| DELETE | `/student-assignments/:id` | `backend/src/routes/transport.routes.ts:36` |
| GET | `/assignments` | `backend/src/routes/transport.routes.ts:38` |
| POST | `/assignments` | `backend/src/routes/transport.routes.ts:39` |
| PATCH | `/assignments/:id` | `backend/src/routes/transport.routes.ts:40` |
| DELETE | `/assignments/:id` | `backend/src/routes/transport.routes.ts:41` |
| GET | `/routes` | `backend/src/routes/transport.routes.ts:43` |
| POST | `/routes` | `backend/src/routes/transport.routes.ts:44` |
| PATCH | `/routes/:id` | `backend/src/routes/transport.routes.ts:45` |
| DELETE | `/routes/:id` | `backend/src/routes/transport.routes.ts:46` |
| GET | `/vehicles` | `backend/src/routes/transport.routes.ts:48` |
| POST | `/vehicles` | `backend/src/routes/transport.routes.ts:49` |
| PATCH | `/vehicles/:id` | `backend/src/routes/transport.routes.ts:50` |
| DELETE | `/vehicles/:id` | `backend/src/routes/transport.routes.ts:51` |

### upload.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/signed` | `backend/src/routes/upload.routes.ts:148` |
| POST | `/branding` | `backend/src/routes/upload.routes.ts:175` |
| POST | `/photos` | `backend/src/routes/upload.routes.ts:248` |
| POST | `/documents` | `backend/src/routes/upload.routes.ts:277` |

### user.routes.ts

| Method | Local path | Source |
| --- | --- | --- |
| GET | `/me` | `backend/src/routes/user.routes.ts:19` |
| GET | `/me/timetable` | `backend/src/routes/user.routes.ts:20` |
| GET | `/me/assigned-classes` | `backend/src/routes/user.routes.ts:21` |
| GET | `/me/assigned-students` | `backend/src/routes/user.routes.ts:22` |
| GET | `/me/exam-papers` | `backend/src/routes/user.routes.ts:23` |
| POST | `/school-users` | `backend/src/routes/user.routes.ts:24` |
| GET | `/employee-permissions` | `backend/src/routes/user.routes.ts:25` |
| PUT | `/employee-permissions` | `backend/src/routes/user.routes.ts:26` |
| GET | `/:id` | `backend/src/routes/user.routes.ts:27` |

Route declarations documented in appendix: 577.
