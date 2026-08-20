# Sensitive Field Key Rotation Runbook

This runbook explains how to rotate `SENSITIVE_FIELD_ENCRYPTION_KEY` for encrypted high-risk database fields.

The rotation script rewrites encrypted values with a new key and recomputes lookup hashes with the same new key. It is dry-run-first and must be executed during a short maintenance window.

## Current Coverage

The script covers the sensitive-field encryption implemented for:

- `Student`
- `ParentGuardian`
- `ParentProfile`
- `TeacherProfile`
- `TeacherBankDetails`

It does not rotate legacy `v1:` messaging credential vault values. Those are a separate encryption format and should be handled only if messaging credential consistency becomes necessary.

## Script

Backend command:

```bash
npm run sensitive:rotate-key -- --dry-run
```

Script file:

```text
backend/scripts/rotate-sensitive-field-encryption-key.ts
```

Available options:

```bash
npm run sensitive:rotate-key -- --help
npm run sensitive:rotate-key -- --dry-run
npm run sensitive:rotate-key -- --apply
npm run sensitive:rotate-key -- --dry-run --scope students
npm run sensitive:rotate-key -- --dry-run --scope staff
npm run sensitive:rotate-key -- --dry-run --school-id <school-id>
npm run sensitive:rotate-key -- --dry-run --limit 100
```

Supported scopes:

- `all`
- `students`
- `staff`
- `parent-guardians`
- `parent-profiles`

Default scope is `all`.

## Required Environment Variables

During rotation, both keys must be present:

```dotenv
SENSITIVE_FIELD_ENCRYPTION_ENABLED=true
OLD_SENSITIVE_FIELD_ENCRYPTION_KEY=<old-current-key>
SENSITIVE_FIELD_ENCRYPTION_KEY=<new-key>
```

Rules:

- `OLD_SENSITIVE_FIELD_ENCRYPTION_KEY` is the key currently used by the existing encrypted DB rows.
- `SENSITIVE_FIELD_ENCRYPTION_KEY` is the new key that will be used after rotation.
- The two keys must be different.
- Never print, commit, or share either key.
- Remove `OLD_SENSITIVE_FIELD_ENCRYPTION_KEY` after the rotation is verified.

## Safety Properties

The script is designed to be safe to re-run:

- Default mode is `--dry-run`.
- It refuses to run if the old key is missing.
- It refuses to run if the old key and new key are the same.
- It decrypts existing values with the old key first.
- If old-key decrypt fails, it tries the new key so interrupted rotations can be resumed.
- It never prints plaintext field values or key values.
- It recomputes lookup hashes using the new key.

## Pre-Rotation Checklist

Before running `--apply`:

- Take a fresh database backup.
- Confirm the app build deployed includes the rotation script.
- Confirm `SENSITIVE_FIELD_ENCRYPTION_ENABLED=true`.
- Generate and store the new key in the server secret manager or environment config.
- Keep the old key available only as `OLD_SENSITIVE_FIELD_ENCRYPTION_KEY`.
- Stop or pause write traffic if possible. At minimum, avoid student/staff/parent bulk imports during rotation.
- Confirm you can restart the backend quickly.

## Dry Run

From the backend directory:

```bash
OLD_SENSITIVE_FIELD_ENCRYPTION_KEY="<old-key>" \
SENSITIVE_FIELD_ENCRYPTION_KEY="<new-key>" \
npm run sensitive:rotate-key -- --dry-run
```

Expected output:

- `ok: true`
- `dryRun: true`
- `modifiedDatabase: false`
- `changedRows` shows how many rows would be rewritten
- `sources.oldEncrypted` should be greater than zero before a real first rotation

If the dry run fails, do not run `--apply`.

## Apply

Run during the maintenance window:

```bash
OLD_SENSITIVE_FIELD_ENCRYPTION_KEY="<old-key>" \
SENSITIVE_FIELD_ENCRYPTION_KEY="<new-key>" \
npm run sensitive:rotate-key -- --apply
```

Expected output:

- `ok: true`
- `dryRun: false`
- `modifiedDatabase: true` if rows were changed
- `changedRows` should match or be close to the dry-run count

## Verification

After apply:

```bash
npm run sensitive:audit
npm run build
```

Then smoke test:

- Super admin login
- Create school
- Create student
- Create teacher
- Parent lookup or parent portal login if available
- Student search by exact contact where used
- Fee collection student lookup where used
- Bulk student upload with contact fields

Run the rotation dry-run again:

```bash
OLD_SENSITIVE_FIELD_ENCRYPTION_KEY="<old-key>" \
SENSITIVE_FIELD_ENCRYPTION_KEY="<new-key>" \
npm run sensitive:rotate-key -- --dry-run
```

Expected second dry-run:

- `changedRows: 0`
- encrypted field sources mostly counted under `newEncrypted`

## Cleanup

After verification:

1. Remove `OLD_SENSITIVE_FIELD_ENCRYPTION_KEY` from the server environment.
2. Keep only the new `SENSITIVE_FIELD_ENCRYPTION_KEY`.
3. Restart backend processes.
4. Run a final smoke test.

## Rollback

If rotation fails before `--apply`, keep the old production key as `SENSITIVE_FIELD_ENCRYPTION_KEY` and do not deploy the new key.

If rotation fails during `--apply`, there are two safe options:

1. Re-run the same rotation command. The script can resume because it supports both old-key and new-key encrypted rows.
2. Restore the fresh pre-rotation database backup and restart the backend with the old key.

Do not switch the backend to a key that cannot decrypt the current DB rows.

## Important Notes

- Changing `SENSITIVE_FIELD_ENCRYPTION_KEY` without running this rotation will break decryption/search for already encrypted values.
- Lookup hashes are keyed HMAC values, so they must be recomputed during rotation.
- Keep the old key only for the duration of the rotation.
- Run this first in staging before production.
