import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHOOL_A_ID,
  closeBackgroundHandles,
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

test('signed upload URL does not expose AWS credentials in JSON errors', async () => {
  const schoolAdmin = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);

  const response = await server.request('GET', `/api/v1/uploads/signed?key=schools/${SCHOOL_A_ID}/students/photo.png&bucket=other-bucket`, {
    user: schoolAdmin,
  });

  assert.equal(response.status, 400);
  expectNoSensitiveFields(response.body);
  assert.doesNotMatch(response.text, /aws_secret|secret_access|AWS_SECRET|privateKey|apiKey/i);
});
