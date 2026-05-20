import test from 'node:test';
import {
  SCHOOL_ADMIN_A_ID,
  TEST_AUDIT_LOG_ID,
  TEST_TICKET_B_ID,
  closeBackgroundHandles,
  expectNoSensitiveFields,
  expectSuccess,
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

test('common Super Admin API responses do not expose sensitive fields', async () => {
  const superAdmin = getUser('SUPER_ADMIN');
  const endpoints = [
    `/api/v1/admin/users`,
    `/api/v1/admin/users/${SCHOOL_ADMIN_A_ID}`,
    `/api/v1/admin/audit-logs/${TEST_AUDIT_LOG_ID}`,
    `/api/v1/admin/system-health`,
    `/api/v1/admin/backups`,
    `/api/v1/admin/support/${TEST_TICKET_B_ID}`,
    `/api/v1/admin/compliance/summary`,
    `/api/v1/admin/compliance/export-requests`,
    `/api/v1/admin/subscriptions`,
  ];

  for (const path of endpoints) {
    const response = await server.request('GET', path, { user: superAdmin });
    expectSuccess(response);
    expectNoSensitiveFields(response.body);
  }
});

test('public login branding response contains only safe public branding data', async () => {
  const response = await server.request('GET', '/api/v1/public/branding/login?schoolCode=SCHA');

  expectSuccess(response);
  expectNoSensitiveFields(response.body);
});
