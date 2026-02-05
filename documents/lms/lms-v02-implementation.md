# LMS Module (V02) - Additive Implementation Spec

## Scope
Add LMS capabilities without changing existing academic hierarchies or attendance contracts.

## Existing Dependencies (Reused)
- `School -> AcademicYear -> Class -> Section`
- `Subject` (canonical)
- Teacher assignment to class/subject
- Student mapping to class/section
- Attendance remains source-of-truth for presence

---

## UI Routes + Screens

## Teacher
- `/dashboard/lms/content`
  - List my subjects/classes
  - Create content (video/pdf/link/text)
  - Publish/unpublish
- `/dashboard/lms/assignments`
  - Create assignment
  - Set due date/time
  - Attach files/links
  - View submissions
- `/dashboard/lms/assignments/:assignmentId/submissions`
  - Submission list
  - Grade/feedback (optional phase-2)

## Student/Parent (read-oriented)
- `/dashboard/lms/my-subjects`
  - Subject-wise content feed
- `/dashboard/lms/assignments`
  - Upcoming/overdue/completed assignments
- `/dashboard/lms/assignments/:assignmentId`
  - Submit/update submission before due date

## School Admin
- `/dashboard/lms/overview`
  - Content and assignment usage by class/subject/teacher

---

## Additive API Endpoints (No Breaking Changes)

## Content
- `POST /api/v1/lms/content`
- `GET /api/v1/lms/content`
- `GET /api/v1/lms/content/:id`
- `PATCH /api/v1/lms/content/:id`
- `DELETE /api/v1/lms/content/:id` (soft delete)

## Assignments
- `POST /api/v1/lms/assignments`
- `GET /api/v1/lms/assignments`
- `GET /api/v1/lms/assignments/:id`
- `PATCH /api/v1/lms/assignments/:id`
- `POST /api/v1/lms/assignments/:id/publish`

Note: Assignment submission is allowed regardless of attendance status unless explicitly restricted by policy.

## Submissions
- `POST /api/v1/lms/assignments/:id/submissions`
- `PATCH /api/v1/lms/assignments/:id/submissions/:submissionId`
- `GET /api/v1/lms/assignments/:id/submissions`
- `GET /api/v1/lms/my-submissions`

Idempotency note: submission create/update should be idempotent per `(assignmentId, studentId)`.

---

## Conceptual Data Model (No Hierarchy Redesign)

- `LmsContent`
  - schoolId, academicYearId, classId, sectionId?, subjectId
  - createdByTeacherId
  - type (`VIDEO|PDF|LINK|TEXT`)
  - title, description, resourceUrl
  - publishedAt, status

- `LmsAssignment`
  - schoolId, academicYearId, classId, sectionId?, subjectId
  - createdByTeacherId
  - title, instructions, dueAt, maxMarks?
  - status (`DRAFT|PUBLISHED|CLOSED`)

- `LmsSubmission`
  - assignmentId, studentId, schoolId
  - submittedAt, contentText?, attachmentUrl?
  - status (`SUBMITTED|LATE|RESUBMITTED`)
  - gradedAt?, marks?, feedback?

---

## Migration Plan + Rollback Plan

## Phase A (recommended MVP)
- No DB migration.
- Use mock/in-memory for UI/API contract validation only.
- Rollback: remove routes and feature flag.

## Phase B (production)
- Create additive tables: `lms_contents`, `lms_assignments`, `lms_submissions`.
- Add indexes:
  - `(school_id, class_id, subject_id, published_at)`
  - `(assignment_id, student_id)` unique
- Rollback:
  - disable LMS feature flag
  - archive/export LMS data
  - drop LMS tables in reverse order if required

---

## Permission Matrix Impact (Role x Action)

| Role | Content View | Content Create/Edit | Assignment Create/Edit | Submit Assignment | View All Submissions |
|---|---|---|---|---|---|
| SUPER_ADMIN | Optional global read | No | No | No | No |
| SCHOOL_ADMIN | Yes (school) | Optional policy-based | Optional policy-based | No | Yes (school) |
| TEACHER | Yes (assigned) | Yes (assigned subject/class) | Yes (assigned subject/class) | No | Yes (own assignments) |
| STUDENT | Yes (assigned class/subject) | No | No | Yes | No |
| PARENT | View child only (optional) | No | No | No | No |

Guardrails:
- teacher endpoints must verify class/subject assignment
- student endpoints must verify class/section enrollment
- all queries scoped by `schoolId`

---

## Cache Impact + Audit Log Impact

## Cache
- Cache list endpoints:
  - content list by class/subject
  - assignment list by class/subject
  - student assignment list
- Invalidate on:
  - content create/update/delete/publish
  - assignment create/update/publish/close
  - submission create/update

Soft-delete note: content delete hides items from student views while preserving audit history.

## Audit Logs
Audit actions:
- `LMS_CONTENT_CREATE|UPDATE|DELETE|PUBLISH`
- `LMS_ASSIGNMENT_CREATE|UPDATE|PUBLISH|CLOSE`
- `LMS_SUBMISSION_CREATE|UPDATE`

Log fields:
- actorId, actorRole, schoolId, entityType, entityId
- beforeState/afterState (for update/publish)

---

## Test Checklist

## API tests
- create/list/get/update flows for content and assignment
- submission create/update within due window
- prevent submission to non-assigned class/student

## Role tests
- teacher can only create for assigned class/subject
- student cannot create content/assignment
- parent has read-only child visibility (if enabled)

## Tenant isolation tests
- cross-school access denied for all LMS entities
- school-scoped listing never leaks data

## Cache tests
- first list request MISS, second HIT
- write action invalidates relevant list/detail keys

## Audit tests
- create/update/publish actions generate audit records
- actor and schoolId recorded correctly

---

## Feature Flags (Recommended)
- `LMS_ENABLED`
- `LMS_ASSIGNMENTS_ENABLED`
- `LMS_PARENT_VIEW_ENABLED`

Rollout:
1. Enable for one pilot school
2. Validate permissions and tenant isolation
3. Expand by school batches
