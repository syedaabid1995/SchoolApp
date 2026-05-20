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

test('Student Information list requires authentication', async () => {
  const response = await server.request('GET', '/api/v1/students/students');
  expectUnauthorized(response);
});

test('Student Information rejects Super Admin because it is School Admin scoped', async () => {
  const response = await server.request('GET', '/api/v1/students/students', {
    user: getUser('SUPER_ADMIN'),
  });

  expectForbidden(response);
  assert.match(response.text, /Only School Admin/i);
});

test('Student Information rejects teacher, parent, and student roles', async () => {
  for (const role of ['TEACHER', 'PARENT', 'STUDENT'] as const) {
    const response = await server.request('GET', '/api/v1/students/students', {
      user: getUser(role),
    });
    expectForbidden(response);
  }
});

test('School Admin can list own-school student records without sensitive fields', async () => {
  const response = await server.request('GET', '/api/v1/students/students', {
    user: getUser('SCHOOL_ADMIN'),
  });

  expectSuccess(response);
  expectNoSensitiveFields(response.body);
});

test('School Admin cannot use query schoolId to read another school students', async () => {
  const response = await server.request('GET', `/api/v1/students/students?schoolId=${SCHOOL_B_ID}`, {
    user: getUser('SCHOOL_ADMIN'),
  });

  expectForbidden(response);
  assert.match(response.text, /Tenant scope violation|Only School Admin/i);
});

test('School Admin cannot use body schoolId to create students in another school', async () => {
  const response = await server.request('POST', '/api/v1/students/students', {
    user: getUser('SCHOOL_ADMIN'),
    body: {
      schoolId: SCHOOL_B_ID,
      admissionNo: 'ADM-OTHER-SCHOOL',
      fullName: 'Tenant Break Student',
      academicSessionId: '99999999-9999-4999-8999-999999999999',
      classId: 'class-a',
      sectionId: 'section-a',
      rollNo: '1',
    },
  });

  expectForbidden(response);
  assert.match(response.text, /Tenant scope violation/i);
});

