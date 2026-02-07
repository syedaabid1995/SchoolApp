# Exams & Assessments (V03) - Additive Implementation Spec

## Scope
Add exams and assessments on top of existing academic and attendance foundations without modifying canonical entities.

## Existing Dependencies (Reused)
- `School -> AcademicYear -> Class -> Section`
- `Subject` (canonical, no duplication)
- Teacher assignment to class/subject
- Student enrollment to class/section
- Attendance session records for presence validation

---

## UI Routes + Screens

## School Admin / Exam Coordinator
- `/dashboard/exams`
  - Exam list (draft/published/completed)
  - Create/edit exam
- `/dashboard/exams/:examId`
  - Exam details, mapped classes/subjects
  - Schedule overview
- `/dashboard/exams/:examId/papers`
  - Subject papers and max marks
- `/dashboard/exams/:examId/marks/upload`
  - Manual marks entry
  - Excel upload + validation preview
- `/dashboard/exams/:examId/results`
  - Publish/unpublish result
  - Result summary by class/subject

## Teacher
- `/dashboard/exams/my-papers`
  - Assigned papers only
- `/dashboard/exams/:examId/:paperId/marks`
  - Mark entry for assigned class/subject

## Parent/Student (read-only)
- `/dashboard/results`
  - Published exam results only
- `/dashboard/results/:examId`
  - Subject-wise marks and grade

---

## Additive API Endpoints (No Breaking Changes)

## Exams
- `POST /api/v1/exams`
- `GET /api/v1/exams`
- `GET /api/v1/exams/:id`
- `PATCH /api/v1/exams/:id`
- `POST /api/v1/exams/:id/publish`

## Exam Papers
- `POST /api/v1/exams/:id/papers`
- `GET /api/v1/exams/:id/papers`
- `PATCH /api/v1/exams/:id/papers/:paperId`

## Marks
- `POST /api/v1/exams/:id/papers/:paperId/marks` (manual/bulk payload)
- `POST /api/v1/exams/:id/papers/:paperId/marks/import` (excel, idempotent per `examPaperId + studentId`)
- `GET /api/v1/exams/:id/papers/:paperId/marks`
- `PATCH /api/v1/exams/:id/papers/:paperId/marks/:markId`

## Results
- `POST /api/v1/exams/:id/results/publish`
- `GET /api/v1/exams/:id/results`
- `GET /api/v1/results/my`

---

## Conceptual Data Model (No Canonical Redesign)

- `Exam`
  - schoolId, academicYearId
  - name, type, startDate, endDate
  - status (`DRAFT|PUBLISHED|COMPLETED`)
  - `COMPLETED` means marks are locked and results are published

- `ExamPaper`
  - examId, classId, sectionId?, subjectId
  - maxMarks, passMarks
  - assignedTeacherId?

- `Mark`
  - examPaperId, studentId, schoolId
  - marksObtained, grade, remarks
  - source (`MANUAL|EXCEL`)
  - marks are read-only after result publish unless explicit admin unlock with mandatory audit reason

- `ResultPublication`
  - examId, schoolId
  - publishedAt, publishedBy

Presence validation rule:
- For a mark entry date/session policy, verify student attendance presence before accepting mark upload where policy requires it.

---

## Migration Plan + Rollback Plan

## Phase A (contract-first)
- No DB change; validate APIs and UI contracts against existing exam/marks models if available.
- Rollback: disable feature flag and route exposure.

## Phase B (if schema additions needed)
- Additive tables/columns only (no subject/class/student hierarchy changes).
- Add indexes:
  - `(school_id, academic_year_id, status)` on exams
  - `(exam_id, class_id, subject_id)` on exam papers
  - unique `(exam_paper_id, student_id)` for marks
- Rollback:
  - disable feature flags
  - export/archive exam artifacts
  - drop additive objects in reverse dependency order

---

## Permission Matrix Impact (Role x Action)

| Role | Exam CRUD | Paper Mapping | Marks Entry | Marks Import | Result Publish | Result View |
|---|---|---|---|---|---|---|
| SUPER_ADMIN | Optional global read | No | No | No | No | Optional global read |
| SCHOOL_ADMIN | Yes (school) | Yes | Yes | Yes | Yes | Yes |
| TEACHER | No (default) | No | Yes (assigned paper only) | Optional (assigned only) | No | Assigned classes (optional) |
| STUDENT | No | No | No | No | No | Yes (published only) |
| PARENT | No | No | No | No | No | Yes (published, linked student only) |

Guardrails:
- `schoolId` scoping mandatory for all queries/mutations
- Teacher can only touch assigned paper/class/subject
- Parent/student are read-only

---

## Cache Impact + Audit Log Impact

## Cache
- Cache list endpoints:
  - exams list (by school/year/status)
  - papers list per exam
  - published results views
- Invalidate on:
  - exam create/update/publish
  - paper create/update
  - marks create/import/update
  - result publish/unpublish

## Audit
Audit actions:
- `EXAM_CREATE|UPDATE|PUBLISH`
- `EXAM_PAPER_CREATE|UPDATE`
- `MARK_CREATE|IMPORT|UPDATE`
- `RESULT_PUBLISH|UNPUBLISH`

Required fields:
- actorId, actorRole, schoolId, entityType, entityId
- beforeState/afterState for updates/publish operations

---

## Test Checklist

## API tests
- exam CRUD and filtering
- paper mapping validations
- manual marks entry with duplicate prevention
- excel import validation + partial failure reporting
- result publish/read flows

## Role tests
- teacher blocked from non-assigned paper
- parent/student blocked from writes
- school admin full school scope only

## Tenant isolation tests
- no cross-school exam/paper/mark/result access
- result endpoints only return same-school data

## Attendance integration tests
- marks upload fails for non-present students when policy enabled
- marks upload passes for present students

## Cache tests
- list endpoints MISS -> HIT
- write operations invalidate relevant keys

## Audit tests
- every write/publish/import action generates audit entries with correct actor and school

---

## Feature Flags (Recommended)
- `EXAMS_ENABLED`
- `EXAM_MARKS_IMPORT_ENABLED`
- `RESULTS_PORTAL_ENABLED`

Rollout:
1. Pilot with one school and one exam cycle
2. Validate import quality + permission boundaries
3. Expand per school batch
