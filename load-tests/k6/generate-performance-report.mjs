#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
const summaryPath = args.summary || args._[0];
if (!summaryPath) {
  throw new Error('Usage: node load-tests/k6/generate-performance-report.mjs --summary <summary.json>');
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const metrics = summary.metrics || {};
const setup = summary.setup_data || {};
const runId = args.runId || setup.runId || inferRunId(summaryPath);
const outputPath =
  args.output ||
  path.join(path.dirname(summaryPath), `performance-report-${runId}.md`);

const beforeMetrics = args.metricsBefore ? readPrometheus(args.metricsBefore) : null;
const afterMetrics = args.metricsAfter ? readPrometheus(args.metricsAfter) : null;
const apiMetricDelta = beforeMetrics && afterMetrics ? summarizeApiMetricDelta(beforeMetrics, afterMetrics) : null;

const totalRequests = metricNumber('http_reqs', 'count');
const successful = metricNumber('successful_requests', 'count');
const failed = metricNumber('failed_requests', 'count');
const rps = metricNumber('http_reqs', 'rate');
const failureRate = metricNumber('http_req_failed', 'rate');
const p95 = metricNumber('http_req_duration', 'p(95)');
const p99 = metricNumber('http_req_duration', 'p(99)');
const serverErrorRate = metricNumber('server_error_rate', 'rate');
const maxVus = maxTestedVus();
const stable = failureRate <= 0.05 && p95 <= 2000 && serverErrorRate <= 0.05;
const statusRows = statusDistribution();
const slowestEndpoints = endpointLatencyRows().slice(0, 5);
const thresholdFailures = collectThresholdFailures();
const bottleneck = inferBottleneck();

const report = [
  `# Academifyy Authenticated Load Test Report`,
  '',
  `Run ID: \`${runId}\``,
  `Generated: \`${new Date().toISOString()}\``,
  `Target: \`${setup.target || 'unknown'}\``,
  `Profile: \`${setup.profile || 'unknown'}\``,
  `Login strategy: \`${setup.loginStrategy || 'unknown'}\``,
  '',
  `## Executive Summary`,
  '',
  `- Maximum stable concurrent users: ${stable ? `${maxVus} VUs tested without breaching aggregate thresholds` : 'not proven by this run'}`,
  `- Maximum sustainable RPS: ${stable ? formatNumber(rps, 2) : 'not established'} req/s`,
  `- Breaking point: ${stable ? 'not reached in this run' : 'threshold breach observed; rerun stage-by-stage to pinpoint exact VU level'}`,
  `- Primary bottleneck: ${bottleneck}`,
  `- Recommended upgrade threshold: upgrade before sustained p95 exceeds 1500-2000 ms, HTTP failures exceed 5%, RAM/CPU stays above 75-80%, or BullMQ/PostgreSQL backlog grows during normal pilot traffic.`,
  '',
  `## k6 Results`,
  '',
  `| Metric | Value |`,
  `| --- | ---: |`,
  `| Total requests | ${formatNumber(totalRequests, 0)} |`,
  `| Successful requests | ${formatNumber(successful, 0)} |`,
  `| Failed requests | ${formatNumber(failed, 0)} |`,
  `| Requests/sec | ${formatNumber(rps, 2)} |`,
  `| Average latency | ${formatMs(metricNumber('http_req_duration', 'avg'))} |`,
  `| Median latency | ${formatMs(metricNumber('http_req_duration', 'med'))} |`,
  `| p90 latency | ${formatMs(metricNumber('http_req_duration', 'p(90)'))} |`,
  `| p95 latency | ${formatMs(p95)} |`,
  `| p99 latency | ${formatMs(p99)} |`,
  `| HTTP failure rate | ${formatPercent(failureRate)} |`,
  `| Server error rate | ${formatPercent(serverErrorRate)} |`,
  `| Login success rate | ${formatPercent(metricNumber('login_success_rate', 'rate'))} |`,
  `| Token refresh failures | ${formatNumber(metricNumber('token_refresh_failures', 'count'), 0)} |`,
  `| Timeout errors | ${formatNumber(metricNumber('timeout_errors', 'count'), 0)} |`,
  `| Network errors | ${formatNumber(metricNumber('network_errors', 'count'), 0)} |`,
  `| Memory-related errors | ${formatNumber(metricNumber('memory_related_errors', 'count'), 0)} |`,
  `| Data received | ${formatBytes(metricNumber('data_received', 'count'))} |`,
  `| Data sent | ${formatBytes(metricNumber('data_sent', 'count'))} |`,
  '',
  `## HTTP Status Distribution`,
  '',
  statusRows.length ? table(['Status', 'Count'], statusRows) : 'No status counters were recorded.',
  '',
  `## Top Five Slowest Endpoints`,
  '',
  slowestEndpoints.length ? table(['Endpoint', 'Avg', 'p95', 'p99', 'Count'], slowestEndpoints) : 'Endpoint latency metrics were not available.',
  '',
  `## Thresholds`,
  '',
  thresholdFailures.length
    ? thresholdFailures.map((item) => `- Failed: \`${item.metric}\` ${item.threshold}`).join('\n')
    : '- All configured k6 thresholds passed.',
  '',
  `## Server Metrics`,
  '',
  apiMetricDelta ? renderApiMetricDelta(apiMetricDelta) : '- API `/metrics` before/after snapshots were not attached to this report.',
  '- Host CPU, RAM, disk I/O, network throughput, PostgreSQL connection count, Redis memory, and Node.js event-loop delay require Hostinger/PM2/PostgreSQL/Redis monitoring because this repo does not expose them all through the public API.',
  '',
  `## Optimization Recommendations`,
  '',
  ...recommendations().map((item, index) => `${index + 1}. ${item}`),
  '',
  `## Artifacts`,
  '',
  `- k6 JSON summary: \`${summaryPath}\``,
  args.metricsBefore ? `- Metrics before: \`${args.metricsBefore}\`` : '- Metrics before: not captured',
  args.metricsAfter ? `- Metrics after: \`${args.metricsAfter}\`` : '- Metrics after: not captured',
  '',
].join('\n');

fs.writeFileSync(outputPath, report);
console.log(`Performance report: ${outputPath}`);

function metricNumber(name, valueName) {
  const value = metrics[name]?.values?.[valueName];
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function statusDistribution() {
  return Object.entries(metrics)
    .filter(([name]) => /^http_status_(\d+|other)$/.test(name))
    .map(([name, metric]) => [name.replace('http_status_', ''), formatNumber(metric.values?.count || 0, 0)])
    .filter(([, count]) => count !== '0')
    .sort(([left], [right]) => {
      if (left === 'other') return 1;
      if (right === 'other') return -1;
      return Number(left) - Number(right);
    });
}

function endpointLatencyRows() {
  const labels = {
    endpoint_post_auth_login_duration: 'POST /auth/login',
    endpoint_post_auth_refresh_duration: 'POST /auth/refresh',
    endpoint_get_users_me_duration: 'GET /users/me',
    endpoint_get_dashboard_duration: 'GET /dashboard',
    endpoint_get_students_students_duration: 'GET /students/students',
    endpoint_get_teachers_duration: 'GET /teachers',
    endpoint_get_attendance_summary_duration: 'GET /attendance-summary',
    endpoint_post_attendance_sessions_duration: 'POST /attendance/sessions',
    endpoint_patch_attendance_sessions_duration: 'PATCH /attendance/sessions/:id',
    endpoint_get_health_duration: 'GET /health',
  };

  return Object.entries(labels)
    .map(([name, label]) => {
      const values = metrics[name]?.values;
      if (!values || values.count === 0) return null;
      return {
        label,
        avg: Number(values.avg || 0),
        p95: Number(values['p(95)'] || 0),
        p99: Number(values['p(99)'] || 0),
        count: Number.isFinite(Number(values.count)) ? Number(values.count) : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.p95 - a.p95)
    .map((row) => [row.label, formatMs(row.avg), formatMs(row.p95), formatMs(row.p99), row.count === null ? 'n/a' : formatNumber(row.count, 0)]);
}

function collectThresholdFailures() {
  const failures = [];
  for (const [metricName, metric] of Object.entries(metrics)) {
    for (const [threshold, result] of Object.entries(metric.thresholds || {})) {
      if (result && result.ok === false) failures.push({ metric: metricName, threshold });
    }
  }
  return failures;
}

function maxTestedVus() {
  const fromMetric = metricNumber('vus_max', 'max') || metricNumber('vus_max', 'value');
  if (fromMetric) return Math.round(fromMetric);
  const stages = Array.isArray(setup.stages) ? setup.stages : [];
  return stages.reduce((max, stage) => Math.max(max, Number(stage.target || 0)), 0);
}

function inferBottleneck() {
  const status429 = metricNumber('http_status_429', 'count');
  const status5xx = metricNumber('http_status_class_5xx', 'count');
  const memory = metricNumber('memory_related_errors', 'count');
  const timeouts = metricNumber('timeout_errors', 'count');
  const refreshFailures = metricNumber('token_refresh_failures', 'count');
  const loginRate = metricNumber('login_success_rate', 'rate');

  if (status429 > 0 && loginRate < 0.95) return 'auth/login rate limiting from the load-generator IP';
  if (memory > 0) return 'Node.js memory pressure';
  if (status5xx > 0) return 'server-side errors; inspect API, database, Redis, and worker logs';
  if (timeouts > 0) return 'request timeout or upstream saturation';
  if (refreshFailures > 0) return 'refresh-token/session handling';
  if (p95 > 2000) return 'latency saturation; correlate with PostgreSQL, Redis, and CPU metrics';
  return apiMetricDelta ? inferBottleneckFromApiMetrics(apiMetricDelta) : 'not determined from k6-only aggregate data';
}

function inferBottleneckFromApiMetrics(delta) {
  if (delta.prismaSlowQueries > 0) return 'database slow queries';
  if (delta.redisErrors > 0) return 'Redis errors';
  if (delta.queueFailedJobs > 0) return 'BullMQ queue failures';
  return 'not indicated by available API metrics';
}

function recommendations() {
  const rows = [];
  const status429 = metricNumber('http_status_429', 'count');
  if (status429 > 0) {
    rows.push('Separate auth-throughput testing from application-capacity testing. The login IP limiter is doing its job; use distributed load generators or a staging-only auth limit increase when measuring login capacity.');
  }
  if (!apiMetricDelta) {
    rows.push('Capture `/metrics` before and after every realistic run, and collect Hostinger CPU/RAM/disk/network plus PostgreSQL and Redis metrics in parallel.');
  }
  if (slowestEndpoints[0]) {
    rows.push(`Profile and optimize the slowest endpoint first: ${slowestEndpoints[0][0]}. Check Prisma query count, missing indexes, cache hit rate, and payload size.`);
  }
  rows.push('Run each concurrency stage separately after the full run so the exact stable VU ceiling is visible without aggregate masking.');
  rows.push('Keep attendance writes limited to a dedicated test school/class/student set, and clean or archive those records after the pilot load-test window.');
  rows.push('Move worker-heavy jobs and SMTP/email processing away from the API process if queue depth or API latency rises together.');
  return rows.slice(0, 5);
}

function readPrometheus(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const samples = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{([^}]*)\})?\s+(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)$/i);
    if (!match) continue;
    samples.push({
      name: match[1],
      labels: parseLabels(match[3] || ''),
      value: Number(match[4]),
    });
  }
  return samples;
}

function parseLabels(raw) {
  if (!raw) return {};
  const labels = {};
  for (const part of raw.split(/,(?=[a-zA-Z_][a-zA-Z0-9_]*=)/)) {
    const [key, value] = part.split('=');
    labels[key] = String(value || '').replace(/^"|"$/g, '').replace(/\\"/g, '"');
  }
  return labels;
}

function summarizeApiMetricDelta(before, after) {
  return {
    httpRequests: deltaCounter(before, after, 'http_requests_total'),
    httpErrors: deltaCounter(before, after, 'http_errors_total'),
    prismaSlowQueries: deltaCounter(before, after, 'prisma_slow_queries_total'),
    prismaErrors: deltaCounter(before, after, 'prisma_query_errors_total'),
    redisErrors: deltaCounter(before, after, 'redis_errors_total'),
    authCacheMisses: deltaCounter(before, after, 'authorization_cache_misses_total'),
    authCacheHits: deltaCounter(before, after, 'authorization_cache_hits_total'),
    queueFailedJobs: sumGauge(after, 'bullmq_jobs', { status: 'failed' }),
    queueWaitingJobs: sumGauge(after, 'bullmq_jobs', { status: 'waiting' }),
    queueActiveJobs: sumGauge(after, 'bullmq_jobs', { status: 'active' }),
    queueDelayedJobs: sumGauge(after, 'bullmq_jobs', { status: 'delayed' }),
  };
}

function deltaCounter(before, after, name) {
  return Math.max(0, sumGauge(after, name) - sumGauge(before, name));
}

function sumGauge(samples, name, labels = {}) {
  return samples
    .filter((sample) => sample.name === name)
    .filter((sample) => Object.entries(labels).every(([key, value]) => sample.labels[key] === value))
    .reduce((sum, sample) => sum + sample.value, 0);
}

function renderApiMetricDelta(delta) {
  return [
    '| API metric | Value |',
    '| --- | ---: |',
    `| Backend HTTP requests delta | ${formatNumber(delta.httpRequests, 0)} |`,
    `| Backend HTTP errors delta | ${formatNumber(delta.httpErrors, 0)} |`,
    `| Prisma slow queries delta | ${formatNumber(delta.prismaSlowQueries, 0)} |`,
    `| Prisma query errors delta | ${formatNumber(delta.prismaErrors, 0)} |`,
    `| Redis errors delta | ${formatNumber(delta.redisErrors, 0)} |`,
    `| Authorization cache hits delta | ${formatNumber(delta.authCacheHits, 0)} |`,
    `| Authorization cache misses delta | ${formatNumber(delta.authCacheMisses, 0)} |`,
    `| BullMQ waiting jobs after run | ${formatNumber(delta.queueWaitingJobs, 0)} |`,
    `| BullMQ active jobs after run | ${formatNumber(delta.queueActiveJobs, 0)} |`,
    `| BullMQ delayed jobs after run | ${formatNumber(delta.queueDelayedJobs, 0)} |`,
    `| BullMQ failed jobs after run | ${formatNumber(delta.queueFailedJobs, 0)} |`,
    '',
  ].join('\n');
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function formatMs(value) {
  return `${formatNumber(value, 2)} ms`;
}

function formatPercent(value) {
  return `${formatNumber(value * 100, 2)}%`;
}

function formatNumber(value, digits) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';
  return numeric.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatBytes(bytes) {
  const numeric = Number(bytes);
  if (!Number.isFinite(numeric)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = numeric;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${formatNumber(value, unit === 0 ? 0 : 2)} ${units[unit]}`;
}

function inferRunId(filePath) {
  return path.basename(filePath).replace(/^summary-/, '').replace(/\.json$/, '');
}

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--summary') parsed.summary = argv[++index];
    else if (value === '--output') parsed.output = argv[++index];
    else if (value === '--run-id') parsed.runId = argv[++index];
    else if (value === '--metrics-before') parsed.metricsBefore = argv[++index];
    else if (value === '--metrics-after') parsed.metricsAfter = argv[++index];
    else parsed._.push(value);
  }
  return parsed;
}
