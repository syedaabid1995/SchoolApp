import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHOOL_A_ID,
  STUDENT_A_ID,
  TEST_STAFF_DOCUMENT_A_ID,
  TEST_STUDENT_DOCUMENT_A_ID,
  TEST_STUDENT_PHOTO_A_ID,
  closeBackgroundHandles,
  expectForbidden,
  expectNoSensitiveFields,
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

test('signed upload URL requires authentication', async () => {
  const response = await server.request('GET', `/api/v1/uploads/signed?key=schools/${SCHOOL_A_ID}/students/photo.png`);

  expectUnauthorized(response);
});

test('signed upload URL rejects unsafe keys', async () => {
  const schoolAdmin = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);

  const traversal = await server.request('GET', '/api/v1/uploads/signed?key=schools/../secret.env', {
    user: schoolAdmin,
  });
  const absolute = await server.request('GET', '/api/v1/uploads/signed?key=/etc/passwd', {
    user: schoolAdmin,
  });

  assert.equal(traversal.status, 400);
  assert.equal(absolute.status, 400);
  expectNoSensitiveFields(traversal.body);
  expectNoSensitiveFields(absolute.body);
});

test('signed upload URL signs authorized database-backed assets', async () => {
  const response = await server.request('GET', `/api/v1/uploads/signed?type=student-document&id=${TEST_STUDENT_DOCUMENT_A_ID}`, {
    user: getUser('SCHOOL_ADMIN', SCHOOL_A_ID),
  });

  assert.equal(response.status, 302);
  assert.match(response.headers.get('location') ?? '', /^https:\/\/signed\.test\//);
});

test('signed upload URL signs student photo records without raw keys', async () => {
  const response = await server.request('GET', `/api/v1/uploads/signed?type=student-photo&id=${TEST_STUDENT_PHOTO_A_ID}`, {
    user: getUser('SCHOOL_ADMIN', SCHOOL_A_ID),
  });

  assert.equal(response.status, 302);
  assert.match(response.headers.get('location') ?? '', /^https:\/\/signed\.test\//);
});

test('signed upload URL signs legacy scalar student photos by student record id', async () => {
  const response = await server.request('GET', `/api/v1/uploads/signed?type=student-photo&id=${STUDENT_A_ID}`, {
    user: getUser('SCHOOL_ADMIN', SCHOOL_A_ID),
  });

  assert.equal(response.status, 302);
  assert.match(response.headers.get('location') ?? '', /^https:\/\/signed\.test\//);
});

test('Teacher cannot sign staff documents without staff document permission', async () => {
  const response = await server.request('GET', `/api/v1/uploads/signed?type=staff-document&id=${TEST_STAFF_DOCUMENT_A_ID}`, {
    user: getUser('TEACHER', SCHOOL_A_ID),
  });

  expectForbidden(response);
});

test('signed upload URL does not expose AWS credentials in JSON errors', async () => {
  const schoolAdmin = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);

  const response = await server.request('GET', `/api/v1/uploads/signed?key=schools/${SCHOOL_A_ID}/students/photo.png&bucket=other-bucket`, {
    user: schoolAdmin,
  });

  assert.equal(response.status, 400);
  expectNoSensitiveFields(response.body);
  assert.doesNotMatch(response.text, /aws_secret|secret_access|AWS_SECRET|privateKey|apiKey/i);
});
