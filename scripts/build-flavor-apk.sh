#!/usr/bin/env bash
# Build teacher (school-flutter) or parent (school-parents) APKs by brand flavor.
#
# Usage:
#   ./scripts/build-flavor-apk.sh teacher saapt
#   ./scripts/build-flavor-apk.sh teacher akademifyy
#   ./scripts/build-flavor-apk.sh parent saapt
#   ./scripts/build-flavor-apk.sh parent akademifyy
#
# Optional 3rd arg: debug | release (default: release)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="${1:-}"
FLAVOR="${2:-}"
MODE="${3:-release}"

usage() {
  cat <<'EOF'
Usage: ./scripts/build-flavor-apk.sh <teacher|parent> <saapt|akademifyy> [debug|release]

Examples:
  ./scripts/build-flavor-apk.sh teacher saapt
  ./scripts/build-flavor-apk.sh teacher akademifyy
  ./scripts/build-flavor-apk.sh parent saapt
  ./scripts/build-flavor-apk.sh parent akademifyy

Outputs:
  teacher/saapt       -> com.saapt.teacher
  teacher/akademifyy  -> com.akademifyy.teacher
  parent/saapt        -> com.saapt.parent
  parent/akademifyy   -> com.akademifyy.parent
EOF
}

if [[ "$APP" != "teacher" && "$APP" != "parent" ]]; then
  usage
  exit 1
fi

if [[ "$FLAVOR" != "saapt" && "$FLAVOR" != "akademifyy" ]]; then
  usage
  exit 1
fi

if [[ "$MODE" != "debug" && "$MODE" != "release" ]]; then
  usage
  exit 1
fi

if [[ "$APP" == "teacher" ]]; then
  APP_DIR="$ROOT_DIR/school-flutter"
else
  APP_DIR="$ROOT_DIR/school-parents"
fi

FLAVOR_FILE="$APP_DIR/flavors/${FLAVOR}.json"
if [[ ! -f "$FLAVOR_FILE" ]]; then
  echo "Missing flavor file: $FLAVOR_FILE" >&2
  exit 1
fi

cd "$APP_DIR"
echo "Building $APP ($FLAVOR / $MODE) from $APP_DIR"
echo "Using dart-defines: $FLAVOR_FILE"

if [[ "$MODE" == "debug" ]]; then
  flutter build apk --debug --flavor "$FLAVOR" --dart-define-from-file="$FLAVOR_FILE"
else
  flutter build apk --release --flavor "$FLAVOR" --dart-define-from-file="$FLAVOR_FILE"
fi

echo
echo "Done. APK(s) under: $APP_DIR/build/app/outputs/flutter-apk/"
ls -la "$APP_DIR/build/app/outputs/flutter-apk/"*.apk 2>/dev/null || true
