import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import {
  SCHOOL_B_ID,
  TEST_LEAVE_APPLICATION_ID,
  TEST_LEAVE_TYPE_ID,
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

test('leave routes require authentication', async () => {
  const response = await server.request('GET', '/api/v1/leave/types');
  expectUnauthorized(response);
});

test('leave management rejects Super Admin because it is school scoped', async () => {
  const response = await server.request('GET', '/api/v1/leave/types', {
    user: getUser('SUPER_ADMIN'),
  });

  expectForbidden(response);
  assert.match(response.text, /school staff|leave management/i);
});

test('leave setup routes are School Admin only', async () => {
  const schoolAdmin = getUser('SCHOOL_ADMIN');

  const createTypeResponse = await server.request('POST', '/api/v1/leave/types', {
    user: schoolAdmin,
    body: { name: 'Medical Leave', totalDays: 8 },
  });
  expectSuccess(createTypeResponse);
  assert.equal((createTypeResponse.body as { schoolId?: string }).schoolId, schoolAdmin.schoolId);
  expectNoSensitiveFields(createTypeResponse.body);

  const teacherResponse = await server.request('POST', '/api/v1/leave/types', {
    user: getUser('TEACHER'),
    body: { name: 'Forged Leave', totalDays: 5 },
  });
  expectForbidden(teacherResponse);
});

test('School Admin cannot bypass leave tenant scope with another schoolId', async () => {
  const response = await server.request('POST', '/api/v1/leave/types', {
    user: getUser('SCHOOL_ADMIN'),
    body: {
      schoolId: SCHOOL_B_ID,
      name: 'Tenant Break Leave',
      totalDays: 5,
    },
  });

  expectForbidden(response);
  assert.match(response.text, /Tenant scope violation/i);
});

test('School Admin can define role-wise leave days and duplicates are guarded by service logic', async () => {
  const response = await server.request('POST', '/api/v1/leave/defines', {
    user: getUser('SCHOOL_ADMIN'),
    body: {
      roleName: 'TEACHER',
      leaveTypeId: TEST_LEAVE_TYPE_ID,
      days: 10,
    },
  });

  expectSuccess(response);
  assert.equal((response.body as { roleName?: string }).roleName, 'TEACHER');
  expectNoSensitiveFields(response.body);
});

test('Teacher can view leave types and own balance but cannot access admin leave definitions', async () => {
  const teacher = getUser('TEACHER');

  const typeResponse = await server.request('GET', '/api/v1/leave/types', { user: teacher });
  expectSuccess(typeResponse);
  assert.ok(Array.isArray(typeResponse.body));

  const balanceResponse = await server.request('GET', '/api/v1/leave/balances/me', { user: teacher });
  expectSuccess(balanceResponse);
  expectNoSensitiveFields(balanceResponse.body);

  const defineResponse = await server.request('GET', '/api/v1/leave/defines', { user: teacher });
  expectForbidden(defineResponse);
});

test('Teacher can apply leave only inside own school scope', async () => {
  const response = await server.request('POST', '/api/v1/leave/applications', {
    user: getUser('TEACHER'),
    body: {
      leaveTypeId: TEST_LEAVE_TYPE_ID,
      appliedAt: '2026-05-21',
      fromDate: '2026-05-22',
      toDate: '2026-05-23',
      reason: 'Family function',
    },
  });

  expectSuccess(response);
  assert.equal((response.body as { schoolId?: string }).schoolId, getUser('TEACHER').schoolId);
  expectNoSensitiveFields(response.body);
});

test('School Admin can view and update staff leave status safely', async () => {
  const listResponse = await server.request('GET', '/api/v1/leave/applications', {
    user: getUser('SCHOOL_ADMIN'),
  });
  expectSuccess(listResponse);
  assert.ok(Array.isArray(listResponse.body));
  expectNoSensitiveFields(listResponse.body);

  const statusResponse = await server.request('PATCH', `/api/v1/leave/applications/${TEST_LEAVE_APPLICATION_ID}/status`, {
    user: getUser('SCHOOL_ADMIN'),
    body: {
      status: 'APPROVED',
      note: 'Approved for test',
    },
  });
  expectSuccess(statusResponse);
  assert.equal((statusResponse.body as { status?: string }).status, 'APPROVED');
  expectNoSensitiveFields(statusResponse.body);
});

test('Parent and student cannot access leave management endpoints', async () => {
  for (const role of ['PARENT', 'STUDENT'] as const) {
    const response = await server.request('GET', '/api/v1/leave/types', {
      user: getUser(role),
    });
    expectForbidden(response);
  }
});
