import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';

import { env } from '../../config/env';
import { prisma } from '../../config/db';
import { redis } from '../../config/redis';
import {
  forgotPassword,
  login,
  logout,
  refreshToken,
  resendTwoFactor,
  resetPassword,
  verifyTwoFactor,
} from '../auth.controller';
import { HttpError } from '../../middlewares/error.middleware';
import { hashPassword } from '../../utils/password';
import { hashToken } from '../../utils/token';
import { hashOtp } from '../../utils/otp';

const GENERIC_LOGIN_ERROR = 'Invalid login details. Please try again.';
const GENERIC_FORGOT_PASSWORD_MESSAGE = 'If an account exists, password reset instructions have been sent.';
const RESET_SUCCESS_MESSAGE = 'Password has been reset successfully. Please login again.';
const INVALID_RESET_TOKEN_MESSAGE = 'Invalid or expired reset token.';
const RATE_LIMIT_MESSAGE = 'Too many attempts. Please try again later.';

const SCHOOL_A_ID = '11111111-1111-4111-8111-111111111111';
const SCHOOL_B_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const SECOND_USER_ID = '55555555-5555-4555-8555-555555555555';
const MFA_CHALLENGE_ID = '44444444-4444-4444-8444-444444444444';
const EMAIL = 'admin@example.com';
const OLD_PASSWORD = 'OldPassword@123';
const NEW_PASSWORD = 'NewPassword@123';

type TestSchool = {
  id: string;
  code: string;
  status: 'ACTIVE' | 'SUSPENDED';
  statusReason: string | null;
};

type TestUser = {
  id: string;
  email: string;
  schoolId: string | null;
  passwordHash: string;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  mfaMethod: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  teacherProfile: null;
  parentProfiles: Array<unknown>;
  roles: Array<{ role: { name: string } }>;
};

type TestRefreshSession = {
  id: string;
  userId: string;
  schoolId: string | null;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceName?: string | null;
};

type TestResetToken = {
  id: string;
  userId: string;
  schoolId: string | null;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

type TestMfaChallenge = {
  id: string;
  userId: string;
  schoolId: string | null;
  otpHash: string;
  purpose: string;
  expiresAt: Date;
  verifiedAt: Date | null;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  createdIp?: string | null;
  userAgent?: string | null;
};

type TestResponse = {
  statusCode: number;
  body: unknown;
  cookies: Record<string, { value: string; options: unknown }>;
  clearedCookies: string[];
  status: (code: number) => TestResponse;
  json: (body: unknown) => TestResponse;
  cookie: (name: string, value: string, options: unknown) => TestResponse;
  clearCookie: (name: string) => TestResponse;
};

let schools = new Map<string, TestSchool>();
let users = new Map<string, TestUser>();
let refreshSessions = new Map<string, TestRefreshSession>();
let resetTokens = new Map<string, TestResetToken>();
let mfaChallenges = new Map<string, TestMfaChallenge>();
let auditLogs: unknown[] = [];
let redisValues = new Map<string, { value: string; expiresAt: number | null }>();
let restoreFns: Array<() => void> = [];
let nextRefreshSession = 1;
let nextResetToken = 1;
let nextMfaChallenge = 1;

const originalCacheEnabled = env.REDIS_CACHE_ENABLED;
const originalNodeEnv = env.NODE_ENV;

const patchMethod = <T extends object, K extends keyof T>(target: T, key: K, value: T[K]) => {
  const original = target[key];
  target[key] = value;
  restoreFns.push(() => {
    target[key] = original;
  });
};

const restorePatchedMethods = () => {
  for (const restore of restoreFns.reverse()) {
    restore();
  }
  restoreFns = [];
};

const userKey = (email: string, schoolId: string | null) => `${email.toLowerCase()}|${schoolId ?? 'none'}`;

const addUser = async (overrides: Partial<TestUser> & { password?: string; role?: string } = {}) => {
  const user: TestUser = {
    id: overrides.id ?? USER_ID,
    email: overrides.email ?? EMAIL,
    schoolId: overrides.schoolId === undefined ? SCHOOL_A_ID : overrides.schoolId,
    passwordHash: await hashPassword(overrides.password ?? OLD_PASSWORD),
    mustChangePassword: overrides.mustChangePassword ?? false,
    mfaEnabled: overrides.mfaEnabled ?? false,
    mfaMethod: overrides.mfaMethod ?? null,
    status: overrides.status ?? 'ACTIVE',
    teacherProfile: null,
    parentProfiles: [],
    roles: [{ role: { name: overrides.role ?? 'STAFF' } }],
  };
  users.set(userKey(user.email, user.schoolId), user);
  return user;
};

const findUserById = (id: string) => Array.from(users.values()).find((user) => user.id === id) ?? null;

const findUser = (where: Record<string, unknown>) => {
  let result = Array.from(users.values());
  const emailWhere = where.email as { equals?: string } | undefined;
  if (emailWhere?.equals) {
    result = result.filter((user) => user.email.toLowerCase() === emailWhere.equals!.toLowerCase());
  }
  if ('schoolId' in where) {
    result = result.filter((user) => (user.schoolId ?? null) === (where.schoolId as string | null));
  }
  if ('status' in where) {
    result = result.filter((user) => user.status === where.status);
  }
  return result[0] ?? null;
};

const selectSchool = (where: Record<string, string>) => {
  if (where.id) return schools.get(where.id) ?? null;
  if (where.code) return Array.from(schools.values()).find((school) => school.code === where.code) ?? null;
  return null;
};

const matchesRefreshSessionWhere = (session: TestRefreshSession, where: Record<string, any>) => {
  if (where.userId && session.userId !== where.userId) return false;
  if ('revokedAt' in where && session.revokedAt !== where.revokedAt) return false;
  if (where.tokenHash?.not && session.tokenHash === where.tokenHash.not) return false;
  return true;
};

const matchesResetTokenWhere = (token: TestResetToken, where: Record<string, any>) => {
  if (where.id && token.id !== where.id) return false;
  if (where.userId && token.userId !== where.userId) return false;
  if ('schoolId' in where && (token.schoolId ?? null) !== (where.schoolId ?? null)) return false;
  if ('usedAt' in where && token.usedAt !== where.usedAt) return false;
  if (where.expiresAt?.gt && !(token.expiresAt > where.expiresAt.gt)) return false;
  return true;
};

const matchesMfaChallengeWhere = (challenge: TestMfaChallenge, where: Record<string, any>) => {
  if (where.id && challenge.id !== where.id) return false;
  if (where.userId && challenge.userId !== where.userId) return false;
  if ('schoolId' in where && (challenge.schoolId ?? null) !== (where.schoolId ?? null)) return false;
  if (where.purpose && challenge.purpose !== where.purpose) return false;
  if ('verifiedAt' in where && challenge.verifiedAt !== where.verifiedAt) return false;
  if (where.expiresAt?.gt && !(challenge.expiresAt > where.expiresAt.gt)) return false;
  if (where.attempts?.lt !== undefined && !(challenge.attempts < where.attempts.lt)) return false;
  return true;
};

const applyMfaChallengeData = (challenge: TestMfaChallenge, data: Record<string, any>) => {
  if (data.attempts?.increment) {
    challenge.attempts += data.attempts.increment;
  }
  Object.entries(data).forEach(([key, value]) => {
    if (key === 'attempts' && typeof value === 'object') return;
    (challenge as any)[key] = value;
  });
};

const patchPrisma = () => {
  patchMethod(prisma.school as any, 'findFirst', async ({ where }: any) => selectSchool(where));
  patchMethod(prisma.school as any, 'findUnique', async ({ where }: any) => selectSchool(where));

  patchMethod(prisma.user as any, 'findFirst', async ({ where }: any) => findUser(where));
  patchMethod(prisma.user as any, 'findUnique', async ({ where }: any) => findUserById(where.id));
  patchMethod(prisma.user as any, 'update', async ({ where, data }: any) => {
    const user = findUserById(where.id);
    if (!user) throw new Error('user not found');
    Object.assign(user, data);
    return user;
  });

  patchMethod(prisma.userRole as any, 'findFirst', async ({ where }: any) => {
    const user = findUserById(where.userId);
    return user?.roles[0] ?? null;
  });
  patchMethod(prisma.userRole as any, 'findMany', async ({ where }: any) => {
    const user = findUserById(where.userId);
    return user?.roles ?? [];
  });

  patchMethod(prisma.subscription as any, 'findUnique', async () => null);
  patchMethod(prisma.subscriptionPlanPermission as any, 'findMany', async () => []);
  patchMethod(prisma.employeeRolePermission as any, 'findMany', async () => []);
  patchMethod(prisma.employeeUserPermission as any, 'findMany', async () => []);
  patchMethod(prisma.teacherProfile as any, 'findFirst', async () => null);
  patchMethod(prisma.parentProfile as any, 'findMany', async () => []);
  patchMethod(prisma.studentParent as any, 'findMany', async () => []);

  patchMethod(prisma.refreshSession as any, 'create', async ({ data }: any) => {
    const session: TestRefreshSession = {
      id: `refresh-session-${nextRefreshSession++}`,
      ...data,
      revokedAt: data.revokedAt ?? null,
      createdAt: data.createdAt ?? new Date(),
      lastUsedAt: data.lastUsedAt ?? null,
    };
    refreshSessions.set(session.tokenHash, session);
    return session;
  });
  patchMethod(prisma.refreshSession as any, 'findUnique', async ({ where }: any) => {
    if (where.tokenHash) return refreshSessions.get(where.tokenHash) ?? null;
    if (where.id) return Array.from(refreshSessions.values()).find((session) => session.id === where.id) ?? null;
    return null;
  });
  patchMethod(prisma.refreshSession as any, 'findFirst', async ({ where }: any) => {
    return Array.from(refreshSessions.values()).find((session) => {
      if (where.id && session.id !== where.id) return false;
      if (where.userId && session.userId !== where.userId) return false;
      return true;
    }) ?? null;
  });
  patchMethod(prisma.refreshSession as any, 'update', async ({ where, data }: any) => {
    const session = Array.from(refreshSessions.values()).find((entry) => entry.id === where.id);
    if (!session) throw new Error('refresh session not found');
    Object.assign(session, data);
    return session;
  });
  patchMethod(prisma.refreshSession as any, 'updateMany', async ({ where, data }: any) => {
    let count = 0;
    for (const session of refreshSessions.values()) {
      if (!matchesRefreshSessionWhere(session, where ?? {})) continue;
      Object.assign(session, data);
      count += 1;
    }
    return { count };
  });
  patchMethod(prisma.refreshSession as any, 'findMany', async ({ where }: any) => {
    return Array.from(refreshSessions.values()).filter((session) => matchesRefreshSessionWhere(session, where ?? {}));
  });

  patchMethod(prisma.passwordResetToken as any, 'create', async ({ data }: any) => {
    const token: TestResetToken = {
      id: `reset-token-${nextResetToken++}`,
      ...data,
      usedAt: data.usedAt ?? null,
      createdAt: data.createdAt ?? new Date(),
    };
    resetTokens.set(token.tokenHash, token);
    return token;
  });
  patchMethod(prisma.passwordResetToken as any, 'findUnique', async ({ where }: any) => {
    const token = resetTokens.get(where.tokenHash);
    if (!token) return null;
    return {
      ...token,
      user: findUserById(token.userId),
    };
  });
  patchMethod(prisma.passwordResetToken as any, 'updateMany', async ({ where, data }: any) => {
    let count = 0;
    for (const token of resetTokens.values()) {
      if (!matchesResetTokenWhere(token, where ?? {})) continue;
      Object.assign(token, data);
      count += 1;
    }
    return { count };
  });

  patchMethod(prisma.mfaChallenge as any, 'create', async ({ data }: any) => {
    const challenge: TestMfaChallenge = {
      id: `mfa-challenge-${nextMfaChallenge++}`,
      ...data,
      verifiedAt: data.verifiedAt ?? null,
      attempts: data.attempts ?? 0,
      maxAttempts: data.maxAttempts ?? 5,
      createdAt: data.createdAt ?? new Date(),
    };
    mfaChallenges.set(challenge.id, challenge);
    return challenge;
  });
  patchMethod(prisma.mfaChallenge as any, 'findUnique', async ({ where }: any) => {
    const challenge = mfaChallenges.get(where.id);
    if (!challenge) return null;
    return {
      ...challenge,
      user: findUserById(challenge.userId),
    };
  });
  patchMethod(prisma.mfaChallenge as any, 'update', async ({ where, data }: any) => {
    const challenge = mfaChallenges.get(where.id);
    if (!challenge) throw new Error('mfa challenge not found');
    applyMfaChallengeData(challenge, data);
    return challenge;
  });
  patchMethod(prisma.mfaChallenge as any, 'updateMany', async ({ where, data }: any) => {
    let count = 0;
    for (const challenge of mfaChallenges.values()) {
      if (!matchesMfaChallengeWhere(challenge, where ?? {})) continue;
      applyMfaChallengeData(challenge, data);
      count += 1;
    }
    return { count };
  });

  patchMethod(prisma.auditLog as any, 'create', async ({ data }: any) => {
    auditLogs.push(data);
    return { id: `audit-${auditLogs.length}`, ...data };
  });

  patchMethod(prisma as any, '$transaction', async (input: any) => {
    if (Array.isArray(input)) return Promise.all(input);
    return input(prisma);
  });
};

const patchRedis = () => {
  patchMethod(redis as any, 'incr', async (key: string) => {
    const existing = redisValues.get(key);
    const next = Number(existing?.value ?? 0) + 1;
    redisValues.set(key, { value: String(next), expiresAt: existing?.expiresAt ?? null });
    return next;
  });
  patchMethod(redis as any, 'expire', async (key: string, seconds: number) => {
    const existing = redisValues.get(key) ?? { value: '0', expiresAt: null };
    redisValues.set(key, { ...existing, expiresAt: Date.now() + seconds * 1000 });
    return 1;
  });
  patchMethod(redis as any, 'ttl', async (key: string) => {
    const existing = redisValues.get(key);
    if (!existing) return -2;
    if (!existing.expiresAt) return -1;
    return Math.max(1, Math.ceil((existing.expiresAt - Date.now()) / 1000));
  });
  patchMethod(redis as any, 'get', async (key: string) => redisValues.get(key)?.value ?? null);
  patchMethod(redis as any, 'del', async (...keys: string[]) => {
    let count = 0;
    for (const key of keys) {
      if (redisValues.delete(key)) count += 1;
    }
    return count;
  });
  patchMethod(redis as any, 'scan', async () => ['0', []]);
};

const createRequest = (params: {
  body?: unknown;
  cookie?: string;
  auth?: { userId: string; schoolId: string | null; role?: string | null };
  originalUrl?: string;
  ip?: string;
  userAgent?: string;
}): Request => {
  const headers: Record<string, string> = {
    'user-agent': params.userAgent ?? 'node-test-agent',
  };
  if (params.cookie) headers.cookie = params.cookie;

  return {
    body: params.body ?? {},
    headers,
    ip: params.ip ?? '127.0.0.1',
    socket: { remoteAddress: params.ip ?? '127.0.0.1' },
    auth: params.auth,
    originalUrl: params.originalUrl ?? '/api/v1/auth/login',
    params: {},
  } as unknown as Request;
};

const createResponse = (): TestResponse => {
  const response: TestResponse = {
    statusCode: 200,
    body: null,
    cookies: {},
    clearedCookies: [],
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    cookie(name: string, value: string, options: unknown) {
      this.cookies[name] = { value, options };
      return this;
    },
    clearCookie(name: string) {
      this.clearedCookies.push(name);
      return this;
    },
  };
  return response;
};

const invoke = async (handler: (req: Request, res: Response) => Promise<void>, req: Request) => {
  const res = createResponse();
  try {
    await handler(req, res as unknown as Response);
  } catch (err) {
    if (!(err instanceof HttpError)) throw err;
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        details: err.details ?? null,
      },
    });
  }
  return res;
};

const loginRequest = (password = OLD_PASSWORD, schoolCode = 'SCHA') =>
  createRequest({
    body: {
      email: EMAIL,
      password,
      schoolCode,
      loginType: 'staff',
    },
  });

const seedResetToken = (params: {
  rawToken: string;
  userId?: string;
  schoolId?: string | null;
  expiresAt?: Date;
  usedAt?: Date | null;
}) => {
  const token: TestResetToken = {
    id: `seed-reset-${nextResetToken++}`,
    userId: params.userId ?? USER_ID,
    schoolId: params.schoolId === undefined ? SCHOOL_A_ID : params.schoolId,
    tokenHash: hashToken(params.rawToken),
    expiresAt: params.expiresAt ?? new Date(Date.now() + 15 * 60 * 1000),
    usedAt: params.usedAt ?? null,
    createdAt: new Date(),
  };
  resetTokens.set(token.tokenHash, token);
  return token;
};

const seedMfaChallenge = (params: {
  otp: string;
  id?: string;
  userId?: string;
  schoolId?: string | null;
  expiresAt?: Date;
  verifiedAt?: Date | null;
  attempts?: number;
  maxAttempts?: number;
  createdIp?: string | null;
  userAgent?: string | null;
}) => {
  const challenge: TestMfaChallenge = {
    id: params.id ?? MFA_CHALLENGE_ID,
    userId: params.userId ?? USER_ID,
    schoolId: params.schoolId === undefined ? SCHOOL_A_ID : params.schoolId,
    otpHash: hashOtp(params.otp),
    purpose: 'LOGIN',
    expiresAt: params.expiresAt ?? new Date(Date.now() + 5 * 60 * 1000),
    verifiedAt: params.verifiedAt ?? null,
    attempts: params.attempts ?? 0,
    maxAttempts: params.maxAttempts ?? 5,
    createdAt: new Date(),
    createdIp: params.createdIp,
    userAgent: params.userAgent,
  };
  mfaChallenges.set(challenge.id, challenge);
  return challenge;
};

test.beforeEach(async () => {
  restorePatchedMethods();
  env.REDIS_CACHE_ENABLED = false;
  env.NODE_ENV = 'development';
  schools = new Map([
    [SCHOOL_A_ID, { id: SCHOOL_A_ID, code: 'SCHA', status: 'ACTIVE', statusReason: null }],
    [SCHOOL_B_ID, { id: SCHOOL_B_ID, code: 'SCHB', status: 'ACTIVE', statusReason: null }],
  ]);
  users = new Map();
  refreshSessions = new Map();
  resetTokens = new Map();
  mfaChallenges = new Map();
  auditLogs = [];
  redisValues = new Map();
  nextRefreshSession = 1;
  nextResetToken = 1;
  nextMfaChallenge = 1;
  patchPrisma();
  patchRedis();
  await addUser();
});

test.afterEach(() => {
  restorePatchedMethods();
  env.REDIS_CACHE_ENABLED = originalCacheEnabled;
  env.NODE_ENV = originalNodeEnv;
});

test.after(async () => {
  redis.disconnect();
  await prisma.$disconnect();
});

test('normal user without 2FA can login normally and creates a refresh session', async () => {
  const res = await invoke(login, loginRequest());

  assert.equal(res.statusCode, 200);
  assert.equal((res.body as any).mfaRequired, undefined);
  assert.equal(typeof (res.body as any).accessToken, 'string');
  assert.equal((res.body as any).user.email, EMAIL);
  assert.equal((res.body as any).user.schoolId, SCHOOL_A_ID);
  assert.equal(refreshSessions.size, 1);
  assert.ok(res.cookies.refresh_token.value);
  assert.equal(mfaChallenges.size, 0);
});

test('super admin login returns mfaRequired without issuing session', async () => {
  await addUser({ id: SECOND_USER_ID, role: 'SUPER_ADMIN', schoolId: null });

  const res = await invoke(
    login,
    createRequest({
      body: {
        email: EMAIL,
        password: OLD_PASSWORD,
        loginType: 'admin',
      },
    }),
  );

  assert.equal(res.statusCode, 200);
  assert.equal((res.body as any).mfaRequired, true);
  assert.equal((res.body as any).mfaMethod, 'email');
  assert.equal((res.body as any).challengeId, 'mfa-challenge-1');
  assert.equal((res.body as any).accessToken, undefined);
  assert.equal(res.cookies.access_token, undefined);
  assert.equal(res.cookies.refresh_token, undefined);
  assert.equal(refreshSessions.size, 0);
  assert.equal(mfaChallenges.size, 1);
  assert.equal(Array.from(mfaChallenges.values())[0].userId, SECOND_USER_ID);
});

test('school admin login returns mfaRequired without issuing session', async () => {
  await addUser({ role: 'SCHOOL_ADMIN' });

  const res = await invoke(
    login,
    createRequest({
      body: {
        email: EMAIL,
        password: OLD_PASSWORD,
        schoolCode: 'SCHA',
        loginType: 'admin',
      },
    }),
  );

  assert.equal(res.statusCode, 200);
  assert.equal((res.body as any).mfaRequired, true);
  assert.equal((res.body as any).mfaMethod, 'email');
  assert.equal((res.body as any).challengeId, 'mfa-challenge-1');
  assert.equal((res.body as any).message, 'Verification code sent to your email.');
  assert.equal((res.body as any).accessToken, undefined);
  assert.equal(res.cookies.access_token, undefined);
  assert.equal(refreshSessions.size, 0);
  assert.equal(res.cookies.refresh_token, undefined);
  assert.equal(mfaChallenges.size, 1);
  const challenge = Array.from(mfaChallenges.values())[0];
  assert.equal(challenge.userId, USER_ID);
  assert.equal(challenge.schoolId, SCHOOL_A_ID);
  assert.equal(challenge.purpose, 'LOGIN');
  assert.match(challenge.otpHash, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(challenge.otpHash, /^\d{6}$/);
  assert.ok(auditLogs.some((entry: any) => entry.action === 'MFA_CHALLENGE_CREATED'));
});

test('OTP is not returned in production API response', async () => {
  env.NODE_ENV = 'production';
  await addUser({ role: 'SCHOOL_ADMIN' });

  const res = await invoke(
    login,
    createRequest({
      body: {
        email: EMAIL,
        password: OLD_PASSWORD,
        schoolCode: 'SCHA',
        loginType: 'admin',
      },
    }),
  );

  const serialized = JSON.stringify(res.body).toLowerCase();
  assert.equal(res.statusCode, 200);
  assert.equal((res.body as any).mfaRequired, true);
  assert.equal((res.body as any).challengeId, 'mfa-challenge-1');
  assert.equal((res.body as any).otp, undefined);
  assert.equal(serialized.includes('otp'), false);
  assert.equal(serialized.includes('655313'), false);
  assert.match(Array.from(mfaChallenges.values())[0].otpHash, /^[0-9a-f]{64}$/);
});

test('password failure does not create MFA challenge', async () => {
  await addUser({ role: 'SCHOOL_ADMIN' });

  const res = await invoke(
    login,
    createRequest({
      body: {
        email: EMAIL,
        password: 'WrongPassword@123',
        schoolCode: 'SCHA',
        loginType: 'admin',
      },
    }),
  );

  assert.equal(res.statusCode, 401);
  assert.equal((res.body as any).error.message, GENERIC_LOGIN_ERROR);
  assert.equal(mfaChallenges.size, 0);
  assert.equal(refreshSessions.size, 0);
});

test('OTP is stored hashed, not raw', () => {
  const challenge = seedMfaChallenge({ otp: '123456' });

  assert.equal(challenge.otpHash, hashOtp('123456'));
  assert.notEqual(challenge.otpHash, '123456');
  assert.match(challenge.otpHash, /^[0-9a-f]{64}$/);
});

test('correct OTP completes login and sets full auth cookies only after verification', async () => {
  await addUser({ role: 'SCHOOL_ADMIN' });
  seedMfaChallenge({ otp: '123456' });

  const res = await invoke(
    verifyTwoFactor,
    createRequest({
      body: {
        challengeId: MFA_CHALLENGE_ID,
        otp: '123456',
        rememberMe: true,
      },
    }),
  );

  assert.equal(res.statusCode, 200);
  assert.equal((res.body as any).message, 'Login successful.');
  assert.equal((res.body as any).user.email, EMAIL);
  assert.equal((res.body as any).user.role, 'SCHOOL_ADMIN');
  assert.equal((res.body as any).accessToken, undefined);
  assert.equal((res.body as any).refreshToken, undefined);
  assert.ok(res.cookies.access_token.value);
  assert.ok(res.cookies.refresh_token.value);
  assert.equal(refreshSessions.size, 1);
  assert.ok(mfaChallenges.get(MFA_CHALLENGE_ID)?.verifiedAt);
  assert.ok(auditLogs.some((entry: any) => entry.action === 'MFA_VERIFIED'));
});

test('wrong OTP fails and increments attempts', async () => {
  await addUser({ role: 'SCHOOL_ADMIN' });
  seedMfaChallenge({ otp: '123456' });

  const res = await invoke(
    verifyTwoFactor,
    createRequest({
      body: {
        challengeId: MFA_CHALLENGE_ID,
        otp: '654321',
      },
    }),
  );

  assert.equal(res.statusCode, 401);
  assert.equal((res.body as any).error.message, 'Invalid or expired verification code.');
  assert.equal(mfaChallenges.get(MFA_CHALLENGE_ID)?.attempts, 1);
  assert.equal(refreshSessions.size, 0);
  assert.ok(auditLogs.some((entry: any) => entry.action === 'MFA_FAILED'));
});

test('expired OTP fails without creating a session', async () => {
  await addUser({ role: 'SCHOOL_ADMIN' });
  seedMfaChallenge({
    otp: '123456',
    expiresAt: new Date(Date.now() - 60_000),
  });

  const res = await invoke(
    verifyTwoFactor,
    createRequest({
      body: {
        challengeId: MFA_CHALLENGE_ID,
        otp: '123456',
      },
    }),
  );

  assert.equal(res.statusCode, 401);
  assert.equal((res.body as any).error.message, 'Invalid or expired verification code.');
  assert.equal(refreshSessions.size, 0);
  assert.equal(mfaChallenges.get(MFA_CHALLENGE_ID)?.verifiedAt, null);
});

test('used OTP cannot be reused', async () => {
  await addUser({ role: 'SCHOOL_ADMIN' });
  seedMfaChallenge({ otp: '123456' });

  const first = await invoke(
    verifyTwoFactor,
    createRequest({
      body: {
        challengeId: MFA_CHALLENGE_ID,
        otp: '123456',
      },
    }),
  );
  assert.equal(first.statusCode, 200);

  const second = await invoke(
    verifyTwoFactor,
    createRequest({
      body: {
        challengeId: MFA_CHALLENGE_ID,
        otp: '123456',
      },
    }),
  );

  assert.equal(second.statusCode, 401);
  assert.equal((second.body as any).error.message, 'Invalid or expired verification code.');
  assert.equal(refreshSessions.size, 1);
});

test('too many wrong OTP attempts blocks the challenge', async () => {
  await addUser({ role: 'SCHOOL_ADMIN' });
  seedMfaChallenge({ otp: '123456', maxAttempts: 5 });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await invoke(
      verifyTwoFactor,
      createRequest({
        body: {
          challengeId: MFA_CHALLENGE_ID,
          otp: '654321',
        },
      }),
    );
    assert.equal(res.statusCode, 401);
  }

  const blocked = await invoke(
    verifyTwoFactor,
    createRequest({
      body: {
        challengeId: MFA_CHALLENGE_ID,
        otp: '123456',
      },
    }),
  );

  assert.equal(blocked.statusCode, 401);
  assert.equal((blocked.body as any).error.message, 'Invalid or expired verification code.');
  assert.equal(mfaChallenges.get(MFA_CHALLENGE_ID)?.attempts, 5);
  assert.equal(refreshSessions.size, 0);
});

test('user cannot verify another request context challenge', async () => {
  await addUser({ id: SECOND_USER_ID, email: 'other-admin@example.com', role: 'SCHOOL_ADMIN' });
  seedMfaChallenge({
    otp: '123456',
    userId: SECOND_USER_ID,
    createdIp: '10.0.0.5',
    userAgent: 'other-browser',
  });

  const res = await invoke(
    verifyTwoFactor,
    createRequest({
      body: {
        challengeId: MFA_CHALLENGE_ID,
        otp: '123456',
      },
      ip: '127.0.0.1',
      userAgent: 'node-test-agent',
    }),
  );

  assert.equal(res.statusCode, 401);
  assert.equal((res.body as any).error.message, 'Invalid or expired verification code.');
  assert.equal(refreshSessions.size, 0);
  assert.equal(mfaChallenges.get(MFA_CHALLENGE_ID)?.verifiedAt, null);
});

test('resend 2fa updates otp hash, resets attempts, and does not expose otp', async () => {
  await addUser({ role: 'SCHOOL_ADMIN' });
  const originalExpiresAt = new Date(Date.now() + 60_000);
  const challenge = seedMfaChallenge({
    otp: '123456',
    attempts: 2,
    expiresAt: originalExpiresAt,
  });
  const originalHash = challenge.otpHash;

  const res = await invoke(
    resendTwoFactor,
    createRequest({
      body: {
        challengeId: MFA_CHALLENGE_ID,
      },
      originalUrl: '/api/v1/auth/resend-2fa',
    }),
  );

  const updated = mfaChallenges.get(MFA_CHALLENGE_ID)!;
  assert.equal(res.statusCode, 200);
  assert.equal((res.body as any).mfaRequired, true);
  assert.equal((res.body as any).challengeId, MFA_CHALLENGE_ID);
  assert.equal((res.body as any).message, 'Verification code sent to your email.');
  assert.equal((res.body as any).otp, undefined);
  assert.equal(updated.attempts, 0);
  assert.match(updated.otpHash, /^[0-9a-f]{64}$/);
  assert.notEqual(updated.otpHash, originalHash);
  assert.ok(updated.expiresAt > originalExpiresAt);
  assert.ok(auditLogs.some((entry: any) => entry.action === 'MFA_OTP_RESENT'));
});

test('resend 2fa rejects verified challenge', async () => {
  await addUser({ role: 'SCHOOL_ADMIN' });
  seedMfaChallenge({ otp: '123456', verifiedAt: new Date() });

  const res = await invoke(
    resendTwoFactor,
    createRequest({
      body: {
        challengeId: MFA_CHALLENGE_ID,
      },
      originalUrl: '/api/v1/auth/resend-2fa',
    }),
  );

  assert.equal(res.statusCode, 401);
  assert.equal((res.body as any).error.message, 'Invalid or expired verification code.');
  assert.equal(auditLogs.some((entry: any) => entry.action === 'MFA_OTP_RESENT'), false);
});

test('resend 2fa is rate limited by challenge', async () => {
  await addUser({ role: 'SCHOOL_ADMIN' });
  seedMfaChallenge({ otp: '123456' });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await invoke(
      resendTwoFactor,
      createRequest({
        body: {
          challengeId: MFA_CHALLENGE_ID,
        },
        originalUrl: '/api/v1/auth/resend-2fa',
      }),
    );
    assert.equal(res.statusCode, 200);
  }

  const limited = await invoke(
    resendTwoFactor,
    createRequest({
      body: {
        challengeId: MFA_CHALLENGE_ID,
      },
      originalUrl: '/api/v1/auth/resend-2fa',
    }),
  );

  assert.equal(limited.statusCode, 429);
  assert.equal((limited.body as any).error.message, RATE_LIMIT_MESSAGE);
});

test('wrong password returns generic login error', async () => {
  const res = await invoke(login, loginRequest('WrongPassword@123'));

  assert.equal(res.statusCode, 401);
  assert.equal((res.body as any).error.message, GENERIC_LOGIN_ERROR);
});

test('non-existing user returns generic login error', async () => {
  const res = await invoke(
    login,
    createRequest({
      body: {
        email: 'missing@example.com',
        password: OLD_PASSWORD,
        schoolCode: 'SCHA',
        loginType: 'admin',
      },
    }),
  );

  assert.equal(res.statusCode, 401);
  assert.equal((res.body as any).error.message, GENERIC_LOGIN_ERROR);
});

test('disabled user returns generic login error', async () => {
  const user = findUserById(USER_ID)!;
  user.status = 'INACTIVE';

  const res = await invoke(login, loginRequest());

  assert.equal(res.statusCode, 401);
  assert.equal((res.body as any).error.message, GENERIC_LOGIN_ERROR);
});

test('user from school A cannot login to school B', async () => {
  const res = await invoke(login, loginRequest(OLD_PASSWORD, 'SCHB'));

  assert.equal(res.statusCode, 401);
  assert.equal((res.body as any).error.message, GENERIC_LOGIN_ERROR);
  assert.equal(refreshSessions.size, 0);
});

test('remember me does not store password in localStorage', () => {
  const loginPage = fs.readFileSync(path.resolve(process.cwd(), '../admin/app/login/page.tsx'), 'utf8');
  const rememberStorageWrites = loginPage.match(/localStorage\.setItem\(\s*'login\.remember'[\s\S]{0,900}/g) ?? [];

  assert.ok(rememberStorageWrites.length > 0);
  assert.equal(rememberStorageWrites.some((write) => /password\s*:/.test(write)), false);
  assert.equal(/parsed\.password|setPassword\(\s*parsed/.test(loginPage), false);
});

test('logout revokes the current refresh session', async () => {
  const loginRes = await invoke(login, loginRequest());
  const refresh = loginRes.cookies.refresh_token.value;

  const logoutRes = await invoke(
    logout,
    createRequest({
      cookie: `refresh_token=${encodeURIComponent(refresh)}`,
      originalUrl: '/api/v1/auth/logout',
    }),
  );

  assert.equal(logoutRes.statusCode, 200);
  assert.equal(Array.from(refreshSessions.values())[0].revokedAt instanceof Date, true);
  assert.ok(logoutRes.clearedCookies.includes('refresh_token'));
});

test('revoked refresh token cannot be used', async () => {
  const loginRes = await invoke(login, loginRequest());
  const refresh = loginRes.cookies.refresh_token.value;
  await invoke(logout, createRequest({ cookie: `refresh_token=${encodeURIComponent(refresh)}` }));

  const refreshRes = await invoke(
    refreshToken,
    createRequest({
      body: {},
      cookie: `refresh_token=${encodeURIComponent(refresh)}`,
      originalUrl: '/api/v1/auth/refresh',
    }),
  );

  assert.equal(refreshRes.statusCode, 401);
  assert.equal((refreshRes.body as any).error.message, 'Invalid refresh token');
});

test('forgot password always returns generic message', async () => {
  const valid = await invoke(
    forgotPassword,
    createRequest({
      body: { email: EMAIL, schoolCode: 'SCHA' },
      originalUrl: '/api/v1/auth/forgot-password',
    }),
  );
  const invalid = await invoke(
    forgotPassword,
    createRequest({
      body: { email: 'missing@example.com', schoolCode: 'SCHA' },
      originalUrl: '/api/v1/auth/forgot-password',
    }),
  );

  assert.equal(valid.statusCode, 200);
  assert.equal(invalid.statusCode, 200);
  assert.equal((valid.body as any).message, GENERIC_FORGOT_PASSWORD_MESSAGE);
  assert.deepEqual(valid.body, invalid.body);
});

test('forgot password creates token only for valid user', async () => {
  await invoke(
    forgotPassword,
    createRequest({
      body: { email: 'missing@example.com', schoolCode: 'SCHA' },
      originalUrl: '/api/v1/auth/forgot-password',
    }),
  );
  assert.equal(resetTokens.size, 0);

  await invoke(
    forgotPassword,
    createRequest({
      body: { email: EMAIL, schoolCode: 'SCHA' },
      originalUrl: '/api/v1/auth/forgot-password',
    }),
  );
  assert.equal(resetTokens.size, 1);
});

test('reset password works, revokes sessions, rejects old password, and accepts new password', async () => {
  const rawToken = 'valid-reset-token';
  seedResetToken({ rawToken });
  const loginRes = await invoke(login, loginRequest());
  assert.equal(refreshSessions.size, 1);

  const resetRes = await invoke(
    resetPassword,
    createRequest({
      body: {
        token: rawToken,
        newPassword: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD,
      },
      cookie: `refresh_token=${encodeURIComponent(loginRes.cookies.refresh_token.value)}`,
      originalUrl: '/api/v1/auth/reset-password',
    }),
  );

  assert.equal(resetRes.statusCode, 200);
  assert.equal((resetRes.body as any).message, RESET_SUCCESS_MESSAGE);
  assert.equal(Array.from(resetTokens.values())[0].usedAt instanceof Date, true);
  assert.equal(Array.from(refreshSessions.values())[0].revokedAt instanceof Date, true);

  const oldPasswordRes = await invoke(login, loginRequest(OLD_PASSWORD));
  assert.equal(oldPasswordRes.statusCode, 401);
  assert.equal((oldPasswordRes.body as any).error.message, GENERIC_LOGIN_ERROR);

  const newPasswordRes = await invoke(login, loginRequest(NEW_PASSWORD));
  assert.equal(newPasswordRes.statusCode, 200);
  assert.equal((newPasswordRes.body as any).user.email, EMAIL);
});

test('reset password rejects expired token', async () => {
  seedResetToken({
    rawToken: 'expired-reset-token',
    expiresAt: new Date(Date.now() - 60_000),
  });

  const res = await invoke(
    resetPassword,
    createRequest({
      body: {
        token: 'expired-reset-token',
        newPassword: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD,
      },
      originalUrl: '/api/v1/auth/reset-password',
    }),
  );

  assert.equal(res.statusCode, 400);
  assert.equal((res.body as any).error.message, INVALID_RESET_TOKEN_MESSAGE);
});

test('reset password rejects used token', async () => {
  seedResetToken({
    rawToken: 'used-reset-token',
    usedAt: new Date(),
  });

  const res = await invoke(
    resetPassword,
    createRequest({
      body: {
        token: 'used-reset-token',
        newPassword: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD,
      },
      originalUrl: '/api/v1/auth/reset-password',
    }),
  );

  assert.equal(res.statusCode, 400);
  assert.equal((res.body as any).error.message, INVALID_RESET_TOKEN_MESSAGE);
});

test('rate limit blocks repeated login attempts', async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await invoke(login, loginRequest('WrongPassword@123'));
    assert.equal(res.statusCode, 401);
    assert.equal((res.body as any).error.message, GENERIC_LOGIN_ERROR);
  }

  const limited = await invoke(login, loginRequest('WrongPassword@123'));

  assert.equal(limited.statusCode, 429);
  assert.equal((limited.body as any).error.message, RATE_LIMIT_MESSAGE);
});
