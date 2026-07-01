import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { listImports, listImportErrors } from '../controllers/import.controller';
import { listLeaveApplications } from '../controllers/leave.controller';
import { getParentResults } from '../controllers/parentPortal.controller';
import {
  decodeCursor,
  encodeCursor,
  parseLimit,
  toCursorPage,
} from '../utils/pagination';
import {
  PARENT_A_ID,
  SCHOOL_A_ID,
  SCHOOL_ADMIN_A_ID,
  SCHOOL_B_ID,
  STUDENT_A_ID,
  TEST_STAFF_PROFILE_A_ID,
  closeBackgroundHandles,
} from './test-utils';

test.after(async () => {
  await closeBackgroundHandles();
});

const patch = <T extends object, K extends keyof T>(target: T, key: K, value: T[K]) => {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
};

const makeResponse = () => {
  const response: any = {
    statusCode: 200,
    body: undefined,
    headers: new Map<string, string>(),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers.set(key, value);
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return response;
};

const importRow = (id: string, createdAt: Date) => ({
  id,
  schoolId: SCHOOL_A_ID,
  createdById: SCHOOL_ADMIN_A_ID,
  type: 'STUDENT',
  status: 'COMPLETED',
  filePath: 'local://schools/a/import.csv',
  originalName: 'import.csv',
  totalRows: 1,
  processedRows: 1,
  successCount: 1,
  errorCount: 0,
  dryRun: false,
  startedAt: null,
  finishedAt: null,
  createdAt,
  updatedAt: createdAt,
});

test('pagination helpers clamp limits and encode opaque cursors', () => {
  assert.equal(parseLimit('500', { defaultLimit: 50, maxLimit: 100 }), 100);
  assert.throws(() => parseLimit('0'), /positive integer/);

  const cursor = encodeCursor('row-1');
  assert.equal(decodeCursor(cursor), 'row-1');

  const page = toCursorPage([{ id: 'row-1' }, { id: 'row-2' }, { id: 'row-3' }], 2);
  assert.deepEqual(page.data.map((row) => row.id), ['row-1', 'row-2']);
  assert.equal(page.pageInfo.hasNextPage, true);
  assert.equal(decodeCursor(page.pageInfo.nextCursor), 'row-2');
});

test('import list is tenant-scoped, capped, cursor-paginated, and hides file paths', async () => {
  let findManyArgs: any;
  const restoreFindMany = patch(prisma.importJob as any, 'findMany', async (args: any) => {
    findManyArgs = args;
    return [
      importRow('import-1', new Date('2026-07-01T00:00:00.000Z')),
      importRow('import-2', new Date('2026-06-30T00:00:00.000Z')),
      importRow('import-3', new Date('2026-06-29T00:00:00.000Z')),
    ];
  });
  const response = makeResponse();

  try {
    await listImports({
      auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' },
      query: { limit: '2' },
    } as any, response as any);

    assert.equal(findManyArgs.where.schoolId, SCHOOL_A_ID);
    assert.equal(findManyArgs.take, 3);
    assert.equal(response.headers.get('X-Page-Limit'), '2');
    assert.equal(response.headers.get('X-Has-Next-Page'), 'true');
    assert.equal(response.body.length, 2);
    assert.equal('filePath' in response.body[0], false);
  } finally {
    restoreFindMany();
  }
});

test('import row errors verify tenant ownership before paginating child rows', async () => {
  let jobWhere: any;
  let errorArgs: any;
  const restoreJob = patch(prisma.importJob as any, 'findFirst', async ({ where }: any) => {
    jobWhere = where;
    return { id: 'import-1' };
  });
  const restoreErrors = patch(prisma.importRowError as any, 'findMany', async (args: any) => {
    errorArgs = args;
    return [
      { id: 'err-1', importJobId: 'import-1', rowNumber: 1, field: 'name', message: 'Required', rawData: null, createdAt: new Date() },
      { id: 'err-2', importJobId: 'import-1', rowNumber: 2, field: 'name', message: 'Required', rawData: null, createdAt: new Date() },
      { id: 'err-3', importJobId: 'import-1', rowNumber: 3, field: 'name', message: 'Required', rawData: null, createdAt: new Date() },
    ];
  });
  const response = makeResponse();

  try {
    await listImportErrors({
      auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' },
      params: { id: 'import-1' },
      query: { limit: '2' },
    } as any, response as any);

    assert.deepEqual(jobWhere, { id: 'import-1', schoolId: SCHOOL_A_ID });
    assert.deepEqual(errorArgs.where, { importJobId: 'import-1' });
    assert.equal(errorArgs.take, 3);
    assert.equal(response.body.length, 2);
    assert.equal(response.headers.get('X-Has-Next-Page'), 'true');
  } finally {
    restoreErrors();
    restoreJob();
  }
});

test('leave application list keeps tenant filters and applies offset pagination', async () => {
  let findManyArgs: any;
  let countArgs: any;
  const leaveApplication = {
    id: 'leave-1',
    schoolId: SCHOOL_A_ID,
    staffId: TEST_STAFF_PROFILE_A_ID,
    durationDays: 1,
    status: 'PENDING',
    staff: null,
  };
  const restoreFindMany = patch(prisma.leaveApplication as any, 'findMany', async (args: any) => {
    findManyArgs = args;
    return [leaveApplication];
  });
  const restoreCount = patch(prisma.leaveApplication as any, 'count', async (args: any) => {
    countArgs = args;
    return 21;
  });
  const response = makeResponse();

  try {
    await listLeaveApplications({
      auth: { userId: SCHOOL_ADMIN_A_ID, schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' },
      query: { page: '2', limit: '10', status: 'PENDING' },
    } as any, response as any);

    assert.equal(findManyArgs.where.schoolId, SCHOOL_A_ID);
    assert.equal(findManyArgs.where.status, 'PENDING');
    assert.equal(findManyArgs.skip, 10);
    assert.equal(findManyArgs.take, 10);
    assert.deepEqual(countArgs.where, findManyArgs.where);
    assert.equal(response.headers.get('X-Total-Count'), '21');
    assert.equal(response.body[0].duration, 1);
  } finally {
    restoreCount();
    restoreFindMany();
  }
});

test('parent portal rejects another parent child before child-table result queries run', async () => {
  const restoreParents = patch(prisma.parentProfile as any, 'findMany', async ({ where }: any = {}) =>
    where?.userId === PARENT_A_ID ? [{ id: 'parent-profile-a', userId: PARENT_A_ID }] : [],
  );
  const restoreLinks = patch(prisma.studentParent as any, 'findMany', async () => [
    {
      studentId: STUDENT_A_ID,
      student: {
        id: STUDENT_A_ID,
        firstName: 'Student',
        lastName: 'A',
        admissionNo: 'ADM-1',
        schoolId: SCHOOL_A_ID,
        classId: null,
        sectionId: null,
        class: null,
        section: null,
        school: { id: SCHOOL_A_ID, name: 'School A' },
      },
    },
  ]);
  const restoreMarks = patch(prisma.mark as any, 'findMany', async () => {
    throw new Error('marks query should not run for an unauthorized child');
  });

  try {
    await assert.rejects(
      () =>
        getParentResults({
          auth: { userId: PARENT_A_ID, schoolId: null, role: 'PARENT' },
          query: { childId: '99999999-9999-4999-8999-999999999998', schoolId: SCHOOL_B_ID },
        } as any, makeResponse() as any),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403 && /Child not linked/.test(error.message),
    );
  } finally {
    restoreMarks();
    restoreLinks();
    restoreParents();
  }
});
