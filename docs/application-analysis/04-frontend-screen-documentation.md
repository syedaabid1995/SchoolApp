# Document 4 - Frontend Screen Documentation

Generated from repository code on 2026-06-04. Source root: `/Users/syedaabidahamedarshad/Documents/TechStageIT/SchoolApp`.

## Screen Catalog

| Screen | Navigation Path | Source | Visible To Roles / Gate | API Calls In Page |
|---|---|---|---|---|
| :SchoolCode / Login | `/[schoolCode]/login` | `admin/app/[schoolCode]/login/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Change Password | `/change-password` | `admin/app/change-password/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Academics / Exams | `/dashboard/academics/exams` | `admin/app/dashboard/academics/exams/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Academics / Marks | `/dashboard/academics/marks` | `admin/app/dashboard/academics/marks/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Academics | `/dashboard/academics` | `admin/app/dashboard/academics/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Academics / Timetable | `/dashboard/academics/timetable` | `admin/app/dashboard/academics/timetable/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Analytics | `/dashboard/analytics` | `admin/app/dashboard/analytics/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Attendance / Locks | `/dashboard/attendance/locks` | `admin/app/dashboard/attendance/locks/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Attendance / My | `/dashboard/attendance/my` | `admin/app/dashboard/attendance/my/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Attendance / Overview | `/dashboard/attendance/overview` | `admin/app/dashboard/attendance/overview/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Attendance | `/dashboard/attendance` | `admin/app/dashboard/attendance/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Attendance / Students / Mark | `/dashboard/attendance/students/mark` | `admin/app/dashboard/attendance/students/mark/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Audit | `/dashboard/audit` | `admin/app/dashboard/audit/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Backups | `/dashboard/backups` | `admin/app/dashboard/backups/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Base Setup | `/dashboard/base-setup` | `admin/app/dashboard/base-setup/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Compliance | `/dashboard/compliance` | `admin/app/dashboard/compliance/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Dormitory | `/dashboard/dormitory` | `admin/app/dashboard/dormitory/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Fee Challan Details | `/dashboard/fee-challan-details` | `admin/app/dashboard/fee-challan-details/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Fees | `/dashboard/fees` | `admin/app/dashboard/fees/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Holidays | `/dashboard/holidays` | `admin/app/dashboard/holidays/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Homework | `/dashboard/homework` | `admin/app/dashboard/homework/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Id Cards / Editor | `/dashboard/id-cards/editor` | `admin/app/dashboard/id-cards/editor/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | `/api/id-cards/templates` |
| Id Cards | `/dashboard/id-cards` | `admin/app/dashboard/id-cards/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | `/api/id-cards/templates` |
| Institution Setup | `/dashboard/institution-setup` | `admin/app/dashboard/institution-setup/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Leave / My | `/dashboard/leave/my` | `admin/app/dashboard/leave/my/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Leave / Requests | `/dashboard/leave/requests` | `admin/app/dashboard/leave/requests/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Library | `/dashboard/library` | `admin/app/dashboard/library/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Dashboard | `/dashboard` | `admin/app/dashboard/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Parents / :Id | `/dashboard/parents/[id]` | `admin/app/dashboard/parents/[id]/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Parents | `/dashboard/parents` | `admin/app/dashboard/parents/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Payment Methods | `/dashboard/payment-methods` | `admin/app/dashboard/payment-methods/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Payroll | `/dashboard/payroll` | `admin/app/dashboard/payroll/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Payroll / Report | `/dashboard/payroll/report` | `admin/app/dashboard/payroll/report/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Plans | `/dashboard/plans` | `admin/app/dashboard/plans/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | `/api/auth/refresh` |
| Reports | `/dashboard/reports` | `admin/app/dashboard/reports/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Role Permissions | `/dashboard/role-permissions` | `admin/app/dashboard/role-permissions/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Schools / :Id / Admins | `/dashboard/schools/[id]/admins` | `admin/app/dashboard/schools/[id]/admins/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Schools | `/dashboard/schools` | `admin/app/dashboard/schools/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Sessions | `/dashboard/sessions` | `admin/app/dashboard/sessions/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Settings / Access | `/dashboard/settings/access` | `admin/app/dashboard/settings/access/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Settings / Branding | `/dashboard/settings/branding` | `admin/app/dashboard/settings/branding/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Settings / Consent | `/dashboard/settings/consent` | `admin/app/dashboard/settings/consent/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Settings | `/dashboard/settings` | `admin/app/dashboard/settings/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Settings / Security | `/dashboard/settings/security` | `admin/app/dashboard/settings/security/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Settings / Security / Totp | `/dashboard/settings/security/totp` | `admin/app/dashboard/settings/security/totp/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Settings / Sms | `/dashboard/settings/sms` | `admin/app/dashboard/settings/sms/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Sms Settings | `/dashboard/sms-settings` | `admin/app/dashboard/sms-settings/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Staff / :Id / Offer Letter | `/dashboard/staff/[id]/offer-letter` | `admin/app/dashboard/staff/[id]/offer-letter/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Staff / :Id | `/dashboard/staff/[id]` | `admin/app/dashboard/staff/[id]/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Staff / Add | `/dashboard/staff/add` | `admin/app/dashboard/staff/add/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Staff / Attendance | `/dashboard/staff/attendance` | `admin/app/dashboard/staff/attendance/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Staff | `/dashboard/staff` | `admin/app/dashboard/staff/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Students / :Id | `/dashboard/students/[id]` | `admin/app/dashboard/students/[id]/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Students / Add | `/dashboard/students/add` | `admin/app/dashboard/students/add/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Students / Attendance | `/dashboard/students/attendance` | `admin/app/dashboard/students/attendance/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Students / Disabled | `/dashboard/students/disabled` | `admin/app/dashboard/students/disabled/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Students / Groups | `/dashboard/students/groups` | `admin/app/dashboard/students/groups/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Students | `/dashboard/students` | `admin/app/dashboard/students/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Students / Promotion | `/dashboard/students/promotion` | `admin/app/dashboard/students/promotion/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Students / Transfers | `/dashboard/students/transfers` | `admin/app/dashboard/students/transfers/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Subscriptions | `/dashboard/subscriptions` | `admin/app/dashboard/subscriptions/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Support / :Id | `/dashboard/support/[id]` | `admin/app/dashboard/support/[id]/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Support | `/dashboard/support` | `admin/app/dashboard/support/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| System Health | `/dashboard/system-health` | `admin/app/dashboard/system-health/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Teachers / :Id | `/dashboard/teachers/[id]` | `admin/app/dashboard/teachers/[id]/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Teachers / Add | `/dashboard/teachers/add` | `admin/app/dashboard/teachers/add/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Teachers / Assign | `/dashboard/teachers/assign` | `admin/app/dashboard/teachers/assign/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | `/api/proxy/public/school-domain?subdomain=${encodeURIComponent(tenantSubdomain)}` |
| Teachers | `/dashboard/teachers` | `admin/app/dashboard/teachers/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Themes | `/dashboard/themes` | `admin/app/dashboard/themes/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Timetable | `/dashboard/timetable` | `admin/app/dashboard/timetable/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Transport | `/dashboard/transport` | `admin/app/dashboard/transport/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Users / :Id | `/dashboard/users/[id]` | `admin/app/dashboard/users/[id]/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Users | `/dashboard/users` | `admin/app/dashboard/users/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Login | `/login` | `admin/app/login/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | `/api/proxy/public/school-domain?subdomain=${encodeURIComponent(nextSchoolCode)}`<br>`/api/auth/forgot-password` |
| Page.Tsx | `/` | `admin/app/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Parent Attendance | `/parent/attendance` | `admin/app/parent/attendance/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Parent Dashboard | `/parent/dashboard` | `admin/app/parent/dashboard/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Parent Exams | `/parent/exams` | `admin/app/parent/exams/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Parent Fees | `/parent/fees` | `admin/app/parent/fees/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Parent Login | `/parent/login` | `admin/app/parent/login/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | `/api/auth/parent-otp/request`<br>`/api/auth/parent-otp/verify`<br>`/api/auth/login` |
| Parent Notices | `/parent/notices` | `admin/app/parent/notices/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Parent Profile | `/parent/profile` | `admin/app/parent/profile/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Parent Subjects | `/parent/subjects` | `admin/app/parent/subjects/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Parent Timetable | `/parent/timetable` | `admin/app/parent/timetable/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Reset Password | `/reset-password` | `admin/app/reset-password/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |
| Verify 2fa | `/verify-2fa` | `admin/app/verify-2fa/page.tsx` | Dashboard routes are gated by `DashboardClientLayout`; parent routes are under parent layout/login. | Service imports or static page; inspect page/service for details |

## Frontend Service API Usage

| Service File | Method | API Path | Source Line |
|---|---|---|---:|
| `admin/services/academic-setup.service.ts` | GET | `/academic-setup/classes` | 126 |
| `admin/services/academic-setup.service.ts` | POST | `/academic-setup/classes` | 131 |
| `admin/services/academic-setup.service.ts` | PATCH | `/academic-setup/classes/${id}` | 136 |
| `admin/services/academic-setup.service.ts` | DELETE | `/academic-setup/classes/${id}` | 141 |
| `admin/services/academic-setup.service.ts` | GET | `/academic-setup/sections` | 145 |
| `admin/services/academic-setup.service.ts` | POST | `/academic-setup/sections` | 150 |
| `admin/services/academic-setup.service.ts` | PATCH | `/academic-setup/sections/${id}` | 155 |
| `admin/services/academic-setup.service.ts` | DELETE | `/academic-setup/sections/${id}` | 160 |
| `admin/services/academic-setup.service.ts` | GET | `/academic-setup/subjects` | 164 |
| `admin/services/academic-setup.service.ts` | POST | `/academic-setup/subjects` | 169 |
| `admin/services/academic-setup.service.ts` | PATCH | `/academic-setup/subjects/${id}` | 174 |
| `admin/services/academic-setup.service.ts` | DELETE | `/academic-setup/subjects/${id}` | 179 |
| `admin/services/academic-setup.service.ts` | GET | `/academic-setup/rooms` | 183 |
| `admin/services/academic-setup.service.ts` | POST | `/academic-setup/rooms` | 188 |
| `admin/services/academic-setup.service.ts` | PATCH | `/academic-setup/rooms/${id}` | 193 |
| `admin/services/academic-setup.service.ts` | DELETE | `/academic-setup/rooms/${id}` | 198 |
| `admin/services/academic-setup.service.ts` | GET | `/academic-setup/time-periods` | 202 |
| `admin/services/academic-setup.service.ts` | POST | `/academic-setup/time-periods` | 207 |
| `admin/services/academic-setup.service.ts` | PATCH | `/academic-setup/time-periods/${id}` | 212 |
| `admin/services/academic-setup.service.ts` | DELETE | `/academic-setup/time-periods/${id}` | 217 |
| `admin/services/academic-setup.service.ts` | POST | `/academic-setup/time-periods/defaults` | 221 |
| `admin/services/academic-setup.service.ts` | GET | `/academic-setup/assign-subjects` | 226 |
| `admin/services/academic-setup.service.ts` | POST | `/academic-setup/assign-subjects` | 236 |
| `admin/services/academic-setup.service.ts` | DELETE | `/academic-setup/assign-subjects/${id}` | 241 |
| `admin/services/academic-setup.service.ts` | GET | `/academic-setup/class-teachers` | 245 |
| `admin/services/academic-setup.service.ts` | POST | `/academic-setup/class-teachers` | 250 |
| `admin/services/academic-setup.service.ts` | PATCH | `/academic-setup/class-teachers/${id}` | 255 |
| `admin/services/academic-setup.service.ts` | DELETE | `/academic-setup/class-teachers/${id}` | 260 |
| `admin/services/academic-setup.service.ts` | GET | `/academic-setup/routines` | 264 |
| `admin/services/academic-setup.service.ts` | POST | `/academic-setup/routines` | 277 |
| `admin/services/academic-setup.service.ts` | PATCH | `/academic-setup/routines/${id}` | 290 |
| `admin/services/academic-setup.service.ts` | DELETE | `/academic-setup/routines/${id}` | 295 |
| `admin/services/academic-setup.service.ts` | POST | `/academic-setup/routines/generate` | 305 |
| `admin/services/academic.service.ts` | GET | `/academics/academic-years` | 6 |
| `admin/services/academic.service.ts` | POST | `/academics/academic-years` | 11 |
| `admin/services/academic.service.ts` | PATCH | `/academics/academic-years/${id}` | 19 |
| `admin/services/academic.service.ts` | DELETE | `/academics/academic-years/${id}` | 24 |
| `admin/services/academic.service.ts` | GET | `/academics/classes` | 31 |
| `admin/services/academic.service.ts` | POST | `/academics/classes` | 36 |
| `admin/services/academic.service.ts` | DELETE | `/academics/classes/${id}` | 41 |
| `admin/services/academic.service.ts` | GET | `/academics/sections` | 48 |
| `admin/services/academic.service.ts` | POST | `/academics/sections` | 53 |
| `admin/services/academic.service.ts` | DELETE | `/academics/sections/${id}` | 58 |
| `admin/services/academic.service.ts` | GET | `/academics/subjects` | 65 |
| `admin/services/academic.service.ts` | POST | `/academics/subjects` | 76 |
| `admin/services/academic.service.ts` | DELETE | `/academics/subjects/${id}` | 81 |
| `admin/services/academic.service.ts` | GET | `/academics/exam-types` | 87 |
| `admin/services/academic.service.ts` | POST | `/academics/exam-types` | 97 |
| `admin/services/academic.service.ts` | PATCH | `/academics/exam-types/${id}` | 102 |
| `admin/services/academic.service.ts` | PUT | `/academics/attendance-mode` | 118 |
| `admin/services/academic.service.ts` | POST | `/academics/timetable/versions` | 160 |
| `admin/services/academic.service.ts` | GET | `/academics/timetable/versions` | 166 |
| `admin/services/academic.service.ts` | POST | `/academics/timetable/entries/bulk` | 185 |
| `admin/services/academic.service.ts` | GET | `/academics/timetable/entries` | 191 |
| `admin/services/academic.service.ts` | POST | `/academics/timetable/versions/${id}/publish` | 196 |
| `admin/services/academic.service.ts` | GET | `/academics/timetable/teacher` | 202 |
| `admin/services/academic.service.ts` | POST | `/academics/attendance-periods` | 254 |
| `admin/services/academic.service.ts` | DELETE | `/academics/attendance-periods/${id}` | 259 |
| `admin/services/adminDashboard.service.ts` | GET | `/admin/dashboard` | 217 |
| `admin/services/adminDashboard.service.ts` | GET | `/admin/dashboard/analytics/weekly` | 222 |
| `admin/services/adminDashboard.service.ts` | GET | `/admin/dashboard/performance` | 227 |
| `admin/services/adminDashboard.service.ts` | GET | `/admin/dashboard/activities` | 232 |
| `admin/services/adminDashboard.service.ts` | GET | `/admin/dashboard/system-status` | 237 |
| `admin/services/analytics.service.ts` | GET | `/analytics` | 11 |
| `admin/services/attendance.service.ts` | GET | `/attendance-summary` | 49 |
| `admin/services/attendance.service.ts` | GET | `/attendance/sessions` | 54 |
| `admin/services/attendance.service.ts` | POST | `/attendance-approval/sessions/${sessionId}/approve` | 59 |
| `admin/services/attendance.service.ts` | POST | `/attendance-approval/sessions/${sessionId}/reject` | 64 |
| `admin/services/attendanceP1.service.ts` | POST | `/attendance/sessions` | 30 |
| `admin/services/attendanceP1.service.ts` | PATCH | `/attendance/sessions/${id}` | 38 |
| `admin/services/attendanceP1.service.ts` | POST | `/attendance/sessions/${id}/lock` | 43 |
| `admin/services/attendanceP1.service.ts` | GET | `/attendance/summary` | 48 |
| `admin/services/attendanceP1.service.ts` | POST | `/attendance/teacher/self` | 62 |
| `admin/services/attendanceP1.service.ts` | GET | `/attendance/teacher/self` | 67 |
| `admin/services/attendanceP1.service.ts` | POST | `/leave/requests` | 72 |
| `admin/services/attendanceP1.service.ts` | GET | `/leave/requests` | 77 |
| `admin/services/attendanceP1.service.ts` | PATCH | `/leave/requests/${id}/approve` | 89 |
| `admin/services/attendanceP1.service.ts` | PATCH | `/leave/requests/${id}/reject` | 94 |
| `admin/services/attendanceSubstitution.service.ts` | GET | `/attendance/substitutions` | 35 |
| `admin/services/attendanceSubstitution.service.ts` | POST | `/attendance/substitutions` | 48 |
| `admin/services/attendanceSubstitution.service.ts` | PATCH | `/attendance/substitutions/${id}/cancel` | 53 |
| `admin/services/audit.service.ts` | GET | `/audit-logs` | 129 |
| `admin/services/audit.service.ts` | GET | `/admin/audit-exports/${id}/download` | 194 |
| `admin/services/auth-security.service.ts` | GET | `/features/auth-security` | 11 |
| `admin/services/auth-security.service.ts` | PUT | `/features/auth-security` | 16 |
| `admin/services/backup.service.ts` | GET | `/admin/backups` | 112 |
| `admin/services/backup.service.ts` | GET | `/admin/backups/${id}` | 117 |
| `admin/services/backup.service.ts` | POST | `/admin/backups` | 127 |
| `admin/services/backup.service.ts` | GET | `/admin/restores` | 132 |
| `admin/services/backup.service.ts` | GET | `/admin/restores/${id}` | 137 |
| `admin/services/backup.service.ts` | POST | `/admin/restores` | 147 |
| `admin/services/backup.service.ts` | POST | `/admin/restores/${id}/approve` | 152 |
| `admin/services/backup.service.ts` | POST | `/admin/restores/${id}/reject` | 157 |
| `admin/services/config.service.ts` | GET | `/features/flags` | 74 |
| `admin/services/config.service.ts` | POST | `/features/flags` | 79 |
| `admin/services/config.service.ts` | PATCH | `/features/flags/${id}` | 84 |
| `admin/services/config.service.ts` | DELETE | `/features/flags/${id}` | 89 |
| `admin/services/config.service.ts` | GET | `/features/configs` | 93 |
| `admin/services/config.service.ts` | POST | `/features/configs` | 98 |
| `admin/services/config.service.ts` | PATCH | `/features/configs/${id}` | 103 |
| `admin/services/consent.service.ts` | GET | `/consents/records` | 13 |
| `admin/services/dormitory.service.ts` | GET | `/dormitories` | 61 |
| `admin/services/dormitory.service.ts` | POST | `/dormitories` | 73 |
| `admin/services/dormitory.service.ts` | PATCH | `/dormitories/${id}` | 85 |
| `admin/services/dormitory.service.ts` | DELETE | `/dormitories/${id}` | 90 |
| `admin/services/dormitory.service.ts` | GET | `/dormitories/room-types` | 94 |
| `admin/services/dormitory.service.ts` | POST | `/dormitories/room-types` | 99 |
| `admin/services/dormitory.service.ts` | PATCH | `/dormitories/room-types/${id}` | 104 |
| `admin/services/dormitory.service.ts` | DELETE | `/dormitories/room-types/${id}` | 109 |
| `admin/services/dormitory.service.ts` | GET | `/dormitories/rooms` | 113 |
| `admin/services/dormitory.service.ts` | POST | `/dormitories/rooms` | 126 |
| `admin/services/dormitory.service.ts` | PATCH | `/dormitories/rooms/${id}` | 139 |
| `admin/services/dormitory.service.ts` | DELETE | `/dormitories/rooms/${id}` | 144 |
| `admin/services/dormitory.service.ts` | GET | `/dormitories/report` | 153 |
| `admin/services/fee-management.service.ts` | GET | `/fees/metadata` | 244 |
| `admin/services/fee-management.service.ts` | POST | `/fees/particulars` | 254 |
| `admin/services/fee-management.service.ts` | PATCH | `/fees/particulars/${id}` | 259 |
| `admin/services/fee-management.service.ts` | DELETE | `/fees/particulars/${id}` | 264 |
| `admin/services/fee-management.service.ts` | GET | `/fees/types` | 268 |
| `admin/services/fee-management.service.ts` | POST | `/fees/types` | 273 |
| `admin/services/fee-management.service.ts` | PATCH | `/fees/types/${id}` | 278 |
| `admin/services/fee-management.service.ts` | DELETE | `/fees/types/${id}` | 283 |
| `admin/services/fee-management.service.ts` | POST | `/fees/structures` | 301 |
| `admin/services/fee-management.service.ts` | PATCH | `/fees/structures/${id}` | 306 |
| `admin/services/fee-management.service.ts` | DELETE | `/fees/structures/${id}` | 311 |
| `admin/services/fee-management.service.ts` | POST | `/fees/structures/${id}/duplicate` | 315 |
| `admin/services/fee-management.service.ts` | GET | `/fees/assignments` | 320 |
| `admin/services/fee-management.service.ts` | POST | `/fees/assignments` | 332 |
| `admin/services/fee-management.service.ts` | POST | `/fees/payments` | 365 |
| `admin/services/fee-management.service.ts` | GET | `/fees/payments` | 370 |
| `admin/services/fee-management.service.ts` | GET | `/fees/ledger/${studentId}` | 375 |
| `admin/services/fee-management.service.ts` | GET | `/fees/discounts` | 380 |
| `admin/services/fee-management.service.ts` | POST | `/fees/discounts` | 398 |
| `admin/services/fee-management.service.ts` | GET | `/fees/fines` | 403 |
| `admin/services/fee-management.service.ts` | POST | `/fees/fines` | 415 |
| `admin/services/fee-management.service.ts` | GET | `/fees/reports` | 420 |
| `admin/services/homework.service.ts` | GET | `/homework` | 68 |
| `admin/services/homework.service.ts` | POST | `/homework` | 84 |
| `admin/services/homework.service.ts` | PATCH | `/homework/${id}` | 100 |
| `admin/services/homework.service.ts` | DELETE | `/homework/${id}` | 105 |
| `admin/services/homework.service.ts` | GET | `/homework/${id}/evaluations` | 109 |
| `admin/services/homework.service.ts` | POST | `/homework/${id}/evaluations` | 124 |
| `admin/services/homework.service.ts` | GET | `/homework/evaluation-report` | 129 |
| `admin/services/homework.service.ts` | POST | `/homework/attachments` | 136 |
| `admin/services/leave.service.ts` | GET | `/leave/types` | 76 |
| `admin/services/leave.service.ts` | POST | `/leave/types` | 81 |
| `admin/services/leave.service.ts` | PATCH | `/leave/types/${id}` | 86 |
| `admin/services/leave.service.ts` | DELETE | `/leave/types/${id}` | 91 |
| `admin/services/leave.service.ts` | GET | `/leave/defines` | 95 |
| `admin/services/leave.service.ts` | POST | `/leave/defines` | 100 |
| `admin/services/leave.service.ts` | PATCH | `/leave/defines/${id}` | 105 |
| `admin/services/leave.service.ts` | DELETE | `/leave/defines/${id}` | 110 |
| `admin/services/leave.service.ts` | GET | `/leave/balances/me` | 114 |
| `admin/services/leave.service.ts` | GET | `/leave/applications` | 119 |
| `admin/services/leave.service.ts` | GET | `/leave/applications/${id}` | 124 |
| `admin/services/leave.service.ts` | POST | `/leave/applications` | 143 |
| `admin/services/leave.service.ts` | PATCH | `/leave/applications/${id}` | 160 |
| `admin/services/leave.service.ts` | DELETE | `/leave/applications/${id}` | 167 |
| `admin/services/leave.service.ts` | PATCH | `/leave/applications/${id}/status` | 171 |
| `admin/services/library.service.ts` | GET | `/library/categories` | 70 |
| `admin/services/library.service.ts` | POST | `/library/categories` | 75 |
| `admin/services/library.service.ts` | PATCH | `/library/categories/${id}` | 80 |
| `admin/services/library.service.ts` | DELETE | `/library/categories/${id}` | 85 |
| `admin/services/library.service.ts` | GET | `/library/books` | 89 |
| `admin/services/library.service.ts` | POST | `/library/books` | 107 |
| `admin/services/library.service.ts` | PATCH | `/library/books/${id}` | 125 |
| `admin/services/library.service.ts` | DELETE | `/library/books/${id}` | 130 |
| `admin/services/library.service.ts` | GET | `/library/members` | 134 |
| `admin/services/library.service.ts` | POST | `/library/members` | 139 |
| `admin/services/library.service.ts` | DELETE | `/library/members/${id}` | 144 |
| `admin/services/library.service.ts` | GET | `/library/members/${memberId}/issues` | 149 |
| `admin/services/library.service.ts` | POST | `/library/members/${memberId}/issues` | 154 |
| `admin/services/library.service.ts` | PATCH | `/library/issues/${id}/return` | 159 |
| `admin/services/library.service.ts` | GET | `/library/issued` | 171 |
| `admin/services/login-experience.service.ts` | GET | `/features/login-experience` | 160 |
| `admin/services/login-experience.service.ts` | PUT | `/features/login-experience` | 165 |
| `admin/services/messaging.service.ts` | GET | `/admin/messaging-services` | 26 |
| `admin/services/messaging.service.ts` | PATCH | `/admin/messaging-services/${id}/status` | 31 |
| `admin/services/messaging.service.ts` | GET | `/admin/messaging-services/platform-email-config` | 36 |
| `admin/services/messaging.service.ts` | PUT | `/admin/messaging-services/platform-email-config` | 45 |
| `admin/services/messaging.service.ts` | PATCH | `/admin/messaging-services/platform-email-config/status` | 50 |
| `admin/services/messaging.service.ts` | GET | `/messaging-services/config` | 78 |
| `admin/services/messaging.service.ts` | GET | `/messaging-services/config` | 88 |
| `admin/services/messaging.service.ts` | PUT | `/messaging-services/config` | 101 |
| `admin/services/messaging.service.ts` | PATCH | `/messaging-services/config/status` | 110 |
| `admin/services/notificationSummary.service.ts` | GET | `/notifications/summary` | 12 |
| `admin/services/parent.service.ts` | GET | `/parents` | 23 |
| `admin/services/parent.service.ts` | GET | `/parents/${id}` | 28 |
| `admin/services/parentPortal.service.ts` | GET | `/parents/portal/children` | 30 |
| `admin/services/parentPortal.service.ts` | GET | `/parents/portal/profile` | 35 |
| `admin/services/parentPortal.service.ts` | GET | `/parents/portal/dashboard` | 40 |
| `admin/services/parentPortal.service.ts` | GET | `/parents/portal/exams` | 45 |
| `admin/services/parentPortal.service.ts` | GET | `/parents/portal/results` | 50 |
| `admin/services/parentPortal.service.ts` | GET | `/parents/portal/subjects` | 55 |
| `admin/services/parentPortal.service.ts` | GET | `/parents/portal/attendance` | 60 |
| `admin/services/parentPortal.service.ts` | GET | `/parents/portal/notices` | 65 |
| `admin/services/parentPortal.service.ts` | GET | `/parents/portal/timetable` | 70 |
| `admin/services/parentPortal.service.ts` | GET | `/parents/portal/fees` | 75 |
| `admin/services/report.service.ts` | GET | `/exams` | 23 |
| `admin/services/report.service.ts` | GET | `/exams/grading-settings` | 28 |
| `admin/services/report.service.ts` | PUT | `/exams/grading-settings` | 33 |
| `admin/services/report.service.ts` | GET | `/exams/${id}` | 38 |
| `admin/services/report.service.ts` | POST | `/exams` | 54 |
| `admin/services/report.service.ts` | POST | `/exams/marks/upload` | 63 |
| `admin/services/report.service.ts` | GET | `/exams/marks` | 72 |
| `admin/services/report.service.ts` | GET | `/reports/term` | 77 |
| `admin/services/report.service.ts` | GET | `/reports/annual` | 82 |
| `admin/services/report.service.ts` | GET | `/reports/rank` | 87 |
| `admin/services/school.service.ts` | GET | `/admin/schools` | 67 |
| `admin/services/school.service.ts` | POST | `/admin/schools` | 78 |
| `admin/services/school.service.ts` | PATCH | `/admin/schools/${id}` | 89 |
| `admin/services/school.service.ts` | POST | `/admin/schools/${id}/activate` | 94 |
| `admin/services/school.service.ts` | POST | `/admin/schools/${id}/suspend` | 99 |
| `admin/services/school.service.ts` | DELETE | `/admin/schools/${id}` | 104 |
| `admin/services/school.service.ts` | POST | `/admin/schools/${id}/restore` | 109 |
| `admin/services/school.service.ts` | GET | `/admin/schools/${schoolId}/admins` | 129 |
| `admin/services/staff.service.ts` | GET | `/staff/departments` | 156 |
| `admin/services/staff.service.ts` | POST | `/staff/departments` | 161 |
| `admin/services/staff.service.ts` | GET | `/staff/designations` | 166 |
| `admin/services/staff.service.ts` | POST | `/staff/designations` | 171 |
| `admin/services/staff.service.ts` | GET | `/staff` | 181 |
| `admin/services/staff.service.ts` | POST | `/staff` | 186 |
| `admin/services/staff.service.ts` | GET | `/staff/${id}` | 191 |
| `admin/services/staff.service.ts` | PATCH | `/staff/${id}` | 196 |
| `admin/services/staff.service.ts` | DELETE | `/staff/${id}` | 201 |
| `admin/services/staff.service.ts` | POST | `/uploads/photos?category=staff` | 208 |
| `admin/services/staff.service.ts` | POST | `/staff/${staffId}/documents` | 218 |
| `admin/services/staff.service.ts` | DELETE | `/staff/${staffId}/documents/${documentId}` | 225 |
| `admin/services/staff.service.ts` | POST | `/staff/${staffId}/timeline` | 229 |
| `admin/services/staff.service.ts` | DELETE | `/staff/${staffId}/timeline/${timelineId}` | 234 |
| `admin/services/staff.service.ts` | GET | `/staff/attendance` | 238 |
| `admin/services/staff.service.ts` | POST | `/staff/attendance` | 243 |
| `admin/services/staff.service.ts` | GET | `/staff/attendance/report` | 248 |
| `admin/services/staff.service.ts` | POST | `/staff/payroll/generate` | 267 |
| `admin/services/staff.service.ts` | POST | `/staff/payroll/${id}/pay` | 272 |
| `admin/services/student-operations.service.ts` | GET | `/students/groups` | 64 |
| `admin/services/student-operations.service.ts` | POST | `/students/groups` | 69 |
| `admin/services/student-operations.service.ts` | PATCH | `/students/groups/${id}` | 74 |
| `admin/services/student-operations.service.ts` | DELETE | `/students/groups/${id}` | 79 |
| `admin/services/student-operations.service.ts` | GET | `/students/categories` | 83 |
| `admin/services/student-operations.service.ts` | POST | `/students/categories` | 88 |
| `admin/services/student-operations.service.ts` | PATCH | `/students/categories/${id}` | 93 |
| `admin/services/student-operations.service.ts` | DELETE | `/students/categories/${id}` | 98 |
| `admin/services/student-operations.service.ts` | GET | `/students/attendance` | 107 |
| `admin/services/student-operations.service.ts` | POST | `/students/attendance` | 120 |
| `admin/services/student-operations.service.ts` | GET | `/students/attendance/report` | 131 |
| `admin/services/student-operations.service.ts` | GET | `/students/promotions/preview` | 140 |
| `admin/services/student-operations.service.ts` | POST | `/students/promotions` | 154 |
| `admin/services/student-operations.service.ts` | GET | `/students/disabled` | 159 |
| `admin/services/student-operations.service.ts` | POST | `/students/students/${id}/disable` | 164 |
| `admin/services/student-operations.service.ts` | POST | `/students/disabled/${id}/restore` | 169 |
| `admin/services/student-operations.service.ts` | DELETE | `/students/disabled/${id}` | 174 |
| `admin/services/student.service.ts` | GET | `/students/students` | 145 |
| `admin/services/student.service.ts` | GET | `/students/students/${id}` | 150 |
| `admin/services/student.service.ts` | POST | `/students/students` | 204 |
| `admin/services/student.service.ts` | PATCH | `/students/students/${id}` | 261 |
| `admin/services/student.service.ts` | GET | `/students/students/import/sample` | 266 |
| `admin/services/student.service.ts` | POST | `/students/students/import` | 281 |
| `admin/services/student.service.ts` | DELETE | `/students/students/${id}` | 294 |
| `admin/services/student.service.ts` | POST | `/uploads/photos` | 301 |
| `admin/services/student.service.ts` | POST | `/uploads/documents` | 315 |
| `admin/services/student.service.ts` | POST | `/students/students/${studentId}/documents` | 330 |
| `admin/services/student.service.ts` | DELETE | `/students/students/${studentId}/documents/${documentId}` | 335 |
| `admin/services/student.service.ts` | POST | `/students/students/${studentId}/timeline` | 342 |
| `admin/services/student.service.ts` | DELETE | `/students/students/${studentId}/timeline/${timelineId}` | 347 |
| `admin/services/student.service.ts` | POST | `/students/students/${studentId}/photos` | 367 |
| `admin/services/student.service.ts` | DELETE | `/students/students/${studentId}/photos/${photoId}` | 372 |
| `admin/services/student.service.ts` | POST | `/students/students/${studentId}/parents` | 376 |
| `admin/services/student.service.ts` | POST | `/students/students/${studentId}/status` | 381 |
| `admin/services/student.service.ts` | GET | `/students/parents` | 388 |
| `admin/services/student.service.ts` | GET | `/students/parents/lookup` | 393 |
| `admin/services/student.service.ts` | GET | `/students/parents/${id}` | 398 |
| `admin/services/student.service.ts` | POST | `/students/parents` | 412 |
| `admin/services/student.service.ts` | GET | `/students/transfer-targets` | 418 |
| `admin/services/student.service.ts` | POST | `/students/students/${studentId}/transfer-requests` | 423 |
| `admin/services/student.service.ts` | GET | `/students/transfer-requests` | 429 |
| `admin/services/student.service.ts` | POST | `/students/transfer-requests/${requestId}/accept` | 434 |
| `admin/services/student.service.ts` | POST | `/students/transfer-requests/${requestId}/reject` | 439 |
| `admin/services/subscription.service.ts` | GET | `/subscriptions` | 215 |
| `admin/services/subscription.service.ts` | GET | `/admin/subscription-plans` | 365 |
| `admin/services/subscription.service.ts` | GET | `/subscriptions/plans` | 370 |
| `admin/services/subscription.service.ts` | POST | `/admin/subscription-plans` | 382 |
| `admin/services/subscription.service.ts` | PATCH | `/admin/subscription-plans/${id}` | 397 |
| `admin/services/subscription.service.ts` | DELETE | `/admin/subscription-plans/${id}` | 402 |
| `admin/services/subscription.service.ts` | PUT | `/admin/subscription-plans/${planId}/permissions` | 421 |
| `admin/services/subscription.service.ts` | GET | `/admin/subscription-metrics/${schoolId}` | 428 |
| `admin/services/subscription.service.ts` | POST | `/subscriptions` | 447 |
| `admin/services/support.service.ts` | GET | `${basePath(options?.admin)}/${id}` | 70 |
| `admin/services/support.service.ts` | POST | `/tickets` | 80 |
| `admin/services/support.service.ts` | PATCH | `${basePath(options?.admin)}/${id}` | 94 |
| `admin/services/support.service.ts` | PATCH | `${basePath(options?.admin)}/${id}/status` | 99 |
| `admin/services/support.service.ts` | PATCH | `${basePath(options?.admin)}/${id}/priority` | 108 |
| `admin/services/support.service.ts` | PATCH | `/admin/support/${id}/assign` | 113 |
| `admin/services/support.service.ts` | POST | `${basePath(options?.admin)}/${id}/comments` | 122 |
| `admin/services/support.service.ts` | GET | `/admin/support/assignable-users` | 127 |
| `admin/services/system-settings.service.ts` | GET | `/system-settings/school` | 113 |
| `admin/services/system-settings.service.ts` | PUT | `/system-settings/school` | 118 |
| `admin/services/teacher.service.ts` | GET | `/teachers` | 38 |
| `admin/services/teacher.service.ts` | GET | `/teachers/${id}` | 43 |
| `admin/services/teacher.service.ts` | POST | `/teachers` | 66 |
| `admin/services/teacher.service.ts` | PATCH | `/teachers/${id}` | 92 |
| `admin/services/teacher.service.ts` | DELETE | `/teachers/${id}` | 97 |
| `admin/services/teacher.service.ts` | PATCH | `/teacher-assignments/teachers/${teacherId}/status` | 102 |
| `admin/services/teacher.service.ts` | POST | `/teacher-assignments/classes/assign` | 107 |
| `admin/services/teacher.service.ts` | POST | `/teacher-assignments/classes/unassign` | 112 |
| `admin/services/teacher.service.ts` | POST | `/teacher-assignments/subjects/assign` | 117 |
| `admin/services/teacher.service.ts` | POST | `/teacher-assignments/subjects/unassign` | 122 |
| `admin/services/theme.service.ts` | GET | `/themes` | 14 |
| `admin/services/theme.service.ts` | POST | `/themes` | 19 |
| `admin/services/theme.service.ts` | PATCH | `/themes/${id}` | 24 |
| `admin/services/theme.service.ts` | POST | `/themes/${id}/publish` | 29 |
| `admin/services/theme.service.ts` | POST | `/themes/${id}/rollback` | 35 |
| `admin/services/theme.service.ts` | GET | `/themes/active` | 40 |
| `admin/services/transport.service.ts` | GET | `/transport/routes` | 64 |
| `admin/services/transport.service.ts` | POST | `/transport/routes` | 69 |
| `admin/services/transport.service.ts` | PATCH | `/transport/routes/${id}` | 74 |
| `admin/services/transport.service.ts` | DELETE | `/transport/routes/${id}` | 79 |
| `admin/services/transport.service.ts` | GET | `/transport/vehicles` | 83 |
| `admin/services/transport.service.ts` | POST | `/transport/vehicles` | 97 |
| `admin/services/transport.service.ts` | PATCH | `/transport/vehicles/${id}` | 111 |
| `admin/services/transport.service.ts` | DELETE | `/transport/vehicles/${id}` | 116 |
| `admin/services/transport.service.ts` | GET | `/transport/assignments` | 120 |
| `admin/services/transport.service.ts` | POST | `/transport/assignments` | 125 |
| `admin/services/transport.service.ts` | PATCH | `/transport/assignments/${id}` | 130 |
| `admin/services/transport.service.ts` | DELETE | `/transport/assignments/${id}` | 135 |
| `admin/services/transport.service.ts` | GET | `/transport/report` | 145 |
| `admin/services/user.service.ts` | GET | `/users/${id}` | 16 |
| `admin/services/user.service.ts` | GET | `/users/employee-permissions` | 83 |
| `admin/services/user.service.ts` | PUT | `/users/employee-permissions` | 95 |

## Common Screen Behavior

- Authenticated dashboard pages are wrapped by `admin/app/dashboard/layout.tsx`, which passes server-decoded role/email into `DashboardClientLayout`.
- API calls use `admin/lib/api.ts`, which proxies through `/api/proxy`, sends credentials, refreshes on 401, redirects payment-restricted users to `/dashboard/plans`, and surfaces suspended/account-plan restrictions.
- Sidebar menu visibility is role and permission-code driven in `admin/components/Sidebar.tsx`.
