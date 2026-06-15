# Architecture

This document describes the architecture found in the repository. It documents implementation evidence only; missing or unstated areas are marked as "Not Found In Codebase".

## High Level Architecture

```mermaid
flowchart TD
  subgraph Clients
    Admin["Next.js Admin Portal"]
    Parent["Parent Portal Pages"]
    Mobile["Flutter Staff App"]
  end

  subgraph Backend
    API["Express API"]
    Auth["Auth + RBAC Middleware"]
    Services["Domain Services"]
    Repos["Repositories"]
    Queues["BullMQ Queues"]
    Workers["Workers"]
    Metrics["Health / Metrics"]
  end

  subgraph Data
    DB[(PostgreSQL)]
    Redis[(Redis)]
    S3["AWS S3 / local uploads"]
  end

  Admin --> API
  Parent --> API
  Mobile --> API
  API --> Auth
  Auth --> Services
  Services --> Repos
  Repos --> DB
  Services --> Redis
  Services --> S3
  Services --> Queues
  Queues --> Workers
  API --> Metrics
```

## Backend Request Flow

```mermaid
sequenceDiagram
  participant Client
  participant Express
  participant Middleware
  participant Router
  participant Controller
  participant Service
  participant Repository
  participant Prisma
  participant DB

  Client->>Express: HTTP request
  Express->>Middleware: security, CORS, API version, school context, metrics
  Middleware->>Router: authenticated/authorized request
  Router->>Controller: route handler
  Controller->>Service: domain operation
  Service->>Repository: persistence operation
  Repository->>Prisma: Prisma query
  Prisma->>DB: SQL
  DB-->>Prisma: rows
  Prisma-->>Repository: result
  Repository-->>Service: domain data
  Service-->>Controller: response model
  Controller-->>Client: JSON response
```

## Authentication Flow

```mermaid
sequenceDiagram
  participant User
  participant AdminOrMobile as Client
  participant AuthAPI as Auth API
  participant AuthService
  participant DB as PostgreSQL
  participant Redis

  User->>AdminOrMobile: submit credentials
  AdminOrMobile->>AuthAPI: POST /auth/login
  AuthAPI->>AuthService: validate credentials
  AuthService->>DB: load user, roles, auth state
  alt MFA required
    AuthService->>DB: create MFA challenge
    AuthAPI-->>AdminOrMobile: 2FA challenge response
    AdminOrMobile->>AuthAPI: POST /auth/verify-2fa
  end
  AuthService->>DB: create refresh session
  AuthService->>Redis: cache permission data where enabled
  AuthAPI-->>AdminOrMobile: access token + user context
```

## Authorization Flow

```mermaid
flowchart TD
  Route["Incoming protected route"] --> Auth["authMiddleware / requirePermission"]
  Auth --> User["Authenticated user"]
  User --> Cache{"Permission cache hit?"}
  Cache -- Yes --> Effective["Effective permissions"]
  Cache -- No --> Resolve["AuthorizationService"]
  Resolve --> RolePerms["EmployeeRolePermission"]
  Resolve --> UserPerms["EmployeeUserPermission"]
  Resolve --> PlanPerms["SubscriptionPlanPermission"]
  RolePerms --> Effective
  UserPerms --> Effective
  PlanPerms --> Effective
  Effective --> Decision{"Allowed?"}
  Decision -- Yes --> Controller["Controller"]
  Decision -- No --> Denied["403 Access denied"]
```

## Attendance Flow

Canonical student attendance storage is modernized around `StudentAttendanceSession` and `StudentAttendanceRecord`; holidays remain in `AttendanceHoliday`.

```mermaid
flowchart TD
  AdminOrMobile["Admin/Mobile Attendance UI"] --> API["Attendance / Student Attendance API"]
  API --> Authz["Permission checks"]
  Authz --> Service["Attendance service"]
  Service --> Holiday["AttendanceHoliday for holidays"]
  Service --> Session["StudentAttendanceSession"]
  Service --> Record["StudentAttendanceRecord"]
  Session --> DB[(PostgreSQL)]
  Record --> DB
  Holiday --> DB
  DB --> ReadService["AttendanceReadService"]
  ReadService --> Reports["Reports / Dashboard / Parent / Mobile reads"]
```

## Timetable Flow

Canonical timetable storage uses `AttendancePeriod`, `TimetableVersion`, and `TimetableEntry`.

```mermaid
flowchart TD
  Admin["Admin timetable UI"] --> TimetableAPI["Academics timetable API"]
  TimetableAPI --> Periods["AttendancePeriod"]
  TimetableAPI --> Version["TimetableVersion draft/published workflow"]
  TimetableAPI --> Entries["TimetableEntry"]
  Entries --> ReadService["TimetableReadService"]
  ReadService --> Mobile["Flutter timetable"]
  ReadService --> AdminViews["Admin timetable views"]
  ReadService --> Attendance["Attendance timetable lookups"]
```

## Student Management Flow

```mermaid
flowchart TD
  Admin["Admin Student Pages"] --> Routes["/api/v1/students"]
  Routes --> Controller["Student controller"]
  Controller --> Facade["Student management facade"]
  Facade --> Enrollment["Enrollment service"]
  Facade --> Profile["Profile service"]
  Facade --> Parent["Parent association service"]
  Facade --> Documents["Document/photo service"]
  Facade --> Transfers["Transfer service"]
  Facade --> Imports["Import service"]
  Enrollment --> Repos["Student repositories"]
  Profile --> Repos
  Parent --> Repos
  Documents --> Repos
  Transfers --> Repos
  Imports --> Repos
  Repos --> DB[(PostgreSQL)]
```

## File Upload Flow

```mermaid
sequenceDiagram
  participant Client
  participant UploadAPI as /api/v1/uploads
  participant UploadService
  participant S3 as AWS S3
  participant Local as Local uploads fallback

  Client->>UploadAPI: request signed URL or upload file
  UploadAPI->>UploadService: validate upload context
  alt production S3
    UploadService->>S3: create signed URL / upload object
    S3-->>UploadService: object key/url
  else development fallback
    UploadService->>Local: write under uploads/
    Local-->>UploadService: local path
  end
  UploadService-->>UploadAPI: upload metadata
  UploadAPI-->>Client: JSON response
```

## Notification Flow

```mermaid
flowchart TD
  Admin["Admin notification UI"] --> API["/api/v1/notifications"]
  API --> Templates["NotificationTemplate"]
  API --> Logs["NotificationLog"]
  API --> Queue["notifications BullMQ queue"]
  Queue --> Worker["notification.worker.ts"]
  Worker --> Messaging["MessagingService / provider config"]
  Messaging --> User["Recipient"]
  Mobile["Flutter Firebase Messaging"] --> User
```

## Observability Architecture

| Component | Implementation |
| --- | --- |
| Health checks | `GET /health` |
| Metrics | `GET /metrics`, Prometheus-compatible service |
| Request metrics | `requestMetricsMiddleware` |
| Prisma observability | `src/services/observability/prisma-observability.service.ts` |
| Redis metrics | `src/services/observability/redis-metrics.service.ts` |
| Queue metrics | `src/services/observability/queue-metrics.service.ts` |
| OpenTelemetry | Config flags and telemetry helper foundation; disabled by default |

## Missing Architecture Information

| Area | Status |
| --- | --- |
| Formal ADRs | Not Found In Codebase |
| Complete OpenAPI for every endpoint | Partial `backend/openapi.yaml` found |
| Infrastructure-as-code beyond Docker/GitHub Actions | Not Found In Codebase |
| Mobile production signing documentation | Not Found In Codebase |
