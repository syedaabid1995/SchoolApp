# Document 8 - User Journey Documentation

Generated from repository code on 2026-06-04. Source root: `/Users/syedaabidahamedarshad/Documents/TechStageIT/SchoolApp`.

## Super Admin Journey

Login -> Dashboard/Analytics -> Schools -> School Admins -> Subscriptions/Plans -> Users -> Support -> Audit Logs -> System Health/Backups/Compliance -> Settings.

## School Admin Journey

Login -> Dashboard -> Institution/System Setup -> Academic Setup/Timetable -> Students -> Attendance -> Staff/Teachers -> Fees/Payroll -> Operations (Dormitory, Transport, Homework, Library) -> Reports -> Support/Audit/Plans/Settings.

## Teacher Journey

Login -> Dashboard -> permitted academic/timetable views -> Attendance sessions/self attendance -> Homework/marks/leave where permission codes allow -> Change Password.

## Accountant Journey

Login -> Dashboard -> Fees -> Payroll/report where permission codes allow -> Reports -> Change Password.

## Librarian Journey

Login -> Dashboard -> Library where permission codes allow -> Student/operations read access where configured -> Change Password.

## Staff Journey

Login -> Dashboard -> My Leave -> permitted staff/attendance modules -> Change Password.

## Parent Journey

Parent Login -> Parent Dashboard -> Profile -> Attendance -> Subjects -> Timetable -> Exams -> Fees -> Notices. Parent pages are present under `admin/app/parent/*`.

## Journey Enforcement

- Dashboard journeys are constrained by `DashboardClientLayout` route gates and `Sidebar` item filtering.
- Backend journeys require JWT auth and route/module guards.
- Parent access is additionally validated through linked `ParentProfile` and `StudentParent` records in auth middleware.
