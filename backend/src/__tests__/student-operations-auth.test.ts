import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import {
  SCHOOL_A_ID,
  SCHOOL_B_ID,
  TEST_ACADEMIC_YEAR_A_ID,
  TEST_CLASS_A_ID,
  TEST_SECTION_A_ID,
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

test('student operation routes require authentication', async () => {
  const response = await server.request('GET', '/api/v1/students/groups');
  expectUnauthorized(response);
});

test('student operation routes reject Super Admin because they are School Admin scoped', async () => {
  const response = await server.request('GET', '/api/v1/students/groups', {
    user: getUser('SUPER_ADMIN'),
  });

  expectForbidden(response);
  assert.match(response.text, /Only School Admin/i);
});

test('student operation routes reject teacher, parent, and student roles', async () => {
  for (const role of ['TEACHER', 'PARENT', 'STUDENT'] as const) {
    const response = await server.request('GET', '/api/v1/students/groups', {
      user: getUser(role),
    });
    expectForbidden(response);
  }
});

test('School Admin can create group and category in own school scope', async () => {
  const schoolAdmin = getUser('SCHOOL_ADMIN');

  const groupResponse = await server.request('POST', '/api/v1/students/groups', {
    user: schoolAdmin,
    body: {
      name: 'Day Scholar',
    },
  });
  expectSuccess(groupResponse);
  assert.equal((groupResponse.body as { schoolId?: string }).schoolId, SCHOOL_A_ID);
  expectNoSensitiveFields(groupResponse.body);

  const categoryResponse = await server.request('POST', '/api/v1/students/categories', {
    user: schoolAdmin,
    body: {
      name: 'General',
    },
  });
  expectSuccess(categoryResponse);
  assert.equal((categoryResponse.body as { schoolId?: string }).schoolId, SCHOOL_A_ID);
  expectNoSensitiveFields(categoryResponse.body);
});

test('School Admin cannot create group or category with another schoolId in body', async () => {
  const groupResponse = await server.request('POST', '/api/v1/students/groups', {
    user: getUser('SCHOOL_ADMIN'),
    body: {
      name: 'Forged Group',
      schoolId: SCHOOL_B_ID,
    },
  });
  expectForbidden(groupResponse);
  assert.match(groupResponse.text, /Tenant scope violation/i);

  const categoryResponse = await server.request('POST', '/api/v1/students/categories', {
    user: getUser('SCHOOL_ADMIN'),
    body: {
      name: 'Forged Category',
      schoolId: SCHOOL_B_ID,
    },
  });
  expectForbidden(categoryResponse);
  assert.match(categoryResponse.text, /Tenant scope violation/i);
});

test('School Admin can load attendance for own academic session, class, and section', async () => {
  const query = new URLSearchParams({
    academicSessionId: TEST_ACADEMIC_YEAR_A_ID,
    classId: TEST_CLASS_A_ID,
    sectionId: TEST_SECTION_A_ID,
    date: '2026-05-21',
  });
  const response = await server.request('GET', `/api/v1/students/attendance?${query}`, {
    user: getUser('SCHOOL_ADMIN'),
  });

  expectSuccess(response);
  expectNoSensitiveFields(response.body);
  assert.equal((response.body as { date?: string }).date, '2026-05-21');
});

test('attendance save succeeds for own school scope', async () => {
  const response = await server.request('POST', '/api/v1/students/attendance', {
    user: getUser('SCHOOL_ADMIN'),
    body: {
      academicSessionId: TEST_ACADEMIC_YEAR_A_ID,
      classId: TEST_CLASS_A_ID,
      sectionId: TEST_SECTION_A_ID,
      date: '2026-05-21',
      markHoliday: true,
      holidayReason: 'Local holiday',
      records: [],
    },
  });

  expectSuccess(response);
  expectNoSensitiveFields(response.body);
  assert.equal((response.body as { saved?: number }).saved, 0);
});

test('attendance save rejects another schoolId in body before mutation', async () => {
  const response = await server.request('POST', '/api/v1/students/attendance', {
    user: getUser('SCHOOL_ADMIN'),
    body: {
      schoolId: SCHOOL_B_ID,
      academicSessionId: TEST_ACADEMIC_YEAR_A_ID,
      classId: TEST_CLASS_A_ID,
      sectionId: TEST_SECTION_A_ID,
      date: '2026-05-21',
      markHoliday: true,
      holidayReason: 'Forged school holiday',
      records: [],
    },
  });

  expectForbidden(response);
  assert.match(response.text, /Tenant scope violation/i);
});
