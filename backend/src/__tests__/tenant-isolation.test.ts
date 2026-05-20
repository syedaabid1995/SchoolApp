import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHOOL_A_ID,
  SCHOOL_B_ID,
  TEST_TICKET_B_ID,
  closeBackgroundHandles,
  expectForbidden,
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

test('School Admin cannot use query schoolId to read another school audit logs', async () => {
  const schoolAdminA = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);

  const response = await server.request('GET', `/api/v1/audit-logs?schoolId=${SCHOOL_B_ID}`, {
    user: schoolAdminA,
  });

  expectForbidden(response);
});

test('School Admin cannot use query schoolId to read another school theme', async () => {
  const schoolAdminA = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);

  const response = await server.request('GET', `/api/v1/themes?schoolId=${SCHOOL_B_ID}`, {
    user: schoolAdminA,
  });

  expectForbidden(response);
});

test('School Admin can read own school theme when route is school-scoped', async () => {
  const schoolAdminA = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);

  const response = await server.request('GET', `/api/v1/themes?schoolId=${SCHOOL_A_ID}`, {
    user: schoolAdminA,
  });

  expectSuccess(response);
});

test('School Admin cannot view another school support ticket', async () => {
  const schoolAdminA = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);

  const response = await server.request('GET', `/api/v1/tickets/${TEST_TICKET_B_ID}`, {
    user: schoolAdminA,
  });

  assert.ok([403, 404].includes(response.status), `Expected tenant block, got ${response.status}: ${response.text}`);
});

test('School Admin cannot add comments to another school support ticket or override comment schoolId', async () => {
  const schoolAdminA = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);

  const response = await server.request('POST', `/api/v1/tickets/${TEST_TICKET_B_ID}/comments`, {
    user: schoolAdminA,
    body: {
      schoolId: SCHOOL_B_ID,
      body: 'This should not cross tenants',
      isInternal: false,
    },
  });

  assert.ok([403, 404].includes(response.status), `Expected tenant block, got ${response.status}: ${response.text}`);
});

test('School Admin cannot request a signed URL for another school path', async () => {
  const schoolAdminA = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);

  const response = await server.request('GET', `/api/v1/uploads/signed?key=schools/${SCHOOL_B_ID}/students/photo.png`, {
    user: schoolAdminA,
  });

  expectForbidden(response);
});

test('School Admin can request a signed URL for own school path', async () => {
  const schoolAdminA = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);

  const response = await server.request('GET', `/api/v1/uploads/signed?key=schools/${SCHOOL_A_ID}/students/photo.png`, {
    user: schoolAdminA,
  });

  assert.equal(response.status, 302);
  assert.match(response.headers.get('location') ?? '', /^https:\/\/signed\.test\//);
});

test('Super Admin can intentionally access both school-scoped signed URL paths', async () => {
  const superAdmin = getUser('SUPER_ADMIN');

  const schoolA = await server.request('GET', `/api/v1/uploads/signed?key=schools/${SCHOOL_A_ID}/students/photo.png`, {
    user: superAdmin,
  });
  const schoolB = await server.request('GET', `/api/v1/uploads/signed?key=schools/${SCHOOL_B_ID}/students/photo.png`, {
    user: superAdmin,
  });

  assert.equal(schoolA.status, 302);
  assert.equal(schoolB.status, 302);
});
