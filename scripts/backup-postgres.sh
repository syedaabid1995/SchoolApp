#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/backup-postgres.sh [--output-dir <dir>] [--dry-run] [--allow-production]

Creates a PostgreSQL custom-format dump using DATABASE_URL without printing the URL.

Environment:
  DATABASE_URL   Required PostgreSQL URL.
  BACKUP_DIR     Optional output directory. Defaults to ./tmp/backups.
  NODE_ENV       If production, --allow-production is required.

Options:
  --output-dir <dir>      Override BACKUP_DIR.
  --dry-run               Validate tools/env and show the target path without running pg_dump.
  --allow-production      Allow running when NODE_ENV=production.
  -h, --help              Show this help.
EOF
}

dry_run=false
allow_production=false
output_dir="${BACKUP_DIR:-./tmp/backups}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output-dir)
      output_dir="${2:-}"
      shift 2
      ;;
    --dry-run)
      dry_run=true
      shift
      ;;
    --allow-production)
      allow_production=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

if [[ "${NODE_ENV:-}" == "production" && "$allow_production" != "true" ]]; then
  echo "Refusing production backup without --allow-production. Prefer a reviewed maintenance runbook." >&2
  exit 1
fi

command -v node >/dev/null 2>&1 || { echo "node is required to parse DATABASE_URL safely." >&2; exit 1; }
command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump is required and was not found on PATH." >&2; exit 1; }

eval "$(node <<'NODE'
const raw = process.env.DATABASE_URL;
const url = new URL(raw);
const quote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
console.log(`export PGHOST=${quote(url.hostname)}`);
console.log(`export PGPORT=${quote(url.port || '5432')}`);
console.log(`export PGDATABASE=${quote(url.pathname.replace(/^\//, ''))}`);
console.log(`export PGUSER=${quote(decodeURIComponent(url.username))}`);
console.log(`export PGPASSWORD=${quote(decodeURIComponent(url.password))}`);
console.log(`export MASKED_DATABASE_URL=${quote(`${url.protocol}//<credentials>@${url.host}/<database>`)}`);
NODE
)"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$output_dir"
chmod 700 "$output_dir"
backup_file="${output_dir%/}/academify-postgres-${timestamp}.dump"

echo "Backup source: $MASKED_DATABASE_URL"
echo "Backup output: $backup_file"

if [[ "$dry_run" == "true" ]]; then
  echo "Dry run only. pg_dump was not executed."
  exit 0
fi

tmp_file="${backup_file}.tmp"
rm -f "$tmp_file"

pg_dump --format=custom --no-owner --no-privileges --file "$tmp_file"
chmod 600 "$tmp_file"
mv "$tmp_file" "$backup_file"

echo "Backup complete: $backup_file"
