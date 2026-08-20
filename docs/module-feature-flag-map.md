# Module Feature Flag Map

This map is the review baseline for platform module flags. Missing flag rows still default to enabled. A global `DISABLED` row is intended to be a platform kill switch.

| Feature key | Frontend routes | Backend API candidates |
| --- | --- | --- |
| `module_ai_assistant` | `/dashboard/assistant` | `/api/v1/ai-assistant` |
| `module_attendance` | `/dashboard/attendance/*`, `/dashboard/staff/attendance`, `/dashboard/students/attendance`, `/dashboard/leave/*` | `/api/v1/attendance`, `/api/v1/attendance-summary`, `/api/v1/attendance/evidence`, `/api/v1/attendance-approval`, `/api/v1/leave`, `/api/v1/faces`, `/api/v1/recognition` |
| `module_academics` | `/dashboard/academics` | `/api/v1/academics`, `/api/v1/academic-setup`, `/api/v1/teacher-assignments` |
| `module_timetable` | `/dashboard/timetable` | `/api/v1/academic-setup` timetable actions, timetable module APIs |
| `module_exams` | `/dashboard/academics/exams/*`, `/dashboard/academics/marks` | `/api/v1/exams`, exam/marks endpoints under `/api/v1/academics` |
| `module_fees` | `/dashboard/fees/*`, `/dashboard/fee-challan-details`, `/dashboard/payment-methods` | `/api/v1/fees`, fee-related subscription/payment endpoints if school-facing |
| `module_expenses` | `/dashboard/accounts/expenses` | `/api/v1/expenses`, expense imports |
| `module_library` | `/dashboard/library` | `/api/v1/library` |
| `module_transport` | `/dashboard/transport` | `/api/v1/transport` |
| `module_homework` | `/dashboard/homework` | `/api/v1/homework` |
| `module_support` | `/dashboard/support` | `/api/v1/tickets`, `/api/v1/admin/support` |
| `module_reports` | `/dashboard/reports/*` | `/api/v1/reports`, report export endpoints |
| `module_messaging` | `/dashboard/communication/*`, `/dashboard/settings?tab=messaging`, `/dashboard/sms-settings`, `/dashboard/settings/sms` | `/api/v1/communication`, `/api/v1/messaging-services`, `/api/v1/admin/messaging-services`, selected `/api/v1/notifications` endpoints |
| `module_parent_portal` | `/parent/*` | `/api/v1/parents/portal` |
| `module_id_cards` | `/dashboard/id-cards/*` | `/api/v1/uploads` ID-card assets, ID-card template APIs |
| `feature_student_promotion` | `/dashboard/students/promotion` | `/api/v1/students/promotions/preview`, `/api/v1/students/promotions` |
| `feature_fee_collection` | `/dashboard/fees/collection` | `/api/v1/fees/payments`, `/api/v1/fees/payments/:id/reverse`, `/api/v1/fees/collection/*` |
| `feature_fee_reports` | `/dashboard/fees/reports` | `/api/v1/fees/reports`, `/api/v1/fees/reports/export` |

Notes:
- Student, staff, payroll, dormitory, users/roles, settings, compliance, subscriptions, backups, and platform health are not in the current module catalog. They should not be disabled by these flags unless new module keys are created.
- Backend API candidates need endpoint-level review before all are enforced, because some routers contain setup metadata or shared notification/session flows.
- Submenu feature flags are narrower than module flags. For example, `feature_fee_collection` disables only collection entry points while `module_fees` disables the whole Fees module.
