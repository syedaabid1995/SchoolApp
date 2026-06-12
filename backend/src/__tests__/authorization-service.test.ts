import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';
import { HttpError } from '../middlewares/error.middleware';
import { AuthorizationService } from '../services/authorization.service';
import { PermissionCodes as P } from '../permissions/permission-manifest';

const SCHOOL_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const ROLE_ID = 'role-school-admin';
const PLAN_ID = 'plan-1';

const patch = <T extends object, K extends keyof T>(target: T, key: K, value: T[K]) => {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
};

const invoke = async (middleware: (req: any, res: any, next: (err?: unknown) => void) => unknown, req: any) =>
  new Promise<unknown>((resolve) => {
    middleware(req, {}, (err?: unknown) => resolve(err ?? null));
  });

const makeAccessToken = (role = 'SCHOOL_ADMIN') =>
  jwt.sign({ sub: USER_ID, schoolId: SCHOOL_ID, typ: 'access', role }, env.JWT_SECRET);

const makeAuthReq = (path: string, method = 'GET') => ({
  headers: { authorization: `Bearer ${makeAccessToken()}` },
  originalUrl: path,
  path,
  method,
  body: {},
  query: {},
});

const patchAuthorizationData = (options: {
  planCodes: string[];
  roleOverrides?: Array<{ permissionCode: string; enabled: boolean }>;
  userOverrides?: Array<{ permissionCode: string; enabled: boolean }>;
  legacyRoleCodes?: string[];
}) => {
  const restores = [
    patch(prisma.school as any, 'findUnique', async () => ({ status: 'ACTIVE', statusReason: null })),
    patch(prisma.userRole as any, 'findMany', async () => [
      { roleId: ROLE_ID, role: { name: 'SCHOOL_ADMIN' } },
    ]),
    patch(prisma.rolePermission as any, 'findMany', async () =>
      (options.legacyRoleCodes ?? []).map((code) => ({ permission: { code } })),
    ),
    patch(prisma.subscription as any, 'findUnique', async ({ select }: any = {}) => ({
      id: 'subscription-1',
      schoolId: SCHOOL_ID,
      planId: PLAN_ID,
      ...(select?.planId ? { planId: PLAN_ID } : {}),
    })),
    patch(prisma.subscriptionPlanPermission as any, 'findMany', async () =>
      options.planCodes.map((permissionCode) => ({ permissionCode, enabled: true })),
    ),
    patch(prisma.employeeRolePermission as any, 'findMany', async () => options.roleOverrides ?? []),
    patch(prisma.employeeUserPermission as any, 'findMany', async () => options.userOverrides ?? []),
  ];

  return () => restores.reverse().forEach((restore) => restore());
};

test('authMiddleware and requirePermission deny identically when plan filtering removes a legacy role permission', async () => {
  const restore = patchAuthorizationData({
    planCodes: [P.attendanceCreate],
    legacyRoleCodes: [P.attendanceView],
  });

  try {
    const authReq = makeAuthReq('/api/v1/attendance-summary');
    const authError = await invoke(authMiddleware, authReq);
    assert.ok(authError instanceof HttpError);
    assert.equal(authError.statusCode, 403);

    const permissionReq = {
      auth: { userId: USER_ID, schoolId: SCHOOL_ID, role: 'SCHOOL_ADMIN' },
    };
    const permissionError = await invoke(requirePermission(P.attendanceView, P.attendanceReport), permissionReq);
    assert.ok(permissionError instanceof HttpError);
    assert.equal(permissionError.statusCode, 403);
  } finally {
    restore();
  }
});

test('AuthorizationService respects role-level permission overrides', async () => {
  const restore = patchAuthorizationData({
    planCodes: [P.attendanceCreate],
    roleOverrides: [{ permissionCode: P.attendanceCreate, enabled: false }],
  });

  try {
    const allowed = await AuthorizationService.hasAnyEffectivePermission(
      { userId: USER_ID, schoolId: SCHOOL_ID, role: 'SCHOOL_ADMIN' },
      P.attendanceCreate,
    );
    assert.equal(allowed, false);
  } finally {
    restore();
  }
});

test('AuthorizationService respects user-level permission overrides after role overrides', async () => {
  const restore = patchAuthorizationData({
    planCodes: [P.attendanceCreate],
    roleOverrides: [{ permissionCode: P.attendanceCreate, enabled: false }],
    userOverrides: [{ permissionCode: P.attendanceCreate, enabled: true }],
  });

  try {
    const allowed = await AuthorizationService.hasAnyEffectivePermission(
      { userId: USER_ID, schoolId: SCHOOL_ID, role: 'SCHOOL_ADMIN' },
      P.attendanceCreate,
    );
    assert.equal(allowed, true);
  } finally {
    restore();
  }
});

test('AuthorizationService requires every permission for all-permission checks', async () => {
  const restore = patchAuthorizationData({
    planCodes: [P.reportsView, P.reportsFeesView],
  });

  try {
    const allowed = await AuthorizationService.hasAllEffectivePermissions(
      { userId: USER_ID, schoolId: SCHOOL_ID, role: 'SCHOOL_ADMIN' },
      [P.reportsFeesView, P.reportsExport],
    );
    assert.equal(allowed, false);
  } finally {
    restore();
  }
});
