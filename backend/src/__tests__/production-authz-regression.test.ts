import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHOOL_A_ID,
  SCHOOL_ADMIN_A_ID,
  SCHOOL_B_ID,
  TEST_ATTENDANCE_RECORD_A_ID,
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

const withImportJob = async (schoolId: string, callback: () => Promise<void>) => {
  const { queues } = await import('../queues');
  const queue = queues.importQueue as any;
  const original = queue.getJob;
  queue.getJob = async (id: string) => ({
    id,
    data: { schoolId },
    getState: async () => 'completed',
    progress: 100,
    returnvalue: { imported: 1 },
    failedReason: null,
  });

  try {
    await callback();
  } finally {
    queue.getJob = original;
  }
};

test('School Admin cannot query another school BullMQ job', async () => {
  await withImportJob(SCHOOL_B_ID, async () => {
    const response = await server.request('GET', '/api/v1/jobs/import/job-school-b', {
      user: getUser('SCHOOL_ADMIN', SCHOOL_A_ID),
    });

    expectForbidden(response);
  });
});

test('School Admin can query own school BullMQ job', async () => {
  await withImportJob(SCHOOL_A_ID, async () => {
    const response = await server.request('GET', '/api/v1/jobs/import/job-school-a', {
      user: getUser('SCHOOL_ADMIN', SCHOOL_A_ID),
    });

    expectSuccess(response);
    assert.equal((response.body as { result?: { imported?: number } }).result?.imported, 1);
  });
});

test('Teacher cannot query another school BullMQ job without jobs.view', async () => {
  await withImportJob(SCHOOL_B_ID, async () => {
    const response = await server.request('GET', '/api/v1/jobs/import/job-school-b', {
      user: getUser('TEACHER', SCHOOL_A_ID),
    });

    expectForbidden(response);
  });
});

test('Teacher cannot access arbitrary user profiles', async () => {
  const response = await server.request('GET', `/api/v1/users/${SCHOOL_ADMIN_A_ID}`, {
    user: getUser('TEACHER', SCHOOL_A_ID),
  });

  expectForbidden(response);
});

test('Teacher can still access own user profile', async () => {
  const teacher = getUser('TEACHER', SCHOOL_A_ID);
  const response = await server.request('GET', `/api/v1/users/${teacher.id}`, {
    user: teacher,
  });

  expectSuccess(response);
});

test('Super Admin can still access school user profiles', async () => {
  const response = await server.request('GET', `/api/v1/users/${SCHOOL_ADMIN_A_ID}`, {
    user: getUser('SUPER_ADMIN'),
  });

  expectSuccess(response);
});

test('Attendance viewer cannot POST evidence', async () => {
  const response = await server.request('POST', '/api/v1/attendance/evidence', {
    user: getUser('TEACHER', SCHOOL_A_ID),
    body: {
      recordId: TEST_ATTENDANCE_RECORD_A_ID,
      imageUrl: 'https://cdn.test/evidence.png',
    },
  });

  expectForbidden(response);
});

test('School Admin can still POST attendance evidence', async () => {
  const response = await server.request('POST', '/api/v1/attendance/evidence', {
    user: getUser('SCHOOL_ADMIN', SCHOOL_A_ID),
    body: {
      recordId: TEST_ATTENDANCE_RECORD_A_ID,
      imageUrl: 'https://cdn.test/evidence.png',
      confidence: 0.98,
    },
  });

  expectSuccess(response);
});
