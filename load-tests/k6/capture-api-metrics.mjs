#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
const runId = args.runId || process.env.ACADEMIFY_RUN_ID || new Date().toISOString().replace(/[:.]/g, '-');
const label = args.label || 'snapshot';
const outputDir = args.outputDir || process.env.ACADEMIFY_SUMMARY_DIR || 'load-tests/k6/results';
const rawBaseUrl = process.env.ACADEMIFY_BASE_URL || process.env.BASE_URL || '';
const apiPrefix = normalizePath(process.env.ACADEMIFY_API_PREFIX || '/api/v1');
const baseUrl = stripTrailingSlash(rawBaseUrl);
const rootBaseUrl = baseUrl.endsWith(apiPrefix)
  ? stripTrailingSlash(baseUrl.slice(0, -apiPrefix.length) || baseUrl)
  : baseUrl;
const loadTestKey = process.env.ACADEMIFY_LOAD_TEST_KEY || '';

if (!rootBaseUrl) {
  throw new Error('Set ACADEMIFY_BASE_URL before capturing API metrics.');
}

await fs.mkdir(outputDir, { recursive: true });

const headers = { Accept: 'text/plain, application/json' };
if (loadTestKey) headers['x-load-test-key'] = loadTestKey;

const metricsPath = path.join(outputDir, `metrics-${label}-${runId}.prom`);
const healthPath = path.join(outputDir, `health-${label}-${runId}.json`);

await writeFetch(`${rootBaseUrl}/metrics`, metricsPath, headers);
await writeFetch(`${rootBaseUrl}/health`, healthPath, headers);

console.log(`Metrics snapshot: ${metricsPath}`);
console.log(`Health snapshot: ${healthPath}`);

async function writeFetch(url, filePath, headers) {
  const response = await fetch(url, { headers });
  const body = await response.text();
  await fs.writeFile(filePath, body);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}; wrote response to ${filePath}`);
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--label') parsed.label = argv[++index];
    else if (value === '--run-id') parsed.runId = argv[++index];
    else if (value === '--output-dir') parsed.outputDir = argv[++index];
  }
  return parsed;
}

function normalizePath(value) {
  if (!value) return '/';
  return value.startsWith('/') ? value : `/${value}`;
}

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}
