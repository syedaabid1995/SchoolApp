# Security Phase 0 Runtime Hygiene

Academify runtime files must stay outside git. Runtime folders can contain credentials, login payloads, exports, logs, backups, uploaded documents, student photos, parent contact data, staff data, school data, and other tenant-specific records.

## Runtime-only paths

The following backend paths are runtime data and must not be committed:

- `backend/uploads/`
- `backend/exports/`
- `backend/.tmp-logs/`
- `backend/backups/`
- `backend/logs/`
- `backend/tmp/`
- `backend/temp/`
- `backend/imports/`
- `backend/storage/`

Generated `.csv`, `.xlsx`, `.pdf`, `.json`, and `.log` files in these runtime areas are local artifacts. They should be recreated by the app, stored in private object storage, or retained through a controlled operational process outside the repository.

## Environment files

Real credentials must stay in ignored `.env` files or a production secrets manager. Keep only placeholder examples in `.env.example` files, including:

- `.env.example`
- `backend/.env.example`
- `admin/.env.example`
- `frontend/.env.example`

Example files must use obvious placeholders such as `change_me`, `your-value`, or `localhost` and must not contain real database URLs, JWT secrets, S3 keys, SMTP passwords, cookies, private keys, or access tokens.

## Backups and exports

Database backups, audit exports, compliance exports, import payloads, and generated reports must not be committed. In a later infrastructure phase, backups and exports should be written to private object storage such as S3 or R2 with encryption, retention policies, and least-privilege access.

## Default super-admin migration

`backend/prisma/migrations/20260207180000_seed_super_admin/migration.sql` currently creates a real super-admin account as part of migration history. Do not delete or rewrite this migration during Phase 0 because deployed databases may already have applied it.

Recommended handling:

- Keep migration history stable for now.
- Disable or rotate the default account in any existing database through a controlled manual operation or reviewed maintenance script.
- Add a secure one-time first-admin provisioning flow in a later phase.
- Avoid creating real users, default passwords, or long-lived credentials inside future migrations.

## Seed and demo credentials

Seed scripts that create demo users with default passwords must only run against disposable local or QA databases. Before production use, replace default credential behavior with an explicit provisioning process that requires operator-supplied secrets and forces credential rotation.
