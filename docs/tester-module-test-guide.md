# Tester Module Test Guide

Date: 2026-06-05  
Audience: single QA tester  
Goal: quickly verify the production-ready modules with focused manual checks.

## Before Testing

Use at least two schools:

- School A
- School B

Use these roles:

- Super Admin
- School Admin
- Teacher
- Parent

For every module, always check:

- School Admin A cannot see or edit School B data.
- Unauthorized users get blocked.
- No password, OTP, token, or secret appears in API responses or UI.
- Create/update/delete actions show clear success or error messages.

## 1. Login, MFA, Parent OTP

Test:

- Super Admin login works.
- School Admin login works for the correct school only.
- Wrong password shows a generic error.
- MFA/2FA works: correct code passes, wrong/expired code fails.
- Logout removes the session.
- Parent OTP login works.
- Parent sees only linked children.
- OTP code is not shown in production responses.

Pass if:

- Users only access their allowed dashboards.
- Parent cannot see another parent/student.
- Tokens/OTP are not visible in UI or JSON.

## 2. School Onboarding

Pages:

- `/dashboard/onboarding`
- `/dashboard/onboarding/checklist`
- `/dashboard/schools/[id]/onboarding`

Test:

- Checklist loads for a school.
- Readiness recalculates after setup data is added.
- School Admin can view/manage their own onboarding only.
- School Admin cannot approve go-live.
- Super Admin can review, block, approve, and override go-live.
- Override requires a reason.

Pass if:

- Status changes correctly.
- Cross-school access is blocked.
- Audit log is created for review/go-live/block actions.

## 3. Teacher Onboarding

Pages:

- `/dashboard/teachers/onboarding`
- `/dashboard/teachers/[id]/onboarding`
- `/dashboard/teachers/[id]/credentials`
- `/dashboard/teachers/[id]/readiness`

Test:

- Teacher readiness page loads.
- Account/profile/class/subject/timetable readiness flags are correct.
- Credential resend works.
- Manual credential share requires a note.
- Teacher cannot be marked ready if required setup is missing.

Pass if:

- Readiness matches actual teacher setup.
- School Admin cannot manage another school's teacher.
- Credential actions are audited.

## 4. Students and Parents

Pages:

- `/dashboard/students`
- `/dashboard/students/add`
- `/dashboard/parents`
- Parent portal pages

Test:

- Create and edit a student.
- Assign class and section.
- Link parent to student.
- Disable and restore a student.
- Parent logs in and sees only linked child data.

Pass if:

- Student lifecycle works.
- Parent access is limited to linked children.
- No sensitive user fields are shown.

## 5. Attendance and Timetable

Pages:

- `/dashboard/attendance`
- `/dashboard/attendance/students/mark`
- `/dashboard/academics/timetable`

Test:

- Mark student attendance.
- Edit attendance if allowed.
- Try attendance for wrong school/class and confirm it is blocked.
- Create/view timetable.
- Teacher/parent timetable visibility is correct.

Pass if:

- Attendance saves correctly.
- Cross-school attendance access is blocked.
- Timetable displays the correct class/teacher data.

## 6. Exams and Rank Cards

Pages:

- `/dashboard/academics/exams`
- `/dashboard/academics/marks`

Test:

- Create exam and papers.
- Upload marks.
- Generate/download rank card PDF.
- Verify total, percentage, result, grade, class rank, and section rank.

Pass if:

- Marks are reflected correctly.
- Rank card PDF downloads and contains correct student/exam data.

## 7. Exam Operations

Pages:

- `/dashboard/academics/exams/centers`
- `/dashboard/academics/exams/rooms`
- `/dashboard/academics/exams/seating`
- `/dashboard/academics/exams/invigilators`
- `/dashboard/academics/exams/hall-tickets`

Test:

- Create exam center.
- Create room with valid capacity.
- Try invalid room capacity and confirm validation error.
- Generate seating.
- Try seating with insufficient capacity and confirm it fails.
- Regenerate seating only after confirmation/force.
- Assign invigilator.
- Try assigning same invigilator or same room twice and confirm conflict.
- Download hall ticket PDF.

Pass if:

- Seat numbers are unique.
- Hall ticket includes school, exam, student, center, room, and seat.
- Cross-school exam data is blocked.

## 8. Reports and Export Center

Pages:

- `/dashboard/reports`
- `/dashboard/reports/[reportKey]`

Test these reports first:

- Student list
- Parent links
- Student attendance daily/monthly
- Exam results
- Subject marks
- Staff list
- Teacher onboarding
- Timetable
- Library issued books
- Transport assignments
- Dormitory assignments
- Fees summary
- Payroll summary

For each report:

- Open report.
- Apply filters.
- Check table data.
- Export CSV.
- Export PDF.
- Try another school's data.
- Try export without permission.

Pass if:

- Filters work.
- CSV/PDF downloads work.
- Report permissions are enforced.
- Export audit log is created.

## 9. Compliance

Pages:

- `/dashboard/compliance`
- `/dashboard/compliance/exports/[id]/review`
- `/dashboard/compliance/deletions/[id]/review`

Test:

- View export requests.
- Approve export request.
- Reject export request with reason.
- Reject without reason and confirm validation error.
- View deletion requests.
- Approve deletion request.
- Reject deletion request with reason.
- Try approving/rejecting already reviewed request.
- Check status history.

Pass if:

- Status changes correctly.
- Review reason is required for rejection.
- Status history and audit logs are created.
- Cross-school compliance jobs are blocked.

## 10. Backup and Restore

Page:

- `/dashboard/backups`

Test:

- Run backup.
- Download backup.
- Request restore.
- Approve restore.
- Reject restore.
- Confirm production restore is blocked unless `ALLOW_PRODUCTION_RESTORE=true`.
- Confirm UI clearly says full database/platform backup, not school-only backup.

Pass if:

- Backup/restore lifecycle works.
- Restore cannot run without approval.
- Production restore guard works.
- Audit logs are created.

## 11. Security Checks

Test:

- Try direct URL access to another school data.
- Try changing `schoolId` in query/body.
- Try report export for another school.
- Try downloading another student's hall ticket.
- Try compliance review without permission.
- Check API responses for password hash, OTP, tokens, TOTP secret, or `mustChangePassword`.

Pass if:

- Unauthorized access returns `401`, `403`, or safe `404`.
- No sensitive fields are exposed.

## 12. Final Smoke Test

Run this flow end-to-end:

1. Login as Super Admin.
2. Create/review school onboarding.
3. Login as School Admin.
4. Add student, parent, and teacher.
5. Complete teacher readiness.
6. Mark attendance.
7. Create exam, seating, invigilator, hall ticket.
8. Export one report as CSV and PDF.
9. Approve/reject one compliance request.
10. Run one backup.

Final pass condition:

- No P0/P1 bug remains.
- No cross-school data leak.
- No sensitive data leak.
- Main workflows complete without developer support.
