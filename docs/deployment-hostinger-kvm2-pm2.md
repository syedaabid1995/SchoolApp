# Academify Hostinger KVM-2 PM2 Deployment Guide

This guide describes a practical first pilot deployment for Academify on a Hostinger KVM-2 VPS using Ubuntu, Node.js LTS, PM2, Nginx, Redis on the VPS, AWS Lightsail PostgreSQL, AWS S3, Cloudflare, uptime monitoring, and Sentry.

This is documentation only. Do not paste real secrets into this file, tickets, chat, screenshots, or git history. Replace every placeholder with reviewed production values only on the server.

Source documents:

- [Hostinger KVM-2 architecture](architecture-hostinger-kvm2.md)
- [Architecture diagrams](architecture-diagrams.md)
- [Staging deployment runbook](staging-deployment.md)
- [First-school launch checklist](first-school-launch-checklist.md)
- [Backup and restore drill](backup-restore-drill.md)
- [Monitoring and alerting](monitoring-alerting.md)

## 1. Server Preparation

Provision a Hostinger KVM-2 VPS with Ubuntu LTS.

Create a non-root deployment user:

```sh
adduser deploy
usermod -aG sudo deploy
```

SSH as the deployment user:

```sh
ssh deploy@<server-ip>
```

Update base packages:

```sh
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl git unzip ca-certificates gnupg build-essential nginx ufw logrotate
```

Set the server timezone:

```sh
sudo timedatectl set-timezone <Region/City>
timedatectl
```

Recommended server layout:

```text
/var/www/academify          # repo checkout
/var/log/academify          # optional app log target
/private/backups/academify  # private local staging area for temporary backup files
```

Create directories:

```sh
sudo mkdir -p /var/www /var/log/academify /private/backups/academify
sudo chown -R deploy:deploy /var/www /var/log/academify /private/backups/academify
chmod 700 /private/backups/academify
```

## 2. Firewall Setup

Allow only SSH, HTTP, and HTTPS publicly. Redis, PostgreSQL, backend, and admin process ports must not be public.

```sh
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

If SSH is moved to a custom port, allow that port before enabling UFW.

## 3. Node.js Installation

Use Node.js active LTS. The `nvm` path avoids hardcoding a version in this document.

```sh
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
exec "$SHELL"
nvm install --lts
nvm use --lts
node --version
npm --version
```

Make sure the PM2 startup command later uses the same Node.js path.

## 4. PM2 Installation

Install PM2 globally for the deployment user:

```sh
npm install -g pm2
pm2 --version
```

PM2 will manage:

- `academify-api`: `node dist/server.js`
- `academify-worker`: `node dist/worker.js`
- `academify-scheduler`: `node dist/scheduler.js`
- `academify-admin`: `npm run start`

## 5. Redis Installation And Localhost-Only Configuration

Install Redis on the VPS for the pilot stage:

```sh
sudo apt install -y redis-server
```

Edit Redis config:

```sh
sudo nano /etc/redis/redis.conf
```

Use localhost-only binding:

```text
bind 127.0.0.1 ::1
protected-mode yes
supervised systemd
appendonly yes
```

Restart and verify:

```sh
sudo systemctl restart redis-server
sudo systemctl enable redis-server
sudo systemctl status redis-server --no-pager
redis-cli -h 127.0.0.1 ping
```

Expected response:

```text
PONG
```

Do not open port `6379` in the firewall.

## 6. PostgreSQL Client Installation

The main PostgreSQL database is AWS Lightsail PostgreSQL, not the VPS. Install only client tools on the VPS for migrations, backup tests, and restore drills.

```sh
sudo apt install -y postgresql-client
psql --version
pg_dump --version
pg_restore --version
```

Confirm the Lightsail PostgreSQL firewall or access rules allow connections only from approved sources, such as the VPS public IP or private network path.

## 7. Repo Clone

Clone the reviewed repository:

```sh
cd /var/www
git clone <repo-url> academify
cd /var/www/academify
git status --short
```

Use the release branch or commit selected for the pilot:

```sh
git fetch --all --prune
git checkout <release-branch-or-commit>
```

Record the release commit without exposing secrets:

```sh
git rev-parse HEAD
```

## 8. Backend/Admin Install And Build

Install backend dependencies:

```sh
cd /var/www/academify
npm --prefix backend ci
```

Install admin dependencies:

```sh
cd /var/www/academify
npm --prefix admin ci
```

Create the production env files in section 9 before the final production build. The admin build needs the production API URL values at build time.

After section 9 is complete, build both apps:

```sh
cd /var/www/academify
npm --prefix backend run build
npm --prefix backend run runtime:check-entrypoints
npm --prefix admin run build
```

Do not run seed scripts for production or pilot data unless a reviewed launch plan explicitly says to do so.

## 9. Production Env File Examples

Create real env files only on the server. Do not commit them.

Recommended server-only locations:

```text
/var/www/academify/backend/.env
/var/www/academify/admin/.env.production
```

Backend placeholder example:

```dotenv
NODE_ENV=production
PORT=4000

DATABASE_URL=postgresql://<db_user>:<db_password>@<lightsail-postgres-host>:5432/<db_name>?sslmode=require
REDIS_URL=redis://127.0.0.1:6379

CORS_ORIGINS=https://app.yourdomain.com
FRONTEND_URL=https://app.yourdomain.com

ACADEMIFY_PROCESS_ROLE=api
RUN_API=true
RUN_WORKERS=false
RUN_SCHEDULERS=false

JWT_SECRET=<strong-random-jwt-secret>
TOTP_ENCRYPTION_KEY=<strong-random-totp-key-if-used>

STORAGE_DRIVER=s3
STORAGE_LEGACY_LOCAL_UPLOADS_READ_ENABLED=false
ALLOW_LOCAL_STORAGE_IN_PRODUCTION=false
SIGNED_URL_EXPIRES_SECONDS=900
S3_REGION=<aws-region>
S3_BUCKET=your-private-s3-bucket
S3_ACCESS_KEY_ID=<least-privilege-s3-access-key-id>
S3_SECRET_ACCESS_KEY=<least-privilege-s3-secret-access-key>
S3_ENDPOINT=
S3_FORCE_PATH_STYLE=false

LOG_LEVEL=info
METRICS_ENABLED=true

SENTRY_DSN=<sentry-backend-dsn-if-supported>

GOOGLE_SMTP_HOST=smtp-relay.gmail.com
GOOGLE_SMTP_PORT=587
GOOGLE_SMTP_FROM_NAME=Akademifyy
GOOGLE_SMTP_FROM_EMAIL=no-reply@akademifyy.in
GOOGLE_SMTP_REPLY_TO=support@akademifyy.in
SMS_PROVIDER=<sms-provider-if-used>
SMS_API_KEY=<sms-provider-key-if-used>
```

Worker and scheduler use the same backend env file, but PM2 overrides the runtime role variables per process in the ecosystem example below.

Google Workspace SMTP Relay must allow the VPS public IP in Google Admin. Do not set `GOOGLE_SMTP_USERNAME` or `GOOGLE_SMTP_PASSWORD` for platform email; relay authentication is IP-based.

Admin placeholder example:

```dotenv
NODE_ENV=production
API_BASE_URL=https://api.yourdomain.com/api/v1
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com/api/v1
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
NEXT_PUBLIC_SENTRY_DSN=<sentry-frontend-dsn-if-supported>
```

Set strict permissions:

```sh
chmod 600 /var/www/academify/backend/.env
chmod 600 /var/www/academify/admin/.env.production
```

Rules:

- Use explicit HTTPS origins in `CORS_ORIGINS`.
- Use `STORAGE_DRIVER=s3` for real school data.
- Keep `ALLOW_LOCAL_STORAGE_IN_PRODUCTION=false`.
- Never commit `.env`, `.env.production`, provider credentials, database URLs, JWTs, cookies, private keys, or full signed URLs.

## 10. Prisma Migrate Deploy

Run migrations against the AWS Lightsail PostgreSQL database:

```sh
cd /var/www/academify/backend
set -a
. ./.env
set +a
npx prisma migrate deploy
```

Do not run these against production or pilot data:

```sh
npx prisma migrate reset
npx prisma db push
npm run seed
```

If migration output is unexpected, stop and review before starting PM2 processes.

## 11. PM2 Ecosystem Config Example

This is an example for a server-local `ecosystem.config.js`. Keep it out of git if it contains server-specific paths or real values.

The backend reads `/var/www/academify/backend/.env` through `dotenv.config()`. PM2 should set only the role-specific overrides for API, worker, and scheduler.

```js
module.exports = {
  apps: [
    {
      name: "academify-api",
      cwd: "/var/www/academify/backend",
      script: "dist/server.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        ACADEMIFY_PROCESS_ROLE: "api",
        RUN_API: "true",
        RUN_WORKERS: "false",
        RUN_SCHEDULERS: "false"
      },
      out_file: "/var/log/academify/api-out.log",
      error_file: "/var/log/academify/api-error.log",
      time: true,
      max_memory_restart: "700M"
    },
    {
      name: "academify-worker",
      cwd: "/var/www/academify/backend",
      script: "dist/worker.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        ACADEMIFY_PROCESS_ROLE: "worker",
        RUN_API: "false",
        RUN_WORKERS: "true",
        RUN_SCHEDULERS: "false"
      },
      out_file: "/var/log/academify/worker-out.log",
      error_file: "/var/log/academify/worker-error.log",
      time: true,
      max_memory_restart: "700M"
    },
    {
      name: "academify-scheduler",
      cwd: "/var/www/academify/backend",
      script: "dist/scheduler.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        ACADEMIFY_PROCESS_ROLE: "scheduler",
        RUN_API: "false",
        RUN_WORKERS: "false",
        RUN_SCHEDULERS: "true"
      },
      out_file: "/var/log/academify/scheduler-out.log",
      error_file: "/var/log/academify/scheduler-error.log",
      time: true,
      max_memory_restart: "400M"
    },
    {
      name: "academify-admin",
      cwd: "/var/www/academify/admin",
      script: "npm",
      args: "run start -- -p 3001",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      },
      out_file: "/var/log/academify/admin-out.log",
      error_file: "/var/log/academify/admin-error.log",
      time: true,
      max_memory_restart: "700M"
    }
  ]
};
```

Start processes:

```sh
cd /var/www/academify
pm2 start ecosystem.config.js
pm2 status
pm2 logs academify-api --lines 100
pm2 logs academify-worker --lines 100
pm2 logs academify-scheduler --lines 100
pm2 logs academify-admin --lines 100
```

For the admin app, create `/var/www/academify/admin/.env.production` before running `npm --prefix admin run build`, because Next.js reads production env values during build and runtime. Rebuild the admin app after changing public API URL values.

## 12. Nginx Config For App And API Domains

Create a server block for the admin frontend and API:

```sh
sudo nano /etc/nginx/sites-available/academify
```

Example config:

```nginx
server {
    listen 80;
    server_name app.yourdomain.com;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 80;
    server_name api.yourdomain.com;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and test:

```sh
sudo ln -s /etc/nginx/sites-available/academify /etc/nginx/sites-enabled/academify
sudo nginx -t
sudo systemctl reload nginx
```

Do not expose `127.0.0.1:3001`, `127.0.0.1:4000`, Redis, or PostgreSQL directly to the internet.

## 13. HTTPS Setup With Certbot Or Cloudflare Option

Use one of these approaches.

### Option A: Certbot On The VPS

Install Certbot:

```sh
sudo apt install -y certbot python3-certbot-nginx
```

Issue certificates:

```sh
sudo certbot --nginx -d app.yourdomain.com -d api.yourdomain.com
```

Verify renewal:

```sh
sudo certbot renew --dry-run
```

### Option B: Cloudflare Edge Plus Origin Protection

Use Cloudflare for public DNS and SSL. Recommended settings:

- DNS records for `app.yourdomain.com` and `api.yourdomain.com` point to the KVM-2 public IP.
- SSL/TLS mode is `Full (strict)` when a valid origin certificate or Certbot certificate exists on Nginx.
- HTTP to HTTPS redirect is enabled.
- Basic WAF/rate-limit rules are reviewed for API login and admin routes.

Do not use a Cloudflare mode that leaves origin traffic unencrypted.

## 14. S3 Validation

Validate storage against the real private bucket only after env values are reviewed. Do not print full signed URLs.

```sh
cd /var/www/academify/backend
NODE_ENV=production npm run storage:validate -- --allow-production
```

Expected result:

- Test object upload succeeds.
- Signed URL generation succeeds.
- Object readback succeeds.
- Cleanup succeeds.
- No full signed URL or S3 secret is copied into logs or tickets.

If validation fails, fix S3 credentials, region, bucket policy, endpoint, path-style setting, or server clock skew before continuing.

## 15. Default Super-Admin Remediation Dry-Run

Run the remediation check in dry-run mode first:

```sh
cd /var/www/academify/backend
NODE_ENV=production npm run remediate:default-super-admin -- --dry-run
```

If a default account exists, rotate or disable it using the documented maintenance process before pilot data is loaded. Do not seed production defaults.

## 16. Backup Test

Create a controlled backup test using the configured Lightsail PostgreSQL URL. Keep backup files private.

Dry-run:

```sh
cd /var/www/academify
NODE_ENV=production \
DATABASE_URL='postgresql://<db_user>:<db_password>@<lightsail-postgres-host>:5432/<db_name>?sslmode=require' \
BACKUP_DIR=/private/backups/academify \
scripts/backup-postgres.sh --dry-run
```

Create backup intentionally:

```sh
NODE_ENV=production \
DATABASE_URL='postgresql://<db_user>:<db_password>@<lightsail-postgres-host>:5432/<db_name>?sslmode=require' \
BACKUP_DIR=/private/backups/academify \
scripts/backup-postgres.sh --allow-production
```

Run restore drill only into a disposable database:

```sh
RESTORE_TARGET_CLASS=staging \
RESTORE_DATABASE_URL='postgresql://<restore_user>:<restore_password>@<restore-host>:5432/<restore_db>?sslmode=require' \
scripts/restore-postgres-drill.sh \
  --backup-file /private/backups/academify/<backup-file>.dump \
  --apply
```

Never restore over the live pilot database without an emergency review and explicit approval.

## 17. PM2 Startup After Reboot

Configure PM2 startup for the deployment user:

```sh
pm2 startup systemd
```

PM2 prints a `sudo env PATH=... pm2 startup ...` command. Run that exact generated command.

Save the current process list:

```sh
pm2 save
```

Verify restart behavior:

```sh
sudo reboot
```

After reconnecting:

```sh
pm2 status
curl -fsS https://api.yourdomain.com/health
curl -fsS https://app.yourdomain.com/
```

The pilot is not ready until API, worker, scheduler, admin, Redis, and Nginx all return after reboot.

## 18. Health Checks

Local checks on the VPS:

```sh
pm2 status
sudo systemctl status nginx --no-pager
sudo systemctl status redis-server --no-pager
redis-cli -h 127.0.0.1 ping
curl -fsS http://127.0.0.1:4000/health
curl -fsS http://127.0.0.1:3001/
```

Public checks:

```sh
curl -fsS https://api.yourdomain.com/health
curl -fsS https://app.yourdomain.com/
```

Logs:

```sh
pm2 logs academify-api --lines 100
pm2 logs academify-worker --lines 100
pm2 logs academify-scheduler --lines 100
pm2 logs academify-admin --lines 100
sudo tail -n 100 /var/log/nginx/error.log
```

If `/metrics` is enabled, expose it only to trusted monitoring through allowlist, VPN, reverse-proxy auth, or equivalent control.

## 19. Monitoring Setup

Configure UptimeRobot or Better Stack:

| Check | Target | Alert |
| --- | --- | --- |
| Admin frontend | `https://app.yourdomain.com/` | Two failed checks in 5 minutes |
| API health | `https://api.yourdomain.com/health` | Non-200 or unhealthy for 5 minutes |
| SSL expiry | `app.yourdomain.com`, `api.yourdomain.com` | Alert before certificate expiry |

Configure Sentry:

- Create backend and frontend projects if supported by the current implementation.
- Store Sentry DSNs only in server env files or secret management.
- Tag releases with the git commit SHA when possible.
- Alert on new high-volume errors and repeated API failures.

Configure server and process monitoring:

- PM2 process down for API, worker, scheduler, or admin.
- KVM-2 CPU/RAM sustained above 80%.
- Disk free below 20%.
- Redis ping failure or memory pressure.
- PostgreSQL storage, connections, CPU, and backup status.
- Queue failures and worker delay.
- Scheduler process down or expected job logs missing.
- Backup success/failure.
- 5xx response spike.
- Failed login spike.

Keep at least 14 days of API, worker, scheduler, Nginx, Redis, and deployment logs for the first launch.

## 20. Rollback Steps

Rollback should be a human-reviewed operations decision. Prefer rolling back app code/config before restoring data.

Before each deploy, record:

- Current git commit SHA.
- Current PM2 process list.
- Current Prisma migration status.
- Last known-good server env inventory without values.
- Latest backup evidence.
- S3 versioning/recovery status.

Application rollback:

```sh
cd /var/www/academify
git fetch --all --prune
git checkout <previous-known-good-commit>
npm --prefix backend ci
npm --prefix backend run build
npm --prefix admin ci
npm --prefix admin run build
cd backend
set -a
. ./.env
set +a
npx prisma migrate deploy
cd /var/www/academify
pm2 restart ecosystem.config.js --update-env
sudo nginx -t
sudo systemctl reload nginx
```

Post-rollback verification:

```sh
pm2 status
curl -fsS https://api.yourdomain.com/health
curl -fsS https://app.yourdomain.com/
pm2 logs academify-api --lines 100
pm2 logs academify-worker --lines 100
pm2 logs academify-scheduler --lines 100
```

Database rollback policy:

- Do not run `prisma migrate reset`.
- Do not run `prisma db push`.
- Do not restore a backup over the pilot database until an operator confirms the target, impact, and recovery plan.
- Restore to a disposable database first when possible, then compare schema and row-count evidence.

Object storage rollback policy:

- Do not delete S3 objects during application rollback.
- Use S3 versioning/provider recovery for accidental overwrite or deletion.
- Revalidate signed upload/download paths after any storage credential, endpoint, or bucket change.

## 21. First-School Pilot Checklist

The KVM-2 PM2 deployment is ready for pitching and limited pilot usage only after these checks pass:

- [ ] DNS configured for `app.yourdomain.com` and `api.yourdomain.com`.
- [ ] Cloudflare SSL/TLS and protection settings reviewed.
- [ ] HTTPS works for app and API.
- [ ] UFW allows only SSH, HTTP, and HTTPS.
- [ ] Redis is bound to localhost and not public.
- [ ] Lightsail PostgreSQL accepts connections only from approved sources.
- [ ] Backend build completed.
- [ ] Admin build completed.
- [ ] `prisma migrate deploy` completed.
- [ ] PM2 runs API, worker, scheduler, and admin as separate processes.
- [ ] PM2 processes restart after reboot.
- [ ] Nginx proxies app and API to localhost ports.
- [ ] API `/health` returns healthy.
- [ ] S3 validation passed.
- [ ] Default super-admin remediation dry-run completed, and any default account is rotated, disabled, or confirmed absent.
- [ ] Backup test completed.
- [ ] Restore drill completed against a disposable database.
- [ ] Uptime monitoring is active for app and API.
- [ ] Sentry or equivalent error tracking is configured.
- [ ] Tenant isolation smoke test passes with at least two schools.
- [ ] School admin login tested.
- [ ] Teacher login tested.
- [ ] Parent login tested.
- [ ] Attendance flow tested.
- [ ] File upload/download signed URL flow tested.
- [ ] Worker queue health is visible.
- [ ] Scheduler lock/log visibility is confirmed.
- [ ] No real `.env` file, secret, database URL, private key, JWT, cookie, or full signed URL is committed.

Plan an upgrade when RAM stays above 75-80%, CPU is high for sustained periods, API responses slow down, worker queue delay grows, reports/exports become heavy, 5+ active schools use the system regularly, or 10+ schools are planned.
