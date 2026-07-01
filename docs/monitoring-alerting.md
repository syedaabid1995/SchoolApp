# Monitoring And Alerting

Phase 2E minimum monitoring for launching Academify to 1-3 schools. This does not wire paid services; use the provider already approved for the deployment.

## Health Signals

| Area | Signal | Minimum alert |
| --- | --- | --- |
| Admin frontend | HTTPS uptime check for the admin domain | Two failed checks in 5 minutes |
| Backend API | `GET /health` | Non-200 or unhealthy dependency for 5 minutes |
| Metrics | `GET /metrics` if exposed to a trusted monitor | Missing scrape or high error counters |
| PostgreSQL | CPU, memory, storage, connections, slow queries | Storage below 20%, connections above 80%, sustained CPU above 80% |
| Redis | Availability and memory | Ping failure or memory pressure |
| Worker | `backend-worker` process running and queue failures | Process down or queue failures above threshold |
| Scheduler | `backend-scheduler` process running and scheduler logs visible | Process down or missed expected scheduler run |
| Storage | Storage validation success in staging and runtime storage errors in logs | Validation failure or repeated upload/download errors |
| Backups | Scheduled backup success/failure | Any missed or failed scheduled backup |
| Auth | Failed login spikes and lockouts | Sudden increase over baseline |
| API errors | 5xx rate and latency | 5xx above 1% for 5 minutes or p95 latency above agreed SLO |
| Notifications | Email/SMS/WhatsApp failure rate if used | Provider failure spike or queue dead-letter growth |
| Server | CPU, RAM, disk, load average | Sustained CPU/RAM above 80%, disk below 20% |
| Logs | API/worker/scheduler log retention | Logs missing or retention below 14 days |

## Application Endpoints And Processes

- API health: `GET /health`
- API metrics: `GET /metrics` if the route is enabled and access is restricted to trusted monitors.
- Admin frontend: `GET /` or the deployed admin domain.
- API process: `ACADEMIFY_PROCESS_ROLE=api`
- Worker process: `ACADEMIFY_PROCESS_ROLE=worker`
- Scheduler process: `ACADEMIFY_PROCESS_ROLE=scheduler`

Do not expose `/metrics` publicly without an allowlist, VPN, reverse-proxy auth, or equivalent control.

## Alert Routing

Minimum routing for first launch:

- Primary engineering contact for API, worker, scheduler, database, Redis, storage, and deployment alerts.
- Operations owner for backup/restore and domain/TLS alerts.
- School support contact for user-impacting incidents.
- Escalation path if the primary contact does not acknowledge within 15 minutes for outage-class alerts.

## Log Retention

Keep at least:

- 14 days of API, worker, scheduler, reverse proxy, Postgres, and Redis logs for first launch.
- 30 days before onboarding more schools.
- Audit logs in PostgreSQL according to product retention policy.

Logs must not contain passwords, tokens, private keys, raw OTP values, S3 credentials, cookies, JWTs, or full signed URLs.

## Remaining Gaps

- Error tracking such as Sentry is optional until configured, but an equivalent exception alert is required before production use.
- Queue depth and failed job thresholds should be tuned after staging traffic.
- Real database backup alerts depend on the final hosting provider.
