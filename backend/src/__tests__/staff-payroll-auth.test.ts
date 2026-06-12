import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import {
  SCHOOL_B_ID,
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

test('staff management routes require authentication', async () => {
  const response = await server.request('GET', '/api/v1/staff');
  expectUnauthorized(response);
});

test('staff management routes reject Super Admin because they are School Admin scoped', async () => {
  const response = await server.request('GET', '/api/v1/staff', {
    user: getUser('SUPER_ADMIN'),
  });

  expectForbidden(response);
  assert.match(response.text, /School scope is required to manage staff/i);
});

test('staff management list allows only school roles with staff view permission', async () => {
  const teacherResponse = await server.request('GET', '/api/v1/staff', {
    user: getUser('TEACHER'),
  });
  expectSuccess(teacherResponse);
  expectNoSensitiveFields(teacherResponse.body);

  for (const role of ['PARENT', 'STUDENT'] as const) {
    const response = await server.request('GET', '/api/v1/staff', {
      user: getUser(role),
    });
    expectForbidden(response);
  }
});

test('School Admin can list staff without sensitive fields', async () => {
  const response = await server.request('GET', '/api/v1/staff?limit=20', {
    user: getUser('SCHOOL_ADMIN'),
  });

  expectSuccess(response);
  expectNoSensitiveFields(response.body);
  assert.ok(Array.isArray((response.body as { items?: unknown[] }).items));
});

test('School Admin can create department and designation inside own school scope', async () => {
  const schoolAdmin = getUser('SCHOOL_ADMIN');

  const departmentResponse = await server.request('POST', '/api/v1/staff/departments', {
    user: schoolAdmin,
    body: { name: 'Accounts' },
  });
  expectSuccess(departmentResponse);
  assert.equal((departmentResponse.body as { schoolId?: string }).schoolId, schoolAdmin.schoolId);
  expectNoSensitiveFields(departmentResponse.body);

  const designationResponse = await server.request('POST', '/api/v1/staff/designations', {
    user: schoolAdmin,
    body: { name: 'Senior Teacher' },
  });
  expectSuccess(designationResponse);
  assert.equal((designationResponse.body as { schoolId?: string }).schoolId, schoolAdmin.schoolId);
  expectNoSensitiveFields(designationResponse.body);
});

test('School Admin cannot bypass tenant scope by posting another schoolId to staff endpoints', async () => {
  const response = await server.request('POST', '/api/v1/staff/departments', {
    user: getUser('SCHOOL_ADMIN'),
    body: {
      name: 'Forged Department',
      schoolId: SCHOOL_B_ID,
    },
  });

  expectForbidden(response);
  assert.match(response.text, /Tenant scope violation/i);
});

test('staff attendance routes are School Admin scoped', async () => {
  const query = new URLSearchParams({ date: '2026-05-21' });

  const schoolAdminResponse = await server.request('GET', `/api/v1/staff/attendance?${query}`, {
    user: getUser('SCHOOL_ADMIN'),
  });
  expectSuccess(schoolAdminResponse);
  expectNoSensitiveFields(schoolAdminResponse.body);

  const teacherResponse = await server.request('GET', `/api/v1/staff/attendance?${query}`, {
    user: getUser('TEACHER'),
  });
  expectForbidden(teacherResponse);
});

test('staff attendance save rejects another schoolId in body before mutation', async () => {
  const response = await server.request('POST', '/api/v1/staff/attendance', {
    user: getUser('SCHOOL_ADMIN'),
    body: {
      schoolId: SCHOOL_B_ID,
      date: '2026-05-21',
      markHoliday: true,
      holidayReason: 'Forged holiday',
      records: [],
    },
  });

  expectForbidden(response);
  assert.match(response.text, /Tenant scope violation/i);
});

test('payroll routes are School Admin scoped and reject lower roles', async () => {
  const query = new URLSearchParams({ month: '5', year: '2026' });

  const schoolAdminResponse = await server.request('GET', `/api/v1/staff/payroll?${query}`, {
    user: getUser('SCHOOL_ADMIN'),
  });
  expectSuccess(schoolAdminResponse);
  expectNoSensitiveFields(schoolAdminResponse.body);

  for (const role of ['SUPER_ADMIN', 'TEACHER', 'PARENT', 'STUDENT'] as const) {
    const response = await server.request('GET', `/api/v1/staff/payroll?${query}`, {
      user: getUser(role),
    });
    expectForbidden(response);
  }
});

test('payroll report returns a safe school-scoped response', async () => {
  const query = new URLSearchParams({ month: '5', year: '2026' });
  const response = await server.request('GET', `/api/v1/staff/payroll/report?${query}`, {
    user: getUser('SCHOOL_ADMIN'),
  });

  expectSuccess(response);
  expectNoSensitiveFields(response.body);
  assert.ok(Array.isArray((response.body as { items?: unknown[] }).items));
});
