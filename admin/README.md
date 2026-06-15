# Admin Portal README

## Admin Portal Overview

The admin portal is a Next.js App Router application for school and platform administration. It includes school admin dashboards, parent portal pages, super-admin areas, role/permission management, academic setup, timetable, attendance, student/staff management, fees, payroll, reports, analytics, support, compliance, backups, themes, and subscription management.

## Technology Stack

| Area | Implementation |
| --- | --- |
| Framework | Next.js 16 App Router |
| UI | React 18, Tailwind CSS |
| Language | TypeScript |
| Data fetching | Axios wrappers and TanStack Query |
| Tables | TanStack Table |
| Forms | React Hook Form, Zod |
| Auth | Admin API auth route wrappers plus backend auth APIs |

## Folder Structure

```text
admin/
├── app/                  # App Router pages and API route proxies
├── components/           # Layout, sidebar, header, dashboard primitives, providers
├── config/               # Permission and module config
├── hooks/                # React hooks
├── lib/                  # API base, auth helpers, query client
├── services/             # Backend API service clients
├── types/                # Shared TypeScript types
└── utils/                # Utilities
```

## Authentication

Implemented pages and API routes include:

- `/login`
- `/[schoolCode]/login`
- `/verify-2fa`
- `/reset-password`
- `/change-password`
- `/parent/login`
- `/app/api/auth/*` route handlers for login, logout, refresh, sessions, TOTP, password reset, and parent OTP.

Admin API base resolution is implemented in `admin/lib/getApiBase.ts` and `admin/lib/env.ts`.

## Permissions

Permission-aware navigation is implemented through:

- `admin/config/employee-permissions.ts`
- `admin/config/plan-module-permissions.ts`
- `admin/components/Sidebar.tsx`
- `admin/components/DashboardClientLayout.tsx`
- `admin/components/AccessDeniedPanel.tsx`

The backend remains the authority for effective permissions.

## Dashboard Modules

The following App Router module directories were discovered under `admin/app/dashboard`:

| Module | Path |
| --- | --- |
| Academics | `/dashboard/academics` |
| Exams | `/dashboard/academics/exams` |
| Marks | `/dashboard/academics/marks` |
| Modern timetable | `/dashboard/academics/timetable` |
| Analytics | `/dashboard/analytics` |
| AI assistant | `/dashboard/assistant` |
| Attendance | `/dashboard/attendance` |
| Audit | `/dashboard/audit` |
| Backups | `/dashboard/backups` |
| Base setup | `/dashboard/base-setup` |
| Compliance | `/dashboard/compliance` |
| Dormitory | `/dashboard/dormitory` |
| Fees | `/dashboard/fees/*` |
| Holidays | `/dashboard/holidays` |
| Homework | `/dashboard/homework` |
| ID cards | `/dashboard/id-cards` |
| Institution setup | `/dashboard/institution-setup` |
| Leave | `/dashboard/leave` |
| Library | `/dashboard/library` |
| Onboarding | `/dashboard/onboarding` |
| Parents | `/dashboard/parents` |
| Payment methods | `/dashboard/payment-methods` |
| Payroll | `/dashboard/payroll` |
| Plans/subscriptions | `/dashboard/plans`, `/dashboard/subscriptions` |
| Reports | `/dashboard/reports` |
| Role permissions | `/dashboard/role-permissions` |
| Schools | `/dashboard/schools` |
| Sessions | `/dashboard/sessions` |
| Settings | `/dashboard/settings/*` |
| Staff | `/dashboard/staff` |
| Students | `/dashboard/students/*` |
| Support | `/dashboard/support` |
| System health | `/dashboard/system-health` |
| Teachers | `/dashboard/teachers/*` |
| Themes | `/dashboard/themes` |
| Transport | `/dashboard/transport` |
| Users | `/dashboard/users` |

Parent portal pages are implemented under `admin/app/parent`.

## State Management

The codebase uses TanStack Query through `admin/components/QueryProvider.tsx` and service modules under `admin/services`. Forms use React Hook Form and Zod where implemented.

## API Integration

Service clients exist for academic setup, academics, admin users, dashboard, AI assistant, analytics, attendance, audit, auth, backup, branding, compliance, dormitory, fees, homework, leave, library, messaging, parent portal, reports, schools, sessions, staff, students, subscriptions, support, system health, teachers, themes, transport, uploads, and users.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `API_BASE_URL` | Server-side backend API base URL |
| `NEXT_PUBLIC_API_BASE_URL` | Client-side backend API base URL |

Development fallback in code is `http://127.0.0.1:3000/api/v1`. In production, missing API base URL throws an error.

## Build Process

```bash
cd admin
npm install
npm run lint
npm run build
npm start
```

The dev server script runs:

```bash
npm run dev
```

which starts Next.js on port `3001`.

## Deployment

Docker support is provided by `docker/admin/Dockerfile`. The GitHub Actions full-stack workflow builds the admin image with:

- `NEXT_PUBLIC_API_BASE_URL`
- `API_BASE_URL`

## Troubleshooting

| Symptom | Check |
| --- | --- |
| API calls fail | Verify `API_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL` |
| Login fails | Verify backend `/api/v1/auth/login` and school domain context |
| Sidebar mismatch | Check backend effective permissions and admin permission config |
| Build fails | Run `npm run lint` and check App Router page imports |
