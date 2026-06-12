import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { PermissionCodes as P } from '../permissions/permission-manifest';
import { AuthorizationService } from '../services/authorization.service';
import { PermissionCacheService } from '../services/permissionCache.service';

const SCHOOL_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const PLAN_ID = 'plan-1';

type RedisMock = {
  get?: (key: string) => Promise<string | null>;
  set?: (key: string, value: string, ex: 'EX', ttl: number) => Promise<unknown>;
  sadd?: (key: string, member: string) => Promise<number>;
  expire?: (key: string, seconds: number) => Promise<number>;
  smembers?: (key: string) => Promise<string[]>;
  del?: (...keys: string[]) => Promise<number>;
  scan?: (...args: unknown[]) => Promise<unknown>;
};

const originalCacheEnabled = env.REDIS_AUTHZ_CACHE_ENABLED;
const originalRedisCacheEnabled = env.REDIS_CACHE_ENABLED;

const patch = <T extends object, K extends keyof T>(target: T, key: K, value: T[K]) => {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
};

const patchRedis = (mock: RedisMock) => {
  PermissionCacheService.setRedisClientForTests({
    get: mock.get ?? (async () => null),
    set: mock.set ?? (async () => 'OK'),
    sadd: mock.sadd ?? (async () => 1),
    expire: mock.expire ?? (async () => 1),
    smembers: mock.smembers ?? (async () => []),
    del: mock.del ?? (async (...keys: string[]) => keys.length),
  });
};

test.afterEach(() => {
  PermissionCacheService.setRedisClientForTests(null);
  env.REDIS_AUTHZ_CACHE_ENABLED = originalCacheEnabled;
  env.REDIS_CACHE_ENABLED = originalRedisCacheEnabled;
});

test('AuthorizationService uses cached effective permissions without Prisma lookups', async () => {
  env.REDIS_AUTHZ_CACHE_ENABLED = true;
  env.REDIS_CACHE_ENABLED = true;
  const key = PermissionCacheService.userKey(SCHOOL_ID, USER_ID, 'SCHOOL_ADMIN');
  patchRedis({
    get: async (requestedKey) => {
      assert.equal(requestedKey, key);
      return JSON.stringify({
        permissions: [P.payrollView],
        role: 'SCHOOL_ADMIN',
        plan: PLAN_ID,
        generatedAt: new Date().toISOString(),
      });
    },
  });

  const restores = [
    patch(prisma.subscription as any, 'findUnique', async () => {
      throw new Error('subscription lookup should not run on authorization cache hit');
    }),
    patch(prisma.subscriptionPlanPermission as any, 'findMany', async () => {
      throw new Error('plan permission lookup should not run on authorization cache hit');
    }),
    patch(prisma.employeeRolePermission as any, 'findMany', async () => {
      throw new Error('role override lookup should not run on authorization cache hit');
    }),
    patch(prisma.employeeUserPermission as any, 'findMany', async () => {
      throw new Error('user override lookup should not run on authorization cache hit');
    }),
  ];

  try {
    const allowed = await AuthorizationService.hasAnyEffectivePermission(
      { schoolId: SCHOOL_ID, userId: USER_ID, role: 'SCHOOL_ADMIN' },
      P.payrollView,
    );
    assert.equal(allowed, true);
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test('AuthorizationService rebuilds and stores cache on miss with one plan lookup', async () => {
  env.REDIS_AUTHZ_CACHE_ENABLED = true;
  env.REDIS_CACHE_ENABLED = true;
  let subscriptionLookups = 0;
  let planPermissionLookups = 0;
  let roleOverrideLookups = 0;
  let userOverrideLookups = 0;
  const stored: string[] = [];
  const indexed: Array<[string, string]> = [];

  patchRedis({
    get: async () => null,
    set: async (_key, value) => {
      stored.push(value);
      return 'OK';
    },
    sadd: async (key, member) => {
      indexed.push([key, member]);
      return 1;
    },
    expire: async () => 1,
  });

  const restores = [
    patch(prisma.subscription as any, 'findUnique', async () => {
      subscriptionLookups += 1;
      return { planId: PLAN_ID };
    }),
    patch(prisma.subscriptionPlanPermission as any, 'findMany', async () => {
      planPermissionLookups += 1;
      return [{ permissionCode: P.attendanceCreate, enabled: true }];
    }),
    patch(prisma.employeeRolePermission as any, 'findMany', async () => {
      roleOverrideLookups += 1;
      return [];
    }),
    patch(prisma.employeeUserPermission as any, 'findMany', async () => {
      userOverrideLookups += 1;
      return [];
    }),
  ];

  try {
    const codes = await AuthorizationService.getEffectivePermissionCodesForUser(
      SCHOOL_ID,
      USER_ID,
      'SCHOOL_ADMIN',
    );
    assert.deepEqual(codes, [P.attendanceCreate]);
    assert.equal(subscriptionLookups, 1);
    assert.equal(planPermissionLookups, 1);
    assert.equal(roleOverrideLookups, 1);
    assert.equal(userOverrideLookups, 1);
    assert.equal(stored.length, 1);
    assert.deepEqual(JSON.parse(stored[0]).permissions, [P.attendanceCreate]);
    assert.ok(indexed.some(([key]) => key === `authz:index:school:${SCHOOL_ID}`));
    assert.ok(indexed.some(([key]) => key === `authz:index:user:${SCHOOL_ID}:${USER_ID}`));
    assert.ok(indexed.some(([key]) => key === `authz:index:role:${SCHOOL_ID}:SCHOOL_ADMIN`));
    assert.ok(indexed.some(([key]) => key === `authz:index:plan:${PLAN_ID}`));
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test('user override invalidation deletes exact indexed authz keys without scan', async () => {
  env.REDIS_AUTHZ_CACHE_ENABLED = true;
  env.REDIS_CACHE_ENABLED = true;
  const cachedKey = PermissionCacheService.userKey(SCHOOL_ID, USER_ID, 'SCHOOL_ADMIN');
  const deleted: string[][] = [];
  patchRedis({
    smembers: async (key) => {
      assert.equal(key, `authz:index:user:${SCHOOL_ID}:${USER_ID}`);
      return [cachedKey];
    },
    del: async (...keys) => {
      deleted.push(keys);
      return keys.length;
    },
    scan: async () => {
      throw new Error('authorization invalidation must not use SCAN');
    },
  });

  await PermissionCacheService.invalidateUser(SCHOOL_ID, USER_ID);

  assert.deepEqual(deleted, [[cachedKey, `authz:index:user:${SCHOOL_ID}:${USER_ID}`]]);
});

test('role override invalidation deletes exact indexed authz keys without scan', async () => {
  env.REDIS_AUTHZ_CACHE_ENABLED = true;
  env.REDIS_CACHE_ENABLED = true;
  const roleCacheKey = PermissionCacheService.roleKey(SCHOOL_ID, 'TEACHER');
  const userCacheKey = PermissionCacheService.userKey(SCHOOL_ID, USER_ID, 'TEACHER');
  const deleted: string[][] = [];
  patchRedis({
    smembers: async (key) => {
      assert.equal(key, `authz:index:role:${SCHOOL_ID}:TEACHER`);
      return [roleCacheKey, userCacheKey];
    },
    del: async (...keys) => {
      deleted.push(keys);
      return keys.length;
    },
    scan: async () => {
      throw new Error('authorization invalidation must not use SCAN');
    },
  });

  await PermissionCacheService.invalidateRole(SCHOOL_ID, 'TEACHER');

  assert.deepEqual(deleted, [[roleCacheKey, userCacheKey, `authz:index:role:${SCHOOL_ID}:TEACHER`]]);
});

test('plan permission invalidation deletes exact indexed authz keys without scan', async () => {
  env.REDIS_AUTHZ_CACHE_ENABLED = true;
  env.REDIS_CACHE_ENABLED = true;
  const planCacheKey = PermissionCacheService.planSchoolKey(SCHOOL_ID);
  const userCacheKey = PermissionCacheService.userKey(SCHOOL_ID, USER_ID, 'SCHOOL_ADMIN');
  const deleted: string[][] = [];
  patchRedis({
    smembers: async (key) => {
      assert.equal(key, `authz:index:plan:${PLAN_ID}`);
      return [planCacheKey, userCacheKey];
    },
    del: async (...keys) => {
      deleted.push(keys);
      return keys.length;
    },
    scan: async () => {
      throw new Error('authorization invalidation must not use SCAN');
    },
  });

  await PermissionCacheService.invalidatePlan(PLAN_ID);

  assert.deepEqual(deleted, [[planCacheKey, userCacheKey, `authz:index:plan:${PLAN_ID}`]]);
});
