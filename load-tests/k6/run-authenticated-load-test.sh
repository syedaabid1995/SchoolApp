#!/usr/bin/env bash
set -euo pipefail

RUN_ID="${ACADEMIFY_RUN_ID:-auth-$(date -u +%Y%m%d-%H%M%S)}"
RESULTS_DIR="${ACADEMIFY_SUMMARY_DIR:-load-tests/k6/results}"
PROFILE="${ACADEMIFY_AUTH_PROFILE:-${ACADEMIFY_TEST_PROFILE:-realistic}}"

export ACADEMIFY_RUN_ID="$RUN_ID"
export ACADEMIFY_SUMMARY_DIR="$RESULTS_DIR"

mkdir -p "$RESULTS_DIR"

METRICS_BEFORE="$RESULTS_DIR/metrics-before-$RUN_ID.prom"
METRICS_AFTER="$RESULTS_DIR/metrics-after-$RUN_ID.prom"
SUMMARY="$RESULTS_DIR/summary-authenticated-$PROFILE-$RUN_ID.json"
CONSOLE_LOG="$RESULTS_DIR/k6-authenticated-$PROFILE-$RUN_ID.console.log"

echo "Run ID: $RUN_ID"
echo "Profile: $PROFILE"
echo "Results: $RESULTS_DIR"

if [[ "${ACADEMIFY_CAPTURE_API_METRICS:-true}" == "true" ]]; then
  node load-tests/k6/capture-api-metrics.mjs --label before --run-id "$RUN_ID" --output-dir "$RESULTS_DIR" || true
fi

K6_EXIT=0
k6 run load-tests/k6/schoolapp-authenticated-load-test.js 2>&1 | tee "$CONSOLE_LOG" || K6_EXIT=$?

if [[ "${ACADEMIFY_CAPTURE_API_METRICS:-true}" == "true" ]]; then
  node load-tests/k6/capture-api-metrics.mjs --label after --run-id "$RUN_ID" --output-dir "$RESULTS_DIR" || true
fi

REPORT_ARGS=(--summary "$SUMMARY" --run-id "$RUN_ID")
if [[ -f "$METRICS_BEFORE" && -f "$METRICS_AFTER" ]]; then
  REPORT_ARGS+=(--metrics-before "$METRICS_BEFORE" --metrics-after "$METRICS_AFTER")
fi

if [[ -f "$SUMMARY" ]]; then
  node load-tests/k6/generate-performance-report.mjs "${REPORT_ARGS[@]}"
else
  echo "k6 summary was not created: $SUMMARY" >&2
fi

exit "$K6_EXIT"
