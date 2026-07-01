#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/restore-postgres-drill.sh --backup-file <file> [--apply] [--allow-production-target] [--confirm-production-restore=I_UNDERSTAND_THIS_CAN_OVERWRITE_PRODUCTION]

Defaults to dry-run mode by listing the backup contents with pg_restore --list.
Apply mode restores into RESTORE_DATABASE_URL and is intended only for disposable local/staging databases.

Environment:
  RESTORE_DATABASE_URL   Required only with --apply.
  RESTORE_TARGET_CLASS   local|staging|production. Defaults to local.
  NODE_ENV               production also requires the dangerous production confirmation flags.

Options:
  --backup-file <file>   Required PostgreSQL custom-format dump.
  --apply                Actually run pg_restore against RESTORE_DATABASE_URL.
  --allow-production-target
                         Required for production-class targets.
  --confirm-production-restore=I_UNDERSTAND_THIS_CAN_OVERWRITE_PRODUCTION
                         Required with --allow-production-target for production-class targets.
  -h, --help             Show this help.
EOF
}

backup_file=""
apply=false
allow_production_target=false
confirm_production_restore=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup-file)
      backup_file="${2:-}"
      shift 2
      ;;
    --apply)
      apply=true
      shift
      ;;
    --allow-production-target)
      allow_production_target=true
      shift
      ;;
    --confirm-production-restore=*)
      confirm_production_restore="${1#*=}"
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

if [[ -z "$backup_file" || ! -f "$backup_file" ]]; then
  echo "--backup-file must point to an existing dump file." >&2
  exit 1
fi

command -v node >/dev/null 2>&1 || { echo "node is required to parse RESTORE_DATABASE_URL safely." >&2; exit 1; }
command -v pg_restore >/dev/null 2>&1 || { echo "pg_restore is required and was not found on PATH." >&2; exit 1; }

target_class="${RESTORE_TARGET_CLASS:-local}"
if [[ "$target_class" != "local" && "$target_class" != "staging" && "$target_class" != "production" ]]; then
  echo "RESTORE_TARGET_CLASS must be local, staging, or production." >&2
  exit 1
fi

production_like=false
if [[ "$target_class" == "production" || "${NODE_ENV:-}" == "production" ]]; then
  production_like=true
fi

if [[ "$apply" != "true" ]]; then
  echo "Dry run only. Listing backup contents; no database will be modified."
  pg_restore --list "$backup_file" >/dev/null
  echo "Backup file is readable by pg_restore: $backup_file"
  exit 0
fi

if [[ -z "${RESTORE_DATABASE_URL:-}" ]]; then
  echo "RESTORE_DATABASE_URL is required with --apply." >&2
  exit 1
fi

if [[ -n "${DATABASE_URL:-}" && "$RESTORE_DATABASE_URL" == "$DATABASE_URL" ]]; then
  echo "Refusing restore because RESTORE_DATABASE_URL equals DATABASE_URL. Use a disposable drill database." >&2
  exit 1
fi

if [[ "$production_like" == "true" ]]; then
  if [[ "$allow_production_target" != "true" || "$confirm_production_restore" != "I_UNDERSTAND_THIS_CAN_OVERWRITE_PRODUCTION" ]]; then
    echo "Refusing production-class restore without explicit dangerous confirmation flags." >&2
    exit 1
  fi
fi

eval "$(node <<'NODE'
const raw = process.env.RESTORE_DATABASE_URL;
const url = new URL(raw);
const quote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
console.log(`export PGHOST=${quote(url.hostname)}`);
console.log(`export PGPORT=${quote(url.port || '5432')}`);
console.log(`export PGDATABASE=${quote(url.pathname.replace(/^\//, ''))}`);
console.log(`export PGUSER=${quote(decodeURIComponent(url.username))}`);
console.log(`export PGPASSWORD=${quote(decodeURIComponent(url.password))}`);
console.log(`export MASKED_RESTORE_DATABASE_URL=${quote(`${url.protocol}//<credentials>@${url.host}/<database>`)}`);
NODE
)"

echo "Restore target: $MASKED_RESTORE_DATABASE_URL"
echo "Restore class: $target_class"
echo "Backup file: $backup_file"

pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$PGDATABASE" "$backup_file"

echo "Restore drill complete."
