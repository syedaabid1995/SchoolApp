import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHOOL_A_ID,
  SCHOOL_B_ID,
  TEST_STUDENT_DOCUMENT_A_ID,
  TEST_STUDENT_DOCUMENT_B_ID,
  TEST_TICKET_A_ADMIN_ID,
  TEST_TICKET_A_TEACHER_ID,
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

test('School Admin lists all tickets from own school only', async () => {
  const schoolAdminA = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);

  const response = await server.request('GET', '/api/v1/tickets', {
    user: schoolAdminA,
  });

  expectSuccess(response);
  assert.ok(Array.isArray(response.body));
  const ids = response.body.map((ticket: any) => ticket.id);
  assert.deepEqual(ids.sort(), [TEST_TICKET_A_ADMIN_ID, TEST_TICKET_A_TEACHER_ID].sort());
  assert.ok(response.body.every((ticket: any) => ticket.schoolId === SCHOOL_A_ID));
});

test('Teacher lists only support tickets created by that teacher', async () => {
  const teacherA = getUser('TEACHER', SCHOOL_A_ID);

  const response = await server.request('GET', '/api/v1/tickets', {
    user: teacherA,
  });

  expectSuccess(response);
  assert.ok(Array.isArray(response.body));
  assert.deepEqual(response.body.map((ticket: any) => ticket.id), [TEST_TICKET_A_TEACHER_ID]);
});

test('Teacher cannot view another user support ticket in the same school', async () => {
  const teacherA = getUser('TEACHER', SCHOOL_A_ID);

  const response = await server.request('GET', `/api/v1/tickets/${TEST_TICKET_A_ADMIN_ID}`, {
    user: teacherA,
  });

  assert.equal(response.status, 404);
});

test('School Admin can create a school support ticket', async () => {
  const schoolAdminA = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);

  const response = await server.request('POST', '/api/v1/tickets', {
    user: schoolAdminA,
    body: {
      subject: 'Need platform support',
      description: 'Please check the school admin support issue.',
      priority: 'MEDIUM',
    },
  });

  assert.equal(response.status, 201);
  assert.equal((response.body as any).schoolId, SCHOOL_A_ID);
  assert.equal((response.body as any).createdBy?.id, schoolAdminA.id);
  assert.equal((response.body as any).status, 'OPEN');
});

test('Teacher can create a personal support ticket for the school', async () => {
  const teacherA = getUser('TEACHER', SCHOOL_A_ID);

  const response = await server.request('POST', '/api/v1/tickets', {
    user: teacherA,
    body: {
      subject: 'Attendance page help',
      description: 'Please check the teacher support issue.',
      priority: 'LOW',
    },
  });

  assert.equal(response.status, 201);
  assert.equal((response.body as any).schoolId, SCHOOL_A_ID);
  assert.equal((response.body as any).createdBy?.id, teacherA.id);
  assert.equal((response.body as any).status, 'OPEN');
});

test('School Admin cannot request a signed URL for another school asset record', async () => {
  const schoolAdminA = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);

  const response = await server.request('GET', `/api/v1/uploads/signed?type=student-document&id=${TEST_STUDENT_DOCUMENT_B_ID}`, {
    user: schoolAdminA,
  });

  expectForbidden(response);
});

test('School Admin can request a signed URL for own school asset record', async () => {
  const schoolAdminA = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);

  const response = await server.request('GET', `/api/v1/uploads/signed?type=student-document&id=${TEST_STUDENT_DOCUMENT_A_ID}`, {
    user: schoolAdminA,
  });

  assert.equal(response.status, 302);
  assert.match(response.headers.get('location') ?? '', /^https:\/\/signed\.test\//);
});

test('Super Admin can intentionally access both school-scoped signed asset records', async () => {
  const superAdmin = getUser('SUPER_ADMIN');

  const schoolA = await server.request('GET', `/api/v1/uploads/signed?type=student-document&id=${TEST_STUDENT_DOCUMENT_A_ID}`, {
    user: superAdmin,
  });
  const schoolB = await server.request('GET', `/api/v1/uploads/signed?type=student-document&id=${TEST_STUDENT_DOCUMENT_B_ID}`, {
    user: superAdmin,
  });

  assert.equal(schoolA.status, 302);
  assert.equal(schoolB.status, 302);
});
