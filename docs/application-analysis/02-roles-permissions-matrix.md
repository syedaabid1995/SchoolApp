# Document 2 - User Roles & Permissions Matrix

Generated from repository code on 2026-06-04. Source root: `/Users/syedaabidahamedarshad/Documents/TechStageIT/SchoolApp`.

## Roles Identified

Roles are declared in `RoleName` in `backend/prisma/schema.prisma` and mirrored in `admin/utils/roles.ts`: `SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`, `ACCOUNTANT`, `LIBRARIAN`, `STAFF`, `PARENT`.

## Enforcement Points

| Enforcement | Behavior | Source |
|---|---|---|
| JWT authentication | Requires Bearer access token with `typ: access`, blocks suspended schools and inactive teachers/parents | `backend/src/middlewares/auth.middleware.ts` |
| Role middleware | `requireRole`, `requireSuperAdmin`, `requirePermission`, tenant scope | `backend/src/middlewares/rbac.middleware.ts` |
| Super admin guard | Dedicated guard on platform admin routes | `backend/src/middlewares/superAdminGuard.middleware.ts` |
| Plan permission gate | Maps API paths/methods to permission codes for employee-managed roles | `backend/src/middlewares/auth.middleware.ts` |
| Frontend route gate | Redirects blocked employees/super admins based on route and permission codes | `admin/components/DashboardClientLayout.tsx` |
| Menu visibility | Filters sidebar items by role and permission codes | `admin/components/Sidebar.tsx` |

## Permission Catalog Matrix

| Module | Permission Code | View | Create | Edit | Delete | Approve | Export | Menu Path |
|---|---|---:|---:|---:|---:|---:|---:|---|
| Overview | `dashboard.overview` Overview | Y |  |  |  |  |  | `/dashboard` |
| Overview | `dashboard.overview` Reports | Y |  |  |  |  |  | `/dashboard/reports` |
| Plans | `plans.view` Plans | Y |  |  |  |  |  | `/dashboard/plans` |
| Utilities | `settings.access` Institution & System Settings | Y |  | Y |  |  |  | `/dashboard/settings` |
| Employees | `teachers.list` Employees - List | Y |  |  |  |  |  | `/dashboard/teachers` |
| Employees | `teachers.add` Employees - Add |  | Y |  |  |  |  | `/dashboard/teachers/add` |
| Employees | `staff.view` Staff Directory - View | Y |  |  |  |  |  | `/dashboard/staff` |
| Employees | `staff.create` Staff Directory - Create |  | Y |  |  |  |  | `/dashboard/staff/add` |
| Employees | `staff.edit` Staff Directory - Edit |  |  | Y |  |  |  | `/dashboard/staff` |
| Employees | `staff.delete` Staff Directory - Delete |  |  |  | Y |  |  | `/dashboard/staff` |
| Employees | `staff.document.view` Staff Documents - View | Y |  |  |  |  |  | `/dashboard/staff` |
| Employees | `staff.document.create` Staff Documents - Create |  | Y |  |  |  |  | `/dashboard/staff` |
| Employees | `staff.document.delete` Staff Documents - Delete |  |  |  | Y |  |  | `/dashboard/staff` |
| Employees | `staff.timeline.view` Staff Timeline - View | Y |  |  |  |  |  | `/dashboard/staff` |
| Employees | `staff.timeline.create` Staff Timeline - Create |  | Y |  |  |  |  | `/dashboard/staff` |
| Employees | `staff.timeline.delete` Staff Timeline - Delete |  |  |  | Y |  |  | `/dashboard/staff` |
| Attendance | `attendance.substitute.manage` Attendance Substitutions |  |  |  |  |  |  | `/dashboard/teachers/assign` |
| Academics | `academics.setup` Academic Setup |  |  |  |  |  |  | `/dashboard/academics` |
| Academics | `academic.class.view` Academic Classes - View | Y |  |  |  |  |  | `/dashboard/academics` |
| Academics | `academic.class.create` Academic Classes - Create |  | Y |  |  |  |  | `/dashboard/academics` |
| Academics | `academic.class.edit` Academic Classes - Edit |  |  | Y |  |  |  | `/dashboard/academics` |
| Academics | `academic.class.delete` Academic Classes - Delete |  |  |  | Y |  |  | `/dashboard/academics` |
| Academics | `academic.section.view` Academic Sections - View | Y |  |  |  |  |  | `/dashboard/academics` |
| Academics | `academic.section.create` Academic Sections - Create |  | Y |  |  |  |  | `/dashboard/academics` |
| Academics | `academic.section.edit` Academic Sections - Edit |  |  | Y |  |  |  | `/dashboard/academics` |
| Academics | `academic.section.delete` Academic Sections - Delete |  |  |  | Y |  |  | `/dashboard/academics` |
| Academics | `academic.subject.view` Academic Subjects - View | Y |  |  |  |  |  | `/dashboard/academics` |
| Academics | `academic.subject.create` Academic Subjects - Create |  | Y |  |  |  |  | `/dashboard/academics` |
| Academics | `academic.subject.edit` Academic Subjects - Edit |  |  | Y |  |  |  | `/dashboard/academics` |
| Academics | `academic.subject.delete` Academic Subjects - Delete |  |  |  | Y |  |  | `/dashboard/academics` |
| Academics | `academic.room.view` Timetable Rooms - View | Y |  |  |  |  |  | `/dashboard/timetable` |
| Academics | `academic.room.create` Timetable Rooms - Create |  | Y |  |  |  |  | `/dashboard/timetable` |
| Academics | `academic.room.edit` Timetable Rooms - Edit |  |  | Y |  |  |  | `/dashboard/timetable` |
| Academics | `academic.room.delete` Timetable Rooms - Delete |  |  |  | Y |  |  | `/dashboard/timetable` |
| Academics | `academic.time.view` Timetable Periods - View | Y |  |  |  |  |  | `/dashboard/timetable` |
| Academics | `academic.time.create` Timetable Periods - Create |  | Y |  |  |  |  | `/dashboard/timetable` |
| Academics | `academic.time.edit` Timetable Periods - Edit |  |  | Y |  |  |  | `/dashboard/timetable` |
| Academics | `academic.time.delete` Timetable Periods - Delete |  |  |  | Y |  |  | `/dashboard/timetable` |
| Academics | `academic.assign_subject.view` Assign Subjects - View | Y |  |  |  |  |  | `/dashboard/academics` |
| Academics | `academic.assign_subject.create` Assign Subjects - Create |  | Y |  |  |  |  | `/dashboard/academics` |
| Academics | `academic.assign_subject.edit` Assign Subjects - Edit |  |  | Y |  |  |  | `/dashboard/academics` |
| Academics | `academic.assign_subject.delete` Assign Subjects - Delete |  |  |  | Y |  |  | `/dashboard/academics` |
| Academics | `academic.class_teacher.view` Class Teachers - View | Y |  |  |  |  |  | `/dashboard/academics` |
| Academics | `academic.class_teacher.create` Class Teachers - Create |  | Y |  |  |  |  | `/dashboard/academics` |
| Academics | `academic.class_teacher.edit` Class Teachers - Edit |  |  | Y |  |  |  | `/dashboard/academics` |
| Academics | `academic.class_teacher.delete` Class Teachers - Delete |  |  |  | Y |  |  | `/dashboard/academics` |
| Academics | `academic.routine.view` Timetable Routine - View | Y |  |  |  |  |  | `/dashboard/timetable` |
| Academics | `academic.routine.create` Timetable Routine - Create |  | Y |  |  |  |  | `/dashboard/timetable` |
| Academics | `academic.routine.edit` Timetable Routine - Edit |  |  | Y |  |  |  | `/dashboard/timetable` |
| Academics | `academic.routine.delete` Timetable Routine - Delete |  |  |  | Y |  |  | `/dashboard/timetable` |
| Academics | `academics.exams` Exams |  |  |  |  |  |  | `/dashboard/academics/exams` |
| Academics | `academics.marks` Upload Marks |  |  |  |  |  |  | `/dashboard/academics/marks` |
| Students | `students.list` Students - List | Y |  |  |  |  |  | `/dashboard/students` |
| Students | `students.add` Students - Add |  | Y |  |  |  |  | `/dashboard/students/add` |
| Students | `student.view` Student Information - View | Y |  |  |  |  |  | `/dashboard/students` |
| Students | `student.create` Student Information - Create |  | Y |  |  |  |  | `/dashboard/students/add` |
| Students | `student.edit` Student Information - Edit |  |  | Y |  |  |  | `/dashboard/students` |
| Students | `student.delete` Student Information - Delete |  |  |  | Y |  |  | `/dashboard/students` |
| Students | `student.import` Student Information - Import |  | Y |  |  |  |  | `/dashboard/students` |
| Students | `student.document.view` Student Documents - View | Y |  |  |  |  |  | `/dashboard/students` |
| Students | `student.document.create` Student Documents - Create |  | Y |  |  |  |  | `/dashboard/students` |
| Students | `student.document.delete` Student Documents - Delete |  |  |  | Y |  |  | `/dashboard/students` |
| Students | `student.timeline.view` Student Timeline - View | Y |  |  |  |  |  | `/dashboard/students` |
| Students | `student.timeline.create` Student Timeline - Create |  | Y |  |  |  |  | `/dashboard/students` |
| Students | `student.timeline.delete` Student Timeline - Delete |  |  |  | Y |  |  | `/dashboard/students` |
| Attendance | `attendance.view` Student Attendance - View | Y |  |  |  |  |  | `/dashboard/students/attendance` |
| Attendance | `attendance.create` Student Attendance - Create |  | Y |  |  |  |  | `/dashboard/students/attendance` |
| Attendance | `attendance.edit` Student Attendance - Edit |  |  | Y |  |  |  | `/dashboard/students/attendance` |
| Attendance | `attendance.report` Student Attendance - Report | Y |  |  |  |  | Y | `/dashboard/students/attendance` |
| Attendance | `staff.attendance.view` Staff Attendance - View | Y |  |  |  |  |  | `/dashboard/staff/attendance` |
| Attendance | `staff.attendance.create` Staff Attendance - Create |  | Y |  |  |  |  | `/dashboard/staff/attendance` |
| Attendance | `staff.attendance.edit` Staff Attendance - Edit |  |  | Y |  |  |  | `/dashboard/staff/attendance` |
| Attendance | `staff.attendance.report` Staff Attendance - Report | Y |  |  |  |  | Y | `/dashboard/staff/attendance` |
| Attendance | `leave.type.view` Leave Types - View | Y |  |  |  |  |  | `/dashboard/leave/requests` |
| Attendance | `leave.type.create` Leave Types - Create |  | Y |  |  |  |  | `/dashboard/leave/requests` |
| Attendance | `leave.type.edit` Leave Types - Edit |  |  | Y |  |  |  | `/dashboard/leave/requests` |
| Attendance | `leave.type.delete` Leave Types - Delete |  |  |  | Y |  |  | `/dashboard/leave/requests` |
| Attendance | `leave.define.view` Leave Define - View | Y |  |  |  |  |  | `/dashboard/leave/requests` |
| Attendance | `leave.define.create` Leave Define - Create |  | Y |  |  |  |  | `/dashboard/leave/requests` |
| Attendance | `leave.define.edit` Leave Define - Edit |  |  | Y |  |  |  | `/dashboard/leave/requests` |
| Attendance | `leave.define.delete` Leave Define - Delete |  |  |  | Y |  |  | `/dashboard/leave/requests` |
| Attendance | `leave.apply.view` Apply Leave - View | Y |  |  |  |  |  | `/dashboard/leave/my` |
| Attendance | `leave.apply.create` Apply Leave - Create |  | Y |  |  |  |  | `/dashboard/leave/my` |
| Attendance | `leave.apply.edit` Apply Leave - Edit |  |  | Y |  |  |  | `/dashboard/leave/my` |
| Attendance | `leave.apply.delete` Apply Leave - Delete |  |  |  | Y |  |  | `/dashboard/leave/my` |
| Attendance | `leave.approve.view` Leave Approval - View | Y |  | Y |  | Y |  | `/dashboard/leave/requests` |
| Attendance | `leave.approve.edit` Leave Approval - Edit |  |  | Y |  | Y |  | `/dashboard/leave/requests` |
| Attendance | `leave.approve.delete` Leave Approval - Delete |  |  | Y | Y | Y |  | `/dashboard/leave/requests` |
| Attendance | `leave.balance.view` Leave Balance - View | Y |  |  |  |  |  | `/dashboard/leave/my` |
| Fees | `fees.view` Fees - View | Y |  |  |  |  |  | `/dashboard/fees` |
| Fees | `fees.create` Fees - Create |  | Y |  |  |  |  | `/dashboard/fees` |
| Fees | `fees.edit` Fees - Edit |  |  | Y |  |  |  | `/dashboard/fees` |
| Fees | `fees.delete` Fees - Delete |  |  |  | Y |  |  | `/dashboard/fees` |
| Fees | `fees.collect` Fees - Collect Payment |  | Y |  |  |  |  | `/dashboard/fees` |
| Fees | `fees.report` Fees - Reports | Y |  |  |  |  | Y | `/dashboard/fees` |
| Payroll | `payroll.view` Payroll - View | Y |  | Y |  |  |  | `/dashboard/payroll` |
| Payroll | `payroll.generate` Payroll - Generate |  | Y | Y |  |  |  | `/dashboard/payroll` |
| Payroll | `payroll.pay` Payroll - Pay |  |  | Y |  |  |  | `/dashboard/payroll` |
| Payroll | `payroll.report` Payroll Report | Y |  | Y |  |  | Y | `/dashboard/payroll/report` |
| Students | `student.group.view` Student Groups - View | Y |  |  |  |  |  | `/dashboard/students/groups` |
| Students | `student.group.create` Student Groups - Create |  | Y |  |  |  |  | `/dashboard/students/groups` |
| Students | `student.group.edit` Student Groups - Edit |  |  | Y |  |  |  | `/dashboard/students/groups` |
| Students | `student.group.delete` Student Groups - Delete |  |  |  | Y |  |  | `/dashboard/students/groups` |
| Students | `student.category.view` Student Categories - View | Y |  |  |  |  |  | `/dashboard/students/groups` |
| Students | `student.category.create` Student Categories - Create |  | Y |  |  |  |  | `/dashboard/students/groups` |
| Students | `student.category.edit` Student Categories - Edit |  |  | Y |  |  |  | `/dashboard/students/groups` |
| Students | `student.category.delete` Student Categories - Delete |  |  |  | Y |  |  | `/dashboard/students/groups` |
| Students | `student.promote.view` Student Promotion - View | Y |  |  |  |  |  | `/dashboard/students/promotion` |
| Students | `student.promote.create` Student Promotion - Create |  | Y |  |  |  |  | `/dashboard/students/promotion` |
| Students | `student.disabled.view` Disabled Students - View | Y |  |  |  |  |  | `/dashboard/students/disabled` |
| Students | `student.disabled.edit` Disabled Students - Edit |  |  | Y |  |  |  | `/dashboard/students/disabled` |
| Students | `student.disabled.delete` Disabled Students - Delete |  |  |  | Y |  |  | `/dashboard/students/disabled` |
| Students | `student.disabled.restore` Disabled Students - Restore |  |  | Y |  |  |  | `/dashboard/students/disabled` |
| Utilities | `idcards.view` ID Cards | Y |  |  |  |  |  | `/dashboard/id-cards` |
| Attendance | `attendance.view` Attendance | Y |  |  |  |  |  | `/dashboard/attendance` |
| Support | `support.view` Support | Y |  |  |  |  |  | `/dashboard/support` |
| Audit | `audit.view` Audit Logs | Y |  |  |  |  | Y | `/dashboard/audit` |

## Role-Level Access Summary

| Role | Backend Access Pattern | Frontend Menu Pattern |
|---|---|---|
| `SUPER_ADMIN` | Bypasses `requireRole` role checks; guarded admin routes use `superAdminGuard`. | Platform sections: dashboard, analytics, reports, schools, users, subscriptions, school modules, support, audit/logs, system health, settings. |
| `SCHOOL_ADMIN` | School-scoped admin routes; many module routers explicitly require school admin. | Full school workspace, setup, academics, students, employees, fees, payroll, operations, support, audit, plans, settings. |
| `TEACHER` | Auth middleware checks active teacher profile; module access is permission-code driven; attendance routes allow teacher on selected session/self endpoints. | Filtered by employee permission codes. |
| `ACCOUNTANT` | Authenticated employee role; fees/payroll access depends on permission codes. | Filtered by employee permission codes. |
| `LIBRARIAN` | Authenticated employee role; library access depends on permission codes. | Filtered by employee permission codes. |
| `STAFF` | Authenticated employee role; leave/staff access depends on permission codes. | Filtered by employee permission codes. |
| `PARENT` | Parent profile and active linked school are checked by auth middleware; parent portal routes handle child-linked data. | Parent portal pages under `/parent/*`. |
