# SchoolApp k6 Load Tests

This folder contains a production-safe k6 runner for the deployed API. Use it from your local machine or a separate test host. Do not run it from the same KVM-2 server you are measuring, because the load generator will consume CPU and network capacity.

## Install

macOS:

```sh
brew install k6
```

Docker alternative:

```sh
docker run --rm -v "$PWD:/src" -w /src grafana/k6 version
```

## Required Inputs

Use a dedicated non-MFA test account with fake/staging data. Do not commit real credentials.

```sh
export ACADEMIFY_BASE_URL="https://api.yourdomain.com"
export ACADEMIFY_SCHOOL_ADMIN_EMAIL="load-admin@example.com"
export ACADEMIFY_SCHOOL_ADMIN_PASSWORD="replace-with-test-password"
export ACADEMIFY_SCHOOL_CODE="DKS00005"
```

`ACADEMIFY_BASE_URL` can be either the API origin or the API prefix:

```text
https://api.yourdomain.com
https://api.yourdomain.com/api/v1
```

## Smoke Test

Run this first:

```sh
k6 run load-tests/k6/schoolapp-load-test.js
```

Docker:

```sh
docker run --rm -v "$PWD:/src" -w /src \
  -e ACADEMIFY_BASE_URL \
  -e ACADEMIFY_SCHOOL_ADMIN_EMAIL \
  -e ACADEMIFY_SCHOOL_ADMIN_PASSWORD \
  -e ACADEMIFY_SCHOOL_CODE \
  grafana/k6 run load-tests/k6/schoolapp-load-test.js
```

## Concurrent User Tests

These profiles simulate increasing virtual users. Each VU sends a batch of configured read requests, then sleeps briefly to behave more like a user.

```sh
ACADEMIFY_TEST_PROFILE=baseline k6 run load-tests/k6/schoolapp-load-test.js
ACADEMIFY_TEST_PROFILE=load k6 run load-tests/k6/schoolapp-load-test.js
ACADEMIFY_TEST_PROFILE=stress k6 run load-tests/k6/schoolapp-load-test.js
```

Built-in profiles:

| Profile | Shape |
| --- | --- |
| `smoke` | 1 VU for a quick preflight |
| `baseline` | ramps to 10 VUs |
| `load` | ramps to 50 VUs |
| `stress` | ramps to 200 VUs |
| `spike` | jumps quickly to 150 VUs |
| `soak` | holds 25 VUs for 30 minutes |

For KVM-2, use `smoke`, then `baseline`, then `load`. Run `stress` only after you are watching PM2, Nginx, PostgreSQL, Redis, and queue metrics.

## Fixed RPS Tests

Use fixed request-rate mode when you want to find approximate throughput:

```sh
ACADEMIFY_TEST_MODE=rps \
ACADEMIFY_RPS=25 \
ACADEMIFY_DURATION=5m \
ACADEMIFY_PRE_ALLOCATED_VUS=20 \
ACADEMIFY_MAX_VUS=100 \
k6 run load-tests/k6/schoolapp-load-test.js
```

Increase `ACADEMIFY_RPS` in small steps: `10`, `25`, `50`, `75`, `100`. Stop when p95 latency, 5xx errors, database CPU, Redis memory, or queue delay becomes unacceptable.

## Temporary Rate-Limit Bypass

Your backend global limiter defaults to `100 requests / 60 seconds` per IP. For a controlled staging/pilot load-test window, the API can bypass only that global limiter when both are set on the server:

```dotenv
LOAD_TESTING_ENABLED=true
LOAD_TESTING_SECRET=<strong-random-secret>
```

Then pass the same secret to k6:

```sh
export ACADEMIFY_LOAD_TEST_KEY="<strong-random-secret>"
```

The script sends this as `x-load-test-key`.

This does not bypass auth, login/MFA rate limits, permissions, subscription guards, or write guards. Turn it off immediately after the load test:

```dotenv
LOAD_TESTING_ENABLED=false
```

## Endpoint Mix

Default endpoints are intentionally light:

```text
/users/me,/notifications/summary
```

For a school-admin read test:

```sh
export ACADEMIFY_READ_ENDPOINTS="/users/me,/dashboard,/students/students?page=1&limit=20,/teachers?page=1&limit=20,/attendance-summary,/fees/metadata"
ACADEMIFY_TEST_PROFILE=baseline k6 run load-tests/k6/schoolapp-load-test.js
```

Only include endpoints that the test user can access. A `403` means the permission setup or endpoint mix is wrong for that user, not that the server capacity is low.

## Custom Ramp

Use a JSON stage list when you need an exact concurrency shape:

```sh
ACADEMIFY_STAGES='[{"duration":"1m","target":10},{"duration":"5m","target":25},{"duration":"1m","target":0}]' \
k6 run load-tests/k6/schoolapp-load-test.js
```

## Outputs

Each run writes a JSON summary to:

```text
load-tests/k6/results/
```

The directory is ignored by git except for `.gitkeep`.

## Interpreting KVM-2 Results

Use these starting criteria for early pilot testing:

- Normal read load p95 under `800 ms`.
- Stress/spike p95 under `1500 ms`.
- 5xx/server error rate below `1%` during normal load.
- No sustained PM2 restarts.
- PostgreSQL CPU, slow queries, and connection count remain stable.
- Redis memory and BullMQ queue delay remain stable.

If the API fails because of 401/403, fix credentials/permissions before treating the run as a capacity result.

## Authenticated Realistic Test

Use this for the real application-capacity test. It authenticates each VU once, refreshes tokens when the 15-minute access token expires, applies 1-5 second think time, and runs the production-like endpoint mix:

```text
25% GET /users/me
20% GET /dashboard
20% GET /students/students
10% GET /teachers
10% GET /attendance-summary
5% attendance session create/update
```

Login is measured during per-VU startup. Repeated 10% login traffic is disabled by default because the backend intentionally keeps the login IP limiter active at `20 attempts / 15 minutes`. Enable repeated login only when you are explicitly measuring auth throughput from distributed generators:

```sh
export ACADEMIFY_ENABLE_RELOGIN_WEIGHT=true
```

Required:

```sh
export ACADEMIFY_BASE_URL="https://api.akademifyy.in"
export ACADEMIFY_ADMIN_EMAIL="load-admin@example.com"
export ACADEMIFY_ADMIN_PASSWORD="replace-with-test-password"
export ACADEMIFY_SCHOOL_CODE="DKS00005"
export ACADEMIFY_LOAD_TEST_KEY="<staging-or-pilot-load-test-secret>"
```

Attendance writes are enabled only when a dedicated test fixture is provided. Use a test school/class/student set; do not point this at normal production classes.

```sh
export ACADEMIFY_ATTENDANCE_CLASS_ID="<test-class-uuid>"
export ACADEMIFY_ATTENDANCE_SECTION_ID="<test-section-uuid-if-required>"
export ACADEMIFY_ATTENDANCE_STUDENT_IDS="<student-uuid-1>,<student-uuid-2>"
export ACADEMIFY_ATTENDANCE_DATES="2026-07-04"
```

Run a one-minute authenticated smoke first:

```sh
ACADEMIFY_AUTH_PROFILE=smoke ./load-tests/k6/run-authenticated-load-test.sh
```

Then run stages separately, so you can see the exact stable ceiling:

```sh
ACADEMIFY_AUTH_PROFILE=stage1 ./load-tests/k6/run-authenticated-load-test.sh
ACADEMIFY_AUTH_PROFILE=stage2 ./load-tests/k6/run-authenticated-load-test.sh
ACADEMIFY_AUTH_PROFILE=stage3 ./load-tests/k6/run-authenticated-load-test.sh
ACADEMIFY_AUTH_PROFILE=stage4 ./load-tests/k6/run-authenticated-load-test.sh
```

The full requested profile combines stage 1 through stage 4:

```sh
ACADEMIFY_AUTH_PROFILE=realistic ./load-tests/k6/run-authenticated-load-test.sh
```

Stress mode continues beyond 100 VUs to 125, 150, then 200 VUs and aborts when the aggregate failure or p95 thresholds are breached:

```sh
ACADEMIFY_AUTH_PROFILE=stress ./load-tests/k6/run-authenticated-load-test.sh
```

Each run writes these artifacts under `load-tests/k6/results/`:

```text
summary-authenticated-<profile>-<run-id>.json
k6-authenticated-<profile>-<run-id>.log
k6-authenticated-<profile>-<run-id>.console.log
manifest-authenticated-<profile>-<run-id>.json
metrics-before-<run-id>.prom
metrics-after-<run-id>.prom
health-before-<run-id>.json
health-after-<run-id>.json
performance-report-<run-id>.md
```

If `/metrics` is not exposed to your load generator, set:

```sh
export ACADEMIFY_CAPTURE_API_METRICS=false
```

Host CPU, RAM, disk I/O, network throughput, PostgreSQL connection count, Redis memory, and event-loop delay still need to be collected from Hostinger, PM2, PostgreSQL, Redis, or your monitoring stack while k6 is running.
