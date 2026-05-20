import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TEST_AUDIT_LOG_ID,
  TEST_EXPORT_ID,
  closeBackgroundHandles,
  expectForbidden,
  expectNoSensitiveFields,
  expectSuccess,
  expectUnauthorized,
  getUser,
  patchSecurityTestDependencies,
  restoreSecurityTestDependencies,
  seedSecurityUsers,
  startTestServer,
} from './test-utils';

let server: Awaited<ReturnType<typeof startTestServer>>;

test.beforeEach(async () => {
  seedSecurityUsers();
  patchSecurityTestDependencies();
  server = await startTestServer();
});

test.afterEach(async () => {
  await server.close();
  restoreSecurityTestDependencies();
});

test.after(async () => {
  await closeBackgroundHandles();
});

test('global audit logs require Super Admin', async () => {
  const unauthenticated = await server.request('GET', '/api/v1/admin/audit-logs');
  expectUnauthorized(unauthenticated);

  const schoolAdmin = await server.request('GET', '/api/v1/admin/audit-logs', {
    user: getUser('SCHOOL_ADMIN'),
  });
  expectForbidden(schoolAdmin);

  const superAdmin = await server.request('GET', '/api/v1/admin/audit-logs', {
    user: getUser('SUPER_ADMIN'),
  });
  expectSuccess(superAdmin);
  expectNoSensitiveFields(superAdmin.body);
});

test('audit detail sanitizes sensitive metadata', async () => {
  const response = await server.request('GET', `/api/v1/admin/audit-logs/${TEST_AUDIT_LOG_ID}`, {
    user: getUser('SUPER_ADMIN'),
  });

  expectSuccess(response);
  assert.match(response.text, /\[REDACTED\]/);
  assert.doesNotMatch(response.text, /must-redact/);
  expectNoSensitiveFields(response.body);
});

test('audit export requires reason and Super Admin role', async () => {
  const payload = {
    format: 'csv',
    filters: { dateFrom: '2026-05-01', dateTo: '2026-05-20' },
  };

  const lowerRole = await server.request('POST', '/api/v1/admin/audit-logs/export', {
    user: getUser('SCHOOL_ADMIN'),
    body: { ...payload, reason: 'Should be forbidden' },
  });
  expectForbidden(lowerRole);

  const missingReason = await server.request('POST', '/api/v1/admin/audit-logs/export', {
    user: getUser('SUPER_ADMIN'),
    body: payload,
  });
  assert.equal(missingReason.status, 400);
});

test('audit export rejects too-large date ranges', async () => {
  const response = await server.request('POST', '/api/v1/admin/audit-logs/export', {
    user: getUser('SUPER_ADMIN'),
    body: {
      format: 'json',
      filters: { dateFrom: '2025-01-01', dateTo: '2026-05-20' },
      reason: 'Too large range',
    },
  });

  assert.equal(response.status, 400);
});

test('audit export output is sanitized and completed exports can be downloaded', async () => {
  const exportResponse = await server.request('POST', '/api/v1/admin/audit-logs/export', {
    user: getUser('SUPER_ADMIN'),
    body: {
      format: 'json',
      filters: { dateFrom: '2026-05-01', dateTo: '2026-05-20' },
      reason: 'Security review',
    },
  });

  expectSuccess(exportResponse);
  expectNoSensitiveFields(exportResponse.body);

  const download = await server.request('GET', `/api/v1/admin/audit-exports/${TEST_EXPORT_ID}/download`, {
    user: getUser('SUPER_ADMIN'),
  });

  expectSuccess(download);
  assert.match(download.text, /\[REDACTED\]/);
  assert.doesNotMatch(download.text, /must-redact/);
});
