# QA Production Audit - School ERP

Date: 2026-06-04
Tester stance: production QA audit for multi-tenant school ERP
Scope: admin frontend, backend API, RBAC, tenant isolation, exports, onboarding, compliance, backup/restore readiness

## 1. Executive Summary

The application is close to production readiness, but it is not ready for unconditional production sign-off from the evidence available in this local audit.

Build verification is strong: backend TypeScript build passes, backend full test suite now passes at 150/150, admin Next.js production build passes, admin ESLint 9 now runs successfully with warnings, Prisma client generation passes, and backup tools are verified in the backend Docker runtime image. The Redis/async teardown blocker is resolved. Remaining production sign-off gaps are staging migration validation, deployed API validation, and manual staging QA.

Recommendation: Conditional Go only after the P1/P2 items below are closed and a staging manual regression pass confirms tenant isolation, auth/session security, report exports, exam PDFs, compliance review, and backup/restore safety.

Current readiness score: 94-95%.

## 2. Environment Tested

- Workspace: `/Users/syedaabidahamedarshad/Documents/TechStageIT/SchoolApp`
- Backend: Node.js/Express/TypeScript/Prisma
- Frontend: Next.js 16.1.6, React 18
- Date: 2026-06-04
- Local env files present:
  - `backend/.env`
  - `backend/.env.example`
  - `admin/.env`
  - `admin/.env.local`

## 3. Build And Test Results

| Area | Command | Result | Notes |
| --- | --- | --- | --- |
| Backend build | `npm run build` in `backend` | Pass | TypeScript compiled successfully. |
| Backend test | `npm test` in `backend` | Pass | 150/150 tests passed. No hanging test process observed. |
| Admin build | `npm run build` in `admin` | Pass | 106 app routes generated/validated. |
| Admin lint | `npm run lint` in `admin` | Pass with warnings | ESLint 9 flat config added. Current result is 0 errors and 68 warnings. Warnings remain frontend cleanup debt, not a fatal gate. |
| Direct ESLint | `npx eslint .` in `admin` | Pass with warnings | ESLint 9 flat config is present and functional. |
| Prisma generate | `npx prisma generate` in `backend` | Pass | Prisma Client generated successfully. |
| Backup tools | `docker build -f docker/backend/Dockerfile -t schoolapp-backend-check backend`; `docker run --rm schoolapp-backend-check pg_dump --version`; `docker run --rm schoolapp-backend-check pg_restore --version` | Pass | Backend runtime image contains `pg_dump` and `pg_restore` version 15.18. Host PATH still does not expose these tools, which is acceptable if backup/restore runs in the container. |

Resolved backend blocker:

- Backend full test suite now passes at 150/150.
- The Redis/async teardown issue in readiness hardening tests is resolved.
- The previous `otplib` CommonJS/ESM test-runner blocker is resolved.

## 4. QA Test Plan

### Phase 1: Environment And Deployment Readiness

Verify backend starts, admin starts, migrations apply cleanly, Prisma generates, env vars are complete, Redis degrades safely, S3/file storage works, PDF and CSV exports work, and runtime images contain `pg_dump` and `pg_restore`.

Acceptance:

- All build/test/lint commands pass.
- No unhandled promise rejections.
- No secrets printed in logs.
- Production restore cannot run without explicit flag.
- Email/SMS/WhatsApp missing config produces safe warning behavior.

### Phase 2: Authentication And Session Security

Cover Super Admin, School Admin, Teacher/Staff, and Parent login flows.

Acceptance:

- Invalid credentials always return generic messages.
- MFA/OTP flows enforce expiry, attempt limits, and rate limits.
- Refresh token rotation works and old refresh tokens cannot be reused.
- Auth cookies are HttpOnly and tokens are not exposed in JSON or browser storage.

### Phase 3: RBAC And Tenant Isolation

Run all role and cross-school access checks using School A and School B seeded data.

Acceptance:

- Unauthenticated requests return `401`.
- Authenticated but unauthorized requests return `403`.
- Hidden cross-tenant resources return `403` or `404`.
- Query/body `schoolId` overrides never broaden scope.
- Direct ID guessing never leaks data.

### Phase 4: Core Functional Regression

Cover onboarding, students/parents, attendance, academics, exams, reports, compliance, backup/restore, and settings.

Acceptance:

- Core CRUD works with validation and audit logging.
- Reports and exports enforce tenant and category permissions.
- PDF/CSV files have correct content, headers, escaping, and limits.
- Compliance approvals/rejections write status history and audit logs.

### Phase 5: UX, Responsive, And Error-State Pass

Check desktop, tablet, and mobile behavior for high-risk screens:

- Reports
- Compliance
- Exam seating
- Onboarding
- Backup/restore
- Student/staff list tables

Acceptance:

- Tables scroll correctly.
- No text or button overflow.
- Forms have validation states.
- Empty/loading/error states are clear.
- Forbidden pages redirect or render correctly.

## 5. Manual Test Cases

### Authentication

| ID | Role | Test | Expected |
| --- | --- | --- | --- |
| AUTH-001 | Super Admin | Login with valid credentials | MFA challenge or authenticated session based on config. |
| AUTH-002 | Super Admin | Login with wrong password | Generic error, no MFA challenge, audit entry written. |
| AUTH-003 | Super Admin | Verify correct MFA | Auth cookies set, dashboard accessible. |
| AUTH-004 | Super Admin | Verify wrong/expired MFA | Login blocked, attempts tracked, no session. |
| AUTH-005 | School Admin | Login through school-specific path/code | Session scoped to selected school only. |
| AUTH-006 | School Admin | Attempt login to another school | Generic denial, no data leakage. |
| AUTH-007 | Parent | Request and verify OTP | Parent portal opens linked children only. |
| AUTH-008 | Parent | Wrong/expired OTP | Login blocked and no OTP exposed in production response. |
| AUTH-009 | Any | Logout | Current refresh session revoked and cookies cleared. |
| AUTH-010 | Any | Refresh token reuse | Old token rejected after rotation. |

### RBAC And Tenant Isolation

| ID | Test | Expected |
| --- | --- | --- |
| RBAC-001 | Teacher opens admin reports page | `403` or redirect; no report data. |
| RBAC-002 | Parent opens another parent's child profile by URL | `403`/`404`; no data leakage. |
| RBAC-003 | School Admin A queries students with School B `schoolId` | Response scoped to A or blocked. |
| RBAC-004 | School Admin A posts body with School B `schoolId` | `403`/`400`; no mutation in B. |
| RBAC-005 | Staff without compliance permission reviews export | `403`. |
| RBAC-006 | School Admin exports report without category permission | `403`. |
| RBAC-007 | Backup/restore route as School Admin | `403`. |
| RBAC-008 | Super Admin opens platform-only resources | Allowed and audited. |

### Onboarding

| ID | Test | Expected |
| --- | --- | --- |
| ONB-001 | Load school onboarding checklist | Real readiness status and pending blockers shown. |
| ONB-002 | Recalculate readiness after setup changes | Checklist reflects current data. |
| ONB-003 | School Admin attempts go-live approval | Blocked. |
| ONB-004 | Super Admin approves go-live | Status updated and audit log written. |
| ONB-005 | Override go-live without reason | Validation error. |
| ONB-006 | Teacher readiness recalculation | Account/class/subject/timetable flags correct. |
| ONB-007 | Manual credential share without note | Validation error. |

### Student, Parent, Attendance, Academics

| ID | Test | Expected |
| --- | --- | --- |
| SPA-001 | Create/edit/disable/restore student | Correct lifecycle state, no sensitive fields in responses. |
| SPA-002 | Link parent and login as parent | Parent sees only linked students. |
| SPA-003 | Upload student document | Safe file key; no path traversal. |
| SPA-004 | Mark attendance twice for same class/date | Duplicate behavior follows business rule. |
| SPA-005 | Attendance locked date edit | Blocked with clear message. |
| SPA-006 | Create timetable conflict | Conflict rejected. |
| SPA-007 | Teacher/parent timetable visibility | Only assigned or linked schedule visible. |

### Exams, Reports, Compliance, Backup

| ID | Test | Expected |
| --- | --- | --- |
| EXAM-001 | Generate seating with insufficient capacity | Validation failure, no partial allocation. |
| EXAM-002 | Regenerate existing seating without force | Confirmation/force required. |
| EXAM-003 | Assign same invigilator to overlapping slot | Conflict rejected. |
| EXAM-004 | Download hall ticket before seating | Blocked. |
| EXAM-005 | Download hall ticket after seating | PDF contains school, exam, student, center, room, seat, schedule. |
| REP-001 | Open report catalog | Available/unavailable states correct. |
| REP-002 | CSV export with commas/quotes/newlines | Escaped correctly. |
| REP-003 | PDF export over row limit | Blocked or truncated according to rule. |
| REP-004 | Export report for another school | Blocked. |
| COMP-001 | Reject compliance export without reason | Validation failure. |
| COMP-002 | Approve/reject already reviewed job | Blocked. |
| BAK-001 | Run production restore without flag | Blocked. |
| BAK-002 | Runtime backup tools | `pg_dump` and `pg_restore` available. |

## 6. API Test Cases

Use seeded School A and School B data. For every endpoint family below, run these standard assertions:

- No token: `401`
- Wrong role: `403`
- Cross-tenant ID: `403` or `404`
- Invalid payload: `400`
- Duplicate/conflict: `409`
- Success: `200`, `201`, or `204`
- Response shape excludes password hashes, OTP codes, TOTP secrets, raw refresh tokens, and secret provider credentials.

Endpoint families:

| Area | API coverage |
| --- | --- |
| Auth | login, MFA verify, MFA resend, refresh, logout, logout-all, forgot/reset password, parent OTP request/verify. |
| Students | list, create, update, disable, restore, groups, categories, promotion, transfer, document signed URL. |
| Staff/Teachers | list, create, update, assignments, credentials, onboarding, readiness. |
| Attendance | student mark/load, staff attendance, self-attendance, locks, summaries. |
| Academics | years, classes, sections, subjects, assignments, timetable. |
| Exams | centers, rooms, seating, invigilators, marks, rank cards, hall tickets. |
| Reports | catalog, data, CSV export, PDF export, report-specific permissions. |
| Compliance | summary, export/deletion lists, details, approve, reject, history. |
| Backup | request, run, download, restore request, approve/reject, run restore. |
| Settings | themes, branding, security, SMS/messaging, platform settings. |
| Uploads | signed URL creation and path validation. |

## 7. RBAC Matrix Validation

| Capability | Super Admin | School Admin | Teacher | Parent | Accountant | Librarian | Staff |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Platform schools/plans/subscriptions | Allow | Deny | Deny | Deny | Deny | Deny | Deny |
| School-scoped setup | Review/override | Allow own school | Deny | Deny | Limited by permission | Limited by permission | Limited by permission |
| Student management | Platform view if intended | Allow own school | Deny or read assigned only | Own children only | Deny | Deny | Permission-based |
| Attendance admin | Deny or platform report | Allow own school | Own/assigned only | Child read-only | Deny | Deny | Permission-based |
| Reports data | Platform reports | Own school + category permission | Assigned/allowed only | Child reports only | Finance only | Library only | Permission-based |
| Report exports | Permission required | `reports.export` + category | Usually deny | Deny | Finance export if granted | Library export if granted | Permission-based |
| Compliance review | Platform or granted | Granted own school only | Deny | Deny | Deny by default | Deny by default | Permission-based |
| Backup/restore | Allow platform only | Deny | Deny | Deny | Deny | Deny | Deny |
| Themes/branding | Platform/school override | Own school | Deny | Deny | Deny | Deny | Permission-based |
| Signed uploads | Platform/school scope | Own school only | Assigned scope only | Own child scope only | Permission-based | Permission-based | Permission-based |

Validation status from automated tests: strong backend coverage exists for Super Admin, School Admin, Teacher, Parent, student, staff, audit, reports, compliance, exams, signed URLs, and tenant override attempts. Manual UI sidebar/page-level validation remains required before sign-off.

## 8. Bugs Found

| ID | Severity | Title | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- |
| BUG-001 | Resolved | Backend full test suite previously failed locally due to Redis/async teardown | Latest full backend run passes 150/150. | CI instability risk reduced. | Keep full suite in CI. |
| BUG-002 | Resolved | Frontend lint script previously used incompatible command | `npm run lint` now runs `eslint .` successfully. | Fatal lint gate restored; warning backlog remains. | Keep warnings visible and address them in frontend cleanup. |
| BUG-003 | Resolved | ESLint 9 config was missing/incompatible | Flat ESLint config added for Next/React/TypeScript. | Static analysis is available again. | Keep config aligned with Next.js upgrades. |
| BUG-004 | Resolved | Backup runtime tools verified in built image | Docker image built with backend context and `pg_dump --version` / `pg_restore --version` both report PostgreSQL 15.18. | Runtime backup/restore tool availability risk reduced. | Keep the Docker build and in-container version checks in release verification. |
| BUG-005 | P2 | Backend local `.env` is missing several example feature/env keys | `.env.example` includes auth/cache/frontend/TOTP/WhatsApp flags not present in `.env`. | Local/staging behavior may differ from intended config; feature flags may fall back unexpectedly. | Document required vs optional env vars and validate startup config. |
| BUG-006 | P3 | Next.js middleware convention deprecated | Admin build warns `middleware` file convention is deprecated; use `proxy`. | Future upgrade risk. | Plan migration from middleware convention to proxy convention. |

## 9. Production Readiness Score

Score: 94-95%.

Rationale:

- Build readiness: high.
- Backend automated coverage: strong and currently green locally at 150/150.
- Frontend static quality gate: operational with warning backlog.
- Security/tenant automated tests: strong backend evidence, but manual UI and deployed API validation still required.
- Deployment readiness: improved by verified backup tools; still incomplete until migrations on staging-like DB, deployed API checks, and env completeness are verified.

## 10. Final Recommendation

Conditional Go.

Required before production sign-off:

1. Run `npx prisma migrate deploy` against empty, seeded, and staging-like databases.
2. Complete manual UI regression for auth, RBAC/sidebar visibility, tenant isolation, onboarding, exams, reports, compliance, and backup/restore.
3. Run deployed API tests for cross-tenant object guessing, report exports, signed upload URLs, and sensitive-field redaction.
4. Address frontend lint warnings as cleanup debt before an unconditional Go.

Do not recommend unconditional Go while staging migration validation, deployed API validation, manual staging QA, and frontend warning cleanup remain open.
