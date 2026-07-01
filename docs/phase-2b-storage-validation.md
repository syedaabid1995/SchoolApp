# Phase 2B Storage Validation And Legacy File Migration

Phase 2B validates runtime storage and adds safe tooling for finding and migrating legacy local file references.

## Storage Validation

Local driver validation:

```sh
STORAGE_DRIVER=local npm --prefix backend run storage:validate
```

The command uploads a small object under `system/storage-validation/`, generates a signed download URL, reads the object back, and deletes it. It does not print credentials or full signed URLs.

S3-compatible validation pattern:

```sh
STORAGE_DRIVER=s3 \
S3_ENDPOINT=https://example-object-store.local \
S3_REGION=us-east-1 \
S3_BUCKET=academify-private \
S3_ACCESS_KEY_ID=replace_me \
S3_SECRET_ACCESS_KEY=replace_me \
S3_FORCE_PATH_STYLE=true \
npm --prefix backend run storage:validate
```

Provider notes:

- AWS S3: leave `S3_ENDPOINT` empty, set the AWS region, bucket, access key, and secret key.
- Cloudflare R2: set `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, use `S3_REGION=auto`, and usually set `S3_FORCE_PATH_STYLE=true`.
- DigitalOcean Spaces: set `S3_ENDPOINT=https://<region>.digitaloceanspaces.com`, set `S3_REGION=<region>`, and usually set `S3_FORCE_PATH_STYLE=false`.
- MinIO: set `S3_ENDPOINT` to the MinIO API URL and `S3_FORCE_PATH_STYLE=true`.

For `NODE_ENV=production`, the validation command refuses to run unless `--allow-production` is passed intentionally:

```sh
NODE_ENV=production npm --prefix backend run storage:validate -- --allow-production
```

That command writes and deletes only the validation object. Do not point it at production credentials unless that is the object store you intend to validate.

The command reports only a signed URL summary. Do not copy full signed URLs, S3 access keys, secret keys, or provider tokens into tickets, logs, or docs.

## MinIO Local Validation

The prod-lite compose file includes an optional `storage` profile. It does not run during normal app startup. Phase 2C also adds separate `backend-api`, `backend-worker`, and `backend-scheduler` services; the MinIO profile remains optional.

Start MinIO only:

```sh
docker compose -f docker-compose.prod-lite.yml --profile storage up -d minio minio-init
```

Backend containers can use:

```text
STORAGE_DRIVER=s3
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_BUCKET=academify-local
S3_ACCESS_KEY_ID=<MINIO_ROOT_USER>
S3_SECRET_ACCESS_KEY=<MINIO_ROOT_PASSWORD>
S3_FORCE_PATH_STYLE=true
```

When running the backend outside Docker against the same MinIO instance, use `S3_ENDPOINT=http://localhost:9000`.

## Legacy Reference Audit

Read-only audit:

```sh
npm --prefix backend run storage:audit-legacy
```

Optional filters:

```sh
npm --prefix backend run storage:audit-legacy -- --school-id <school-id> --limit 100
```

The audit checks known file fields for `/uploads/`, `uploads/`, `backend/uploads`, `local://`, old export paths, and backup paths. It reports counts by model, field, school, and reference type. It masks examples and does not print file contents.

## Legacy Migration Dry Run

Dry-run is the default:

```sh
npm --prefix backend run storage:migrate-legacy
```

Recommended scoped dry-run:

```sh
npm --prefix backend run storage:migrate-legacy -- --school-id <school-id> --limit 50 --only-existing-files
```

Supported filters:

```text
--school-id <id>
--limit <n>
--category uploads|homework|imports|exports|audit-exports|backups|student-transfers|tmp
--only-existing-files
--strict-missing
```

Dry-run does not upload objects, update database rows, delete local files, or write a manifest.

## Applying A Migration

Apply only against a reviewed local/dev database first:

```sh
npm --prefix backend run storage:migrate-legacy -- --apply --school-id <school-id> --limit 50 --only-existing-files
```

Apply behavior:

- Resolves files only under known legacy upload roots.
- Blocks path traversal.
- Uploads each file to tenant-scoped runtime storage.
- Updates the matching DB field only if the old reference is still unchanged.
- Writes a local JSONL manifest under `backend/storage/migration-manifests/`.
- Does not delete old local files.

Missing local files are reported and skipped unless `--strict-missing` is passed.

## Rollback

Before any production migration:

1. Take a database backup.
2. Preserve the legacy local upload directory.
3. Run a scoped dry-run and save the output.
4. Apply in small batches by school.
5. Keep the generated manifest.

If a migration is wrong, restore the affected DB fields from the database backup or the manifest, then remove newly uploaded objects manually after verification. The Phase 2B script intentionally does not delete legacy local files.

## Production Rules

Do not:

- Run `--apply` for the first time on production.
- Run with production credentials unless validating that exact object store.
- Re-enable broad public `/uploads` static serving.
- Print or share full signed URLs.
- Delete old local files until every DB reference has been verified.

If validation fails:

1. Confirm `STORAGE_DRIVER=s3` and the provider endpoint/region/path-style combination.
2. Confirm the bucket exists and is private.
3. Confirm credentials can `PutObject`, `GetObject`, and `DeleteObject` only for the expected bucket or prefix.
4. Check server clock skew if signed URL generation succeeds but reads fail.
5. Re-run in staging before trying production credentials again.
6. Do not enable public bucket reads as a workaround.

## Disabling Legacy Local Reads

`STORAGE_LEGACY_LOCAL_UPLOADS_READ_ENABLED` allows signed local reads of old `/uploads` files when using the local storage driver. It is disabled by default in production compose config.

It is safe to disable after:

- `storage:audit-legacy` reports no migratable legacy local references.
- signed file access has been tested for student, staff, homework, fee, import/export, audit export, and backup paths.
- old local upload directories are archived outside the app runtime.
