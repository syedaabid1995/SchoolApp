import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHOOL_A_ID,
  TEST_AUDIT_LOG_ID,
  TEST_TICKET_B_ID,
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
  type TestHttpResponse,
} from './test-utils';

type ProtectedEndpoint = {
  name: string;
  method: string;
  path: string;
  body?: unknown;
};

let server: Awaited<ReturnType<typeof startTestServer>>;

const superAdminOnlyEndpoints: ProtectedEndpoint[] = [
  { name: 'dashboard summary', method: 'GET', path: '/api/v1/admin/dashboard/summary' },
  { name: 'dashboard school growth', method: 'GET', path: '/api/v1/admin/dashboard/school-growth?range=12m' },
  { name: 'dashboard revenue', method: 'GET', path: '/api/v1/admin/dashboard/revenue?range=12m' },
  { name: 'dashboard activity', method: 'GET', path: '/api/v1/admin/dashboard/activity?limit=20' },
  { name: 'dashboard support summary', method: 'GET', path: '/api/v1/admin/dashboard/support-summary' },
  { name: 'dashboard top schools', method: 'GET', path: '/api/v1/admin/dashboard/top-schools?sortBy=students&limit=10' },
  { name: 'dashboard system status', method: 'GET', path: '/api/v1/admin/dashboard/system-status' },
  { name: 'feature flags list', method: 'GET', path: '/api/v1/features/flags' },
  {
    name: 'feature flags create',
    method: 'POST',
    path: '/api/v1/features/flags',
    body: { key: 'security_test_flag', status: 'ENABLED', description: 'Security test' },
  },
  {
    name: 'config create',
    method: 'POST',
    path: '/api/v1/features/configs',
    body: { key: 'security.config', value: { enabled: true }, description: 'Security test' },
  },
  { name: 'school subscription list', method: 'GET', path: '/api/v1/admin/subscriptions' },
  {
    name: 'school subscription assign',
    method: 'POST',
    path: `/api/v1/admin/subscriptions/${SCHOOL_A_ID}/assign-plan`,
    body: { planId: 'plan-1', billingCycle: 'MONTHLY', trialDays: 0, reason: 'Security test' },
  },
  {
    name: 'legacy subscription mutation',
    method: 'POST',
    path: '/api/v1/subscriptions',
    body: { schoolId: SCHOOL_A_ID, planName: 'Premium', status: 'ACTIVE' },
  },
  { name: 'backup list', method: 'GET', path: '/api/v1/admin/backups' },
  { name: 'restore list', method: 'GET', path: '/api/v1/admin/restores' },
  { name: 'compliance summary', method: 'GET', path: '/api/v1/admin/compliance/summary' },
  { name: 'compliance exports', method: 'GET', path: '/api/v1/admin/compliance/export-requests' },
  { name: 'compliance deletions', method: 'GET', path: '/api/v1/admin/compliance/deletion-requests' },
  { name: 'support admin list', method: 'GET', path: '/api/v1/admin/support' },
  { name: 'support admin detail', method: 'GET', path: `/api/v1/admin/support/${TEST_TICKET_B_ID}` },
  { name: 'admin users list', method: 'GET', path: '/api/v1/admin/users' },
  { name: 'admin users summary', method: 'GET', path: '/api/v1/admin/users/summary' },
  { name: 'audit logs list', method: 'GET', path: '/api/v1/admin/audit-logs' },
  { name: 'audit logs summary', method: 'GET', path: '/api/v1/admin/audit-logs/summary' },
  { name: 'audit logs high-risk', method: 'GET', path: '/api/v1/admin/audit-logs/high-risk?limit=10' },
  { name: 'audit log detail', method: 'GET', path: `/api/v1/admin/audit-logs/${TEST_AUDIT_LOG_ID}` },
  {
    name: 'audit export request',
    method: 'POST',
    path: '/api/v1/admin/audit-logs/export',
    body: {
      format: 'csv',
      filters: { dateFrom: '2026-05-01', dateTo: '2026-05-20' },
      reason: 'Security regression export',
    },
  },
  { name: 'audit export history', method: 'GET', path: '/api/v1/admin/audit-exports' },
  { name: 'system health', method: 'GET', path: '/api/v1/admin/system-health' },
];

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

const call = (endpoint: ProtectedEndpoint, user?: ReturnType<typeof getUser>) =>
  server.request(endpoint.method, endpoint.path, {
    user,
    body: endpoint.body,
  });

test('Super Admin-only routes reject unauthenticated requests with 401', async () => {
  for (const endpoint of superAdminOnlyEndpoints) {
    const response = await call(endpoint);
    expectUnauthorized(response);
  }
});

test('Super Admin-only routes reject lower roles with 403', async () => {
  const lowerRoles = [
    getUser('SCHOOL_ADMIN'),
    getUser('TEACHER'),
    getUser('PARENT'),
    getUser('STUDENT'),
  ];

  for (const endpoint of superAdminOnlyEndpoints) {
    for (const user of lowerRoles) {
      const response = await call(endpoint, user);
      assert.equal(response.status, 403, `${endpoint.name} allowed ${user.role}: ${response.status} ${response.text}`);
    }
  }
});

test('Super Admin can reach representative protected routes and responses do not leak sensitive fields', async () => {
  const superAdmin = getUser('SUPER_ADMIN');
  const endpoints = [
    '/api/v1/admin/dashboard/summary',
    '/api/v1/features/flags',
    '/api/v1/admin/subscriptions',
    '/api/v1/admin/backups',
    '/api/v1/admin/compliance/summary',
    '/api/v1/admin/support',
    '/api/v1/admin/users',
    '/api/v1/admin/audit-logs',
    '/api/v1/admin/system-health',
  ];

  for (const path of endpoints) {
    const response = await server.request('GET', path, { user: superAdmin });
    assert.notEqual(response.status, 401, `${path} returned 401`);
    assert.notEqual(response.status, 403, `${path} returned 403`);
    if (response.status >= 200 && response.status < 300) {
      expectNoSensitiveFields(response.body);
    }
  }
});

test('dashboard query validation rejects invalid range and limit', async () => {
  const superAdmin = getUser('SUPER_ADMIN');

  const invalidRange = await server.request('GET', '/api/v1/admin/dashboard/school-growth?range=2y', { user: superAdmin });
  assert.equal(invalidRange.status, 400);

  const invalidLimit = await server.request('GET', '/api/v1/admin/dashboard/top-schools?sortBy=students&limit=1000', {
    user: superAdmin,
  });
  assert.equal(invalidLimit.status, 400);
});

test('feature flag config rejects string config values and accepts JSON object values for Super Admin', async () => {
  const superAdmin = getUser('SUPER_ADMIN');

  const invalid = await server.request('POST', '/api/v1/features/configs', {
    user: superAdmin,
    body: { key: 'security.invalid', value: 'plain string' },
  });
  assert.equal(invalid.status, 400);

  const valid = await server.request('POST', '/api/v1/features/configs', {
    user: superAdmin,
    body: { key: 'security.valid', value: { safe: true } },
  });
  expectSuccess(valid);
});

test('frontend legacy feature flag aliases are accepted only when not conflicting', async () => {
  const superAdmin = getUser('SUPER_ADMIN');

  const legacyPayload = await server.request('POST', '/api/v1/features/flags', {
    user: superAdmin,
    body: { code: 'legacy_flag', enabled: true, description: 'Old frontend payload' },
  });
  expectSuccess(legacyPayload);

  const conflicting = await server.request('POST', '/api/v1/features/flags', {
    user: superAdmin,
    body: { key: 'new_flag', code: 'old_flag', status: 'ENABLED', enabled: true },
  });
  assert.equal(conflicting.status, 400);
});
