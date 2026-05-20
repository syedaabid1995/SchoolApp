import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import {
  closeBackgroundHandles,
  expectForbidden,
  expectSuccess,
  expectUnauthorized,
  getUser,
  patchSecurityTestDependencies,
  restoreSecurityTestDependencies,
  seedSecurityUsers,
  startTestServer,
  type TestHttpResponse,
} from './test-utils';

let server: Awaited<ReturnType<typeof startTestServer>>;

before(async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  server = await startTestServer();
});

beforeEach(() => {
  seedSecurityUsers();
});

afterEach(() => {
  seedSecurityUsers();
});

after(async () => {
  await server.close();
  restoreSecurityTestDependencies();
  await closeBackgroundHandles();
});

const expectNoSchoolIdOverride = (response: TestHttpResponse) => {
  expectForbidden(response);
  assert.match(response.text, /Tenant scope violation|Forbidden|Only School Admin/i);
};

test('academic setup list requires authentication', async () => {
  const response = await server.request('GET', '/api/v1/academic-setup/classes');
  expectUnauthorized(response);
});

test('academic setup rejects Super Admin because this is School Admin setup', async () => {
  const response = await server.request('GET', '/api/v1/academic-setup/classes', {
    user: getUser('SUPER_ADMIN'),
  });
  expectForbidden(response);
});

test('academic setup rejects teacher and parent roles', async () => {
  for (const role of ['TEACHER', 'PARENT', 'STUDENT'] as const) {
    const response = await server.request('GET', '/api/v1/academic-setup/classes', {
      user: getUser(role),
    });
    expectForbidden(response);
  }
});

test('School Admin can list and create school-scoped academic setup data', async () => {
  const schoolAdmin = getUser('SCHOOL_ADMIN');
  const listResponse = await server.request('GET', '/api/v1/academic-setup/classes', { user: schoolAdmin });
  expectSuccess(listResponse);

  const createResponse = await server.request('POST', '/api/v1/academic-setup/sections', {
    user: schoolAdmin,
    body: { name: 'A' },
  });
  expectSuccess(createResponse);
});

test('School Admin cannot bypass tenant by posting another schoolId', async () => {
  const response = await server.request('POST', '/api/v1/academics/classes', {
    user: getUser('SCHOOL_ADMIN'),
    body: {
      schoolId: '22222222-2222-4222-8222-222222222222',
      academicYearId: '99999999-9999-4999-8999-999999999999',
      name: 'Tenant Break',
    },
  });
  expectNoSchoolIdOverride(response);
});
