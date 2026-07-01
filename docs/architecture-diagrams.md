# Academify Architecture Diagrams

Short captions are included so each Mermaid diagram can be read independently.

## High-Level Architecture

Public users reach Cloudflare first, then Nginx on the Hostinger KVM-2 VPS. App processes use external PostgreSQL, private S3, and Redis.

```mermaid
flowchart LR
  Users["Parents / Teachers / Admins"] --> Cloudflare["Cloudflare"]
  Cloudflare --> Nginx["Nginx on Hostinger KVM-2"]
  Nginx --> Admin["Next.js admin/frontend"]
  Nginx --> API["Backend API"]
  API --> DB[("AWS Lightsail PostgreSQL")]
  API --> Redis[("Redis")]
  API --> S3["AWS S3 private bucket"]
  API --> Worker["Worker process"]
  Worker --> Redis
  Worker --> DB
  Worker --> S3
  Scheduler["Scheduler process"] --> Redis
  Scheduler --> DB
```

## Process Architecture

PM2 keeps each runtime role separate so API requests, queue work, and scheduled jobs do not compete inside one production process.

```mermaid
flowchart TB
  PM2["PM2"]
  PM2 --> Admin["admin\nNext.js start"]
  PM2 --> API["api\nnode dist/server.js"]
  PM2 --> Worker["worker\nnode dist/worker.js"]
  PM2 --> Scheduler["scheduler\nnode dist/scheduler.js"]
  API --> DB[("PostgreSQL")]
  API --> Redis[("Redis")]
  API --> S3["S3"]
  Worker --> Redis
  Worker --> DB
  Worker --> S3
  Scheduler --> Redis
  Scheduler --> DB
```

## Request Flow

Normal browser/API traffic is routed through Cloudflare and Nginx before reaching the API process.

```mermaid
sequenceDiagram
  participant User
  participant CF as Cloudflare
  participant Nginx
  participant API
  participant DB as PostgreSQL
  User->>CF: HTTPS request
  CF->>Nginx: Forward to VPS
  Nginx->>API: Proxy to localhost:4000
  API->>DB: Read/write tenant-scoped data
  DB-->>API: Result
  API-->>Nginx: JSON response
  Nginx-->>CF: Response
  CF-->>User: Page/API result
```

## File Upload/Download Flow

The API authorizes file access, then returns a signed URL for direct private S3 access.

```mermaid
sequenceDiagram
  participant User
  participant API
  participant DB as PostgreSQL metadata
  participant S3 as S3 private bucket
  User->>API: Request file upload/download
  API->>DB: Check tenant and permission
  DB-->>API: Authorized metadata
  API->>S3: Generate signed URL
  S3-->>API: Short-lived URL
  API-->>User: Signed URL
  User->>S3: Upload/download object
  S3-->>User: Object response
```

## Background Worker Flow

The API enqueues work and returns quickly. The worker handles slow work outside the user request.

```mermaid
sequenceDiagram
  participant API
  participant Redis as Redis queue
  participant Worker
  participant DB as PostgreSQL
  participant S3
  API->>Redis: Add job
  API-->>API: Return job id/status
  Redis-->>Worker: Deliver job
  Worker->>DB: Read/write job state
  Worker->>S3: Read source or write result
  Worker->>DB: Mark complete/failed
```

## Scheduler Lock Flow

Scheduled jobs use Redis locks so a duplicate scheduler process does not run the same job twice.

```mermaid
sequenceDiagram
  participant Scheduler
  participant Redis
  participant DB as PostgreSQL
  Scheduler->>Redis: Acquire lock with SET NX PX
  alt Lock acquired
    Scheduler->>DB: Run scheduled update
    Scheduler->>Redis: Release owned lock
  else Lock already held
    Scheduler-->>Scheduler: Skip this run
  end
```

## Deployment Flow

The PM2 deployment path builds backend/admin, deploys migrations, restarts processes, reloads Nginx, then verifies health and storage.

```mermaid
flowchart TD
  SSH["SSH to KVM-2"] --> Pull["git pull"]
  Pull --> Install["npm ci"]
  Install --> BackendBuild["Backend build"]
  BackendBuild --> AdminBuild["Admin build"]
  AdminBuild --> Migrate["Prisma migrate deploy"]
  Migrate --> PM2["PM2 restart api/worker/scheduler/admin"]
  PM2 --> Nginx["Nginx reload"]
  Nginx --> Health["Health checks"]
  Health --> Storage["S3 storage validation"]
  Storage --> Logs["Check logs and alerts"]
```

## Monitoring Flow

External monitors, Sentry, PM2, and provider metrics all feed the operations view.

```mermaid
flowchart LR
  Uptime["UptimeRobot / Better Stack"] --> App["Admin uptime"]
  Uptime --> APIHealth["API /health"]
  Sentry["Sentry"] --> Errors["Frontend/backend errors"]
  PM2["PM2 status/logs"] --> Operator["Operator"]
  Server["KVM-2 CPU/RAM/disk"] --> Operator
  DB["Lightsail PostgreSQL metrics/backups"] --> Operator
  Redis["Redis health"] --> Operator
  Queues["Queue failures/delay"] --> Operator
  Scheduler["Scheduler running/lock logs"] --> Operator
  Backups["Backup success/failure"] --> Operator
  App --> Operator
  APIHealth --> Operator
  Errors --> Operator
```

## Upgrade Path

Start with KVM-2 for pitch/pilot, then increase server size and move managed services out as real usage grows.

```mermaid
flowchart LR
  KVM2["KVM-2\nPM2 + Nginx"]
  KVM4["KVM-4\nmore RAM/CPU"]
  KVM8["KVM-8\nmore app/worker capacity"]
  Managed["Managed app server\nmanaged PostgreSQL/Redis"]
  ECS["AWS ECS + RDS\nindependent scaling"]
  KVM2 --> KVM4
  KVM4 --> KVM8
  KVM8 --> Managed
  Managed --> ECS
```
