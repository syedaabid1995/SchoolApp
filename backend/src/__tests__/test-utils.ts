import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { redis } from '../config/redis';
import * as s3Service from '../services/s3.service';

export const SCHOOL_A_ID = '11111111-1111-4111-8111-111111111111';
export const SCHOOL_B_ID = '22222222-2222-4222-8222-222222222222';
export const SUPER_ADMIN_ID = '33333333-3333-4333-8333-333333333333';
export const SCHOOL_ADMIN_A_ID = '44444444-4444-4444-8444-444444444444';
export const SCHOOL_ADMIN_B_ID = '55555555-5555-4555-8555-555555555555';
export const TEACHER_A_ID = '66666666-6666-4666-8666-666666666666';
export const PARENT_A_ID = '77777777-7777-4777-8777-777777777777';
export const STUDENT_A_ID = '88888888-8888-4888-8888-888888888888';
export const TEST_TICKET_B_ID = '99999999-9999-4999-8999-999999999999';
export const TEST_AUDIT_LOG_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const TEST_EXPORT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

type TestRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT' | 'ACCOUNTANT' | 'LIBRARIAN' | 'STAFF';

type TestUser = {
  id: string;
  email: string;
  schoolId: string | null;
  role: TestRole;
  status?: string;
  mfaEnabled?: boolean;
};

type TestServer = {
  baseUrl: string;
  request: (method: string, path: string, options?: RequestOptions) => Promise<TestHttpResponse>;
  close: () => Promise<void>;
};

type RequestOptions = {
  user?: TestUser;
  body?: unknown;
  headers?: Record<string, string>;
  redirect?: RequestRedirect;
};

export type TestHttpResponse = {
  status: number;
  headers: Headers;
  body: unknown;
  text: string;
};

const users = new Map<string, TestUser>();
let restoreFns: Array<() => void> = [];
let auditExports: any[] = [];
let originalNodeEnv: typeof env.NODE_ENV | null = null;

const defaultPermissionCodes = [
  'dashboard.overview',
  'plans.view',
  'settings.access',
  'teachers.list',
  'teachers.add',
  'academics.setup',
  'academic.class.view',
  'academic.class.create',
  'academic.class.edit',
  'academic.class.delete',
  'academic.section.view',
  'academic.section.create',
  'academic.section.edit',
  'academic.section.delete',
  'academic.subject.view',
  'academic.subject.create',
  'academic.subject.edit',
  'academic.subject.delete',
  'academic.room.view',
  'academic.room.create',
  'academic.room.edit',
  'academic.room.delete',
  'academic.time.view',
  'academic.time.create',
  'academic.time.edit',
  'academic.time.delete',
  'academic.assign_subject.view',
  'academic.assign_subject.create',
  'academic.assign_subject.edit',
  'academic.assign_subject.delete',
  'academic.class_teacher.view',
  'academic.class_teacher.create',
  'academic.class_teacher.edit',
  'academic.class_teacher.delete',
  'academic.routine.view',
  'academic.routine.create',
  'academic.routine.edit',
  'academic.routine.delete',
  'academics.exams',
  'academics.marks',
  'students.list',
  'students.add',
  'student.view',
  'student.create',
  'student.edit',
  'student.delete',
  'student.import',
  'student.document.view',
  'student.document.create',
  'student.document.delete',
  'student.timeline.view',
  'student.timeline.create',
  'student.timeline.delete',
  'idcards.view',
  'students.transfers',
  'attendance.view',
  'attendance.substitute.manage',
  'support.view',
  'audit.view',
];

export const createTestUser = (role: TestRole, schoolId?: string | null): TestUser => {
  const id =
    role === 'SUPER_ADMIN'
      ? SUPER_ADMIN_ID
      : role === 'SCHOOL_ADMIN' && schoolId === SCHOOL_B_ID
        ? SCHOOL_ADMIN_B_ID
        : role === 'SCHOOL_ADMIN'
          ? SCHOOL_ADMIN_A_ID
          : role === 'TEACHER'
            ? TEACHER_A_ID
            : role === 'PARENT'
              ? PARENT_A_ID
              : STUDENT_A_ID;
  const user = {
    id,
    email: `${role.toLowerCase().replace(/_/g, '-')}-${schoolId ?? 'global'}@test.local`,
    role,
    schoolId: role === 'SUPER_ADMIN' ? null : schoolId === undefined ? SCHOOL_A_ID : schoolId,
    status: 'ACTIVE',
    mfaEnabled: ['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(role),
  };
  users.set(user.id, user);
  return user;
};

export const seedSecurityUsers = () => {
  users.clear();
  createTestUser('SUPER_ADMIN', null);
  createTestUser('SCHOOL_ADMIN', SCHOOL_A_ID);
  createTestUser('SCHOOL_ADMIN', SCHOOL_B_ID);
  createTestUser('TEACHER', SCHOOL_A_ID);
  createTestUser('PARENT', SCHOOL_A_ID);
  createTestUser('STUDENT', SCHOOL_A_ID);
};

export const createJwtForUser = (user: TestUser) =>
  jwt.sign(
    {
      sub: user.id,
      typ: 'access',
      schoolId: user.schoolId,
      role: user.role,
    },
    env.JWT_SECRET,
    { expiresIn: '15m' },
  );

export const createAuthHeaders = (user: TestUser) => ({
  Authorization: `Bearer ${createJwtForUser(user)}`,
});

const patchMethod = <T extends object, K extends keyof T>(target: T, key: K, value: T[K]) => {
  const original = target[key];
  target[key] = value;
  restoreFns.push(() => {
    target[key] = original;
  });
};

const schoolFor = (id: string | null | undefined) => {
  if (id === SCHOOL_A_ID) return { id, name: 'School A', code: 'SCHA', status: 'ACTIVE', deletedAt: null, statusReason: null };
  if (id === SCHOOL_B_ID) return { id, name: 'School B', code: 'SCHB', status: 'ACTIVE', deletedAt: null, statusReason: null };
  return null;
};

const userById = (id: string | null | undefined) => (id ? users.get(id) ?? null : null);

const roleRowsFor = (userId: string) => {
  const user = userById(userId);
  if (!user) return [];
  return [{ roleId: `${user.role.toLowerCase()}-role`, role: { name: user.role } }];
};

const supportUser = (user: TestUser | null) =>
  user
    ? {
        id: user.id,
        email: user.email,
        roles: [{ role: { name: user.role } }],
        teacherProfile: null,
        parentProfiles: [],
      }
    : null;

const ticketForSchoolB = () => ({
  id: TEST_TICKET_B_ID,
  schoolId: SCHOOL_B_ID,
  createdById: SCHOOL_ADMIN_B_ID,
  assignedToId: null,
  subject: 'School B ticket',
  description: 'Tenant isolation ticket',
  status: 'OPEN',
  priority: 'HIGH',
  escalation: false,
  slaDueAt: null,
  createdAt: new Date('2026-05-20T00:00:00.000Z'),
  updatedAt: new Date('2026-05-20T00:00:00.000Z'),
  school: schoolFor(SCHOOL_B_ID),
  createdBy: supportUser(userById(SCHOOL_ADMIN_B_ID)),
  assignedTo: null,
  comments: [
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      ticketId: TEST_TICKET_B_ID,
      authorId: SUPER_ADMIN_ID,
      schoolId: SCHOOL_B_ID,
      body: 'Internal only',
      isInternal: true,
      createdAt: new Date('2026-05-20T00:00:00.000Z'),
      updatedAt: new Date('2026-05-20T00:00:00.000Z'),
      author: supportUser(userById(SUPER_ADMIN_ID)),
    },
  ],
});

const auditLog = () => ({
  id: TEST_AUDIT_LOG_ID,
  schoolId: SCHOOL_A_ID,
  actorId: SUPER_ADMIN_ID,
  actorRole: 'SUPER_ADMIN',
  entityType: 'USER',
  entityId: SCHOOL_ADMIN_A_ID,
  action: 'ADMIN_USER_FORCE_PASSWORD_RESET',
  beforeState: { passwordHash: 'must-redact', nested: { refreshToken: 'must-redact' } },
  afterState: { safe: 'ok', accessToken: 'must-redact', ipAddress: '10.20.30.40' },
  createdAt: new Date('2026-05-20T00:00:00.000Z'),
  actor: {
    id: SUPER_ADMIN_ID,
    email: 'super-admin@test.local',
    schoolId: null,
    teacherProfile: null,
    parentProfiles: [],
  },
});

const makeRecord = (data: any = {}) => ({
  id: data.id ?? 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  createdAt: data.createdAt ?? new Date('2026-05-20T00:00:00.000Z'),
  updatedAt: data.updatedAt ?? new Date('2026-05-20T00:00:00.000Z'),
  ...data,
});

const patchDefaultDelegate = (delegate: any, name: string) => {
  if (!delegate) return;
  if ('count' in delegate) patchMethod(delegate, 'count', async () => 0);
  if ('groupBy' in delegate) patchMethod(delegate, 'groupBy', async () => []);
  if ('findMany' in delegate) patchMethod(delegate, 'findMany', async () => []);
  if ('findFirst' in delegate) patchMethod(delegate, 'findFirst', async () => null);
  if ('findUnique' in delegate) patchMethod(delegate, 'findUnique', async () => null);
  if ('create' in delegate) patchMethod(delegate, 'create', async ({ data, include }: any) => makeRecord({ ...data, ...(include ? {} : {}) }));
  if ('update' in delegate) {
    patchMethod(delegate, 'update', async ({ where, data }: any) => makeRecord({ id: where?.id ?? where?.schoolId, ...data }));
  }
  if ('upsert' in delegate) {
    patchMethod(delegate, 'upsert', async ({ where, update, create }: any) =>
      makeRecord({ id: where?.id ?? 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', ...create, ...update }),
    );
  }
  if ('delete' in delegate) patchMethod(delegate, 'delete', async ({ where }: any) => makeRecord({ id: where?.id }));
  void name;
};

export const patchSecurityTestDependencies = () => {
  originalNodeEnv = env.NODE_ENV;
  env.NODE_ENV = 'test';

  const delegateNames = [
    'auditExport',
    'auditLog',
    'backupJob',
    'class',
    'classRoom',
    'classRoutine',
    'classSection',
    'classTeacher',
    'configEntry',
    'consentRecord',
    'dataDeletionJob',
    'dataExportJob',
    'employeeRolePermission',
    'employeeUserPermission',
    'featureFlag',
    'featureFlagOverride',
    'messagingService',
    'parentProfile',
    'refreshSession',
    'rolePermission',
    'school',
    'schoolMessagingConfig',
    'section',
    'student',
    'parentGuardian',
    'studentEnrollment',
    'studentDocument',
    'studentTimeline',
    'studentSibling',
    'studentImportLog',
    'studentParent',
    'subscription',
    'subscriptionPlanDef',
    'subscriptionPlanPermission',
    'supportTicket',
    'teacherProfile',
    'timePeriod',
    'tenantConfigOverride',
    'theme',
    'ticketComment',
    'user',
    'userRole',
  ];

  delegateNames.forEach((name) => patchDefaultDelegate((prisma as any)[name], name));

  patchMethod(prisma as any, '$queryRaw', async () => []);
  patchMethod(prisma as any, '$transaction', async (input: any) => (Array.isArray(input) ? Promise.all(input) : input(prisma)));

  patchMethod(prisma.school as any, 'findUnique', async ({ where }: any) => schoolFor(where?.id) ?? (where?.code === 'SCHA' ? schoolFor(SCHOOL_A_ID) : schoolFor(SCHOOL_B_ID)));
  patchMethod(prisma.school as any, 'findFirst', async ({ where }: any) => schoolFor(where?.id) ?? (where?.code === 'SCHA' ? schoolFor(SCHOOL_A_ID) : null));
  patchMethod(prisma.school as any, 'findMany', async ({ where }: any = {}) => {
    const schools = [schoolFor(SCHOOL_A_ID), schoolFor(SCHOOL_B_ID)].filter(Boolean);
    if (where?.id?.in) return schools.filter((school: any) => where.id.in.includes(school.id));
    return schools;
  });
  patchMethod(prisma.school as any, 'count', async ({ where }: any = {}) => {
    if (where?.status === 'ACTIVE') return 2;
    return 2;
  });

  patchMethod(prisma.userRole as any, 'findMany', async ({ where }: any) => roleRowsFor(where?.userId));
  patchMethod(prisma.userRole as any, 'findFirst', async ({ where }: any) => roleRowsFor(where?.userId)[0] ?? null);
  patchMethod(prisma.rolePermission as any, 'findMany', async () =>
    defaultPermissionCodes.map((code) => ({ permission: { code } })),
  );
  patchMethod(prisma.subscription as any, 'findUnique', async ({ where, select }: any = {}) => {
    if (where?.schoolId) {
      return {
        id: 'sub-1',
        schoolId: where.schoolId,
        planId: 'plan-1',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        discountPercent: 0,
        plan: { priceCents: 100000 },
        school: schoolFor(where.schoolId),
        ...(select?.planId ? { planId: 'plan-1' } : {}),
      };
    }
    return null;
  });
  patchMethod(prisma.subscription as any, 'findMany', async () => []);
  patchMethod(prisma.subscriptionPlanPermission as any, 'findMany', async () =>
    defaultPermissionCodes.map((permissionCode) => ({ permissionCode, enabled: true })),
  );

  patchMethod(prisma.user as any, 'findUnique', async ({ where }: any) => {
    const user = userById(where?.id);
    return user
      ? {
          id: user.id,
          email: user.email,
          schoolId: user.schoolId,
          status: user.status,
          mfaEnabled: user.mfaEnabled,
          passwordHash: 'not-returned-by-controllers',
          roles: roleRowsFor(user.id),
          school: user.schoolId ? schoolFor(user.schoolId) : null,
          teacherProfile: null,
          parentProfiles: [],
        }
      : null;
  });
  patchMethod(prisma.user as any, 'findFirst', async ({ where }: any = {}) => {
    if (where?.id) return prisma.user.findUnique({ where: { id: where.id } } as any);
    if (where?.roles?.some?.role?.name === 'SUPER_ADMIN') return prisma.user.findUnique({ where: { id: SUPER_ADMIN_ID } } as any);
    return null;
  });
  patchMethod(prisma.user as any, 'findMany', async () =>
    Array.from(users.values()).map((user) => ({
      id: user.id,
      email: user.email,
      schoolId: user.schoolId,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      createdAt: new Date('2026-05-20T00:00:00.000Z'),
      updatedAt: new Date('2026-05-20T00:00:00.000Z'),
      roles: roleRowsFor(user.id),
      school: user.schoolId ? schoolFor(user.schoolId) : null,
      teacherProfile: null,
      parentProfiles: [],
      refreshSessions: [],
    })),
  );
  patchMethod(prisma.user as any, 'count', async ({ where }: any = {}) => {
    if (where?.roles?.some?.role?.name) return Array.from(users.values()).filter((user) => user.role === where.roles.some.role.name).length;
    return users.size;
  });

  patchMethod(prisma.teacherProfile as any, 'findFirst', async ({ where }: any) =>
    where?.userId === TEACHER_A_ID ? { id: 'teacher-profile-a', userId: TEACHER_A_ID, schoolId: SCHOOL_A_ID, isActive: true } : null,
  );
  patchMethod(prisma.teacherProfile as any, 'count', async () => 0);
  patchMethod(prisma.parentProfile as any, 'findMany', async ({ where }: any = {}) =>
    where?.userId === PARENT_A_ID ? [{ id: 'parent-profile-a', userId: PARENT_A_ID }] : [],
  );
  patchMethod(prisma.studentParent as any, 'findMany', async () => [{ student: { school: { status: 'ACTIVE' } } }]);

  patchMethod(prisma.featureFlag as any, 'findMany', async () => []);
  patchMethod(prisma.featureFlag as any, 'findUnique', async ({ where }: any) =>
    where?.id || where?.key ? { id: where.id ?? 'flag-1', key: where.key ?? 'test_flag', status: 'DISABLED', overrides: [] } : null,
  );
  patchMethod(prisma.featureFlag as any, 'create', async ({ data }: any) => makeRecord(data));
  patchMethod(prisma.featureFlag as any, 'update', async ({ where, data }: any) => makeRecord({ id: where.id, key: 'test_flag', ...data }));

  patchMethod(prisma.configEntry as any, 'findMany', async () => []);
  patchMethod(prisma.configEntry as any, 'findUnique', async ({ where }: any) =>
    where?.id || where?.key ? { id: where.id ?? 'config-1', key: where.key ?? 'config', value: {}, version: 1 } : null,
  );
  patchMethod(prisma.configEntry as any, 'create', async ({ data }: any) => makeRecord(data));
  patchMethod(prisma.configEntry as any, 'update', async ({ where, data }: any) => makeRecord({ id: where.id, ...data }));

  patchMethod(prisma.supportTicket as any, 'findFirst', async ({ where }: any) => {
    const ticket = ticketForSchoolB();
    if (where?.id && where.id !== ticket.id) return null;
    if (where?.schoolId && where.schoolId !== ticket.schoolId) return null;
    return ticket;
  });
  patchMethod(prisma.supportTicket as any, 'findMany', async ({ where }: any = {}) => {
    const ticket = ticketForSchoolB();
    if (where?.schoolId && where.schoolId !== ticket.schoolId) return [];
    return [ticket];
  });
  patchMethod(prisma.supportTicket as any, 'groupBy', async () => []);
  patchMethod(prisma.supportTicket as any, 'count', async () => 0);
  patchMethod(prisma.supportTicket as any, 'update', async ({ data }: any) => ({ ...ticketForSchoolB(), ...data }));
  patchMethod(prisma.ticketComment as any, 'create', async ({ data }: any) => ({
    id: 'comment-1',
    ...data,
    createdAt: new Date('2026-05-20T00:00:00.000Z'),
    updatedAt: new Date('2026-05-20T00:00:00.000Z'),
    author: supportUser(userById(data.authorId)),
  }));

  patchMethod(prisma.auditLog as any, 'findMany', async () => [auditLog()]);
  patchMethod(prisma.auditLog as any, 'findUnique', async ({ where }: any) => (where?.id === TEST_AUDIT_LOG_ID ? auditLog() : null));
  patchMethod(prisma.auditLog as any, 'count', async () => 1);
  patchMethod(prisma.auditLog as any, 'groupBy', async () => [{ action: 'LOGIN_FAILED', _count: { action: 1 } }]);
  patchMethod(prisma.auditLog as any, 'create', async ({ data }: any) => makeRecord(data));

  auditExports = [];
  patchMethod(prisma.auditExport as any, 'create', async ({ data }: any) => {
    const row = makeRecord({ id: TEST_EXPORT_ID, ...data, createdAt: new Date('2026-05-20T00:00:00.000Z') });
    auditExports.push(row);
    return row;
  });
  patchMethod(prisma.auditExport as any, 'update', async ({ where, data }: any) => {
    const row = auditExports.find((entry) => entry.id === where.id) ?? makeRecord({ id: where.id });
    Object.assign(row, data);
    return row;
  });
  patchMethod(prisma.auditExport as any, 'findMany', async () =>
    auditExports.map((entry) => ({
      ...entry,
      requestedBy: { id: SUPER_ADMIN_ID, email: 'super-admin@test.local' },
      school: entry.schoolId ? schoolFor(entry.schoolId) : null,
    })),
  );
  patchMethod(prisma.auditExport as any, 'findUnique', async ({ where }: any) => {
    const row = auditExports.find((entry) => entry.id === where.id);
    return row
      ? {
          ...row,
          requestedBy: { id: SUPER_ADMIN_ID, email: 'super-admin@test.local' },
          school: row.schoolId ? schoolFor(row.schoolId) : null,
        }
      : null;
  });
  patchMethod(prisma.auditExport as any, 'count', async () => auditExports.length);

  patchMethod(redis as any, 'ping', async () => 'PONG');
  patchMethod(redis as any, 'disconnect', () => undefined);
  patchMethod(s3Service as any, 'getSignedUrlForKey', async ({ key }: { key: string }) => `https://signed.test/${encodeURIComponent(key)}`);
};

export const restoreSecurityTestDependencies = () => {
  for (const restore of restoreFns.reverse()) {
    restore();
  }
  restoreFns = [];
  if (originalNodeEnv) {
    env.NODE_ENV = originalNodeEnv;
    originalNodeEnv = null;
  }
  users.clear();
  auditExports = [];
};

export const closeBackgroundHandles = async () => {
  try {
    const { queues } = await import('../queues');
    await Promise.all(Object.values(queues).map((queue: any) => queue.close().catch(() => undefined)));
  } catch {
    // Queue cleanup should not hide test assertions.
  }
  try {
    const { __closeJobQueueEventsForTests } = await import('../controllers/job.controller');
    await __closeJobQueueEventsForTests();
  } catch {
    // QueueEvents may already be closed.
  }
  redis.disconnect();
  await prisma.$disconnect();
};

export const startTestServer = async (): Promise<TestServer> => {
  const { createApp } = await import('../app');
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    request: async (method, requestPath, options = {}) => {
      const headers: Record<string, string> = {
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.user ? createAuthHeaders(options.user) : {}),
        ...(options.headers ?? {}),
      };
      const response = await fetch(`${baseUrl}${requestPath}`, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        redirect: options.redirect ?? 'manual',
      });
      const text = await response.text();
      let body: unknown = null;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }
      return { status: response.status, headers: response.headers, body, text };
    },
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
};

export const expectUnauthorized = (response: TestHttpResponse) => {
  assert.equal(response.status, 401);
};

export const expectForbidden = (response: TestHttpResponse) => {
  assert.equal(response.status, 403);
};

export const expectSuccess = (response: TestHttpResponse) => {
  assert.ok(response.status >= 200 && response.status < 300, `Expected success, got ${response.status}: ${response.text}`);
};

const isSensitiveKey = (key: string) => {
  const normalized = key.toLowerCase().replace(/[_-]/g, '');
  if (normalized === 'password' || normalized.endsWith('password')) return true;
  if (normalized.includes('passwordhash')) return true;
  if (normalized.includes('token')) return true;
  if (normalized === 'otp' || normalized.includes('otphash')) return true;
  if (normalized.includes('mfaSecret'.toLowerCase()) || normalized.includes('totpsecret')) return true;
  if (normalized.includes('backupcodes')) return true;
  if (normalized === 'cookie' || normalized === 'authorization') return true;
  if (normalized.includes('jwtsecret')) return true;
  if (normalized.includes('apikey') || normalized.includes('privatekey')) return true;
  if (normalized.includes('awssecretaccesskey')) return true;
  if (normalized.includes('databaseurl') || normalized.includes('redisurl')) return true;
  if (normalized === 'secret' || normalized.endsWith('secret')) return true;
  return false;
};

export const expectNoSensitiveFields = (value: unknown, path = 'response') => {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => expectNoSensitiveFields(entry, `${path}[${index}]`));
    return;
  }
  if (typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      assert.equal(entry, '[REDACTED]', `Sensitive key leaked at ${path}.${key}`);
      continue;
    }
    expectNoSensitiveFields(entry, `${path}.${key}`);
  }
};

export const getUser = (role: TestRole, schoolId: string | null = role === 'SUPER_ADMIN' ? null : SCHOOL_A_ID) => {
  const existing = Array.from(users.values()).find((user) => user.role === role && user.schoolId === schoolId);
  return existing ?? createTestUser(role, schoolId);
};
