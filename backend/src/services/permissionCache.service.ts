import { env } from '../config/env';
import { logger } from '../config/logger';

const AUTHZ_CACHE_TTL_SECONDS = 300;
const INDEX_TTL_SECONDS = AUTHZ_CACHE_TTL_SECONDS + 60;

export type CachedEffectivePermissions = {
  permissions: string[];
  role: string | null;
  plan: string | null;
  generatedAt: string;
};

type CacheScope = {
  schoolId: string;
  userId?: string;
  roleName?: string | null;
  planId?: string | null;
};

type PermissionCacheRedisClient = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ex: 'EX', ttl: number) => Promise<unknown>;
  sadd: (key: string, member: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  smembers: (key: string) => Promise<string[]>;
  del: (...keys: string[]) => Promise<number>;
};

let redisClientForTests: PermissionCacheRedisClient | null = null;

const cacheEnabled = () => env.REDIS_CACHE_ENABLED && env.REDIS_AUTHZ_CACHE_ENABLED;
const getRedis = async (): Promise<PermissionCacheRedisClient> =>
  redisClientForTests ?? (await import('../config/redis')).redis;

const normalizeRole = (roleName: string | null | undefined) => (roleName ?? 'none').toUpperCase();

const measure = () => {
  const startedAt = process.hrtime.bigint();
  return () => Number(process.hrtime.bigint() - startedAt) / 1_000_000;
};

const logMetric = (event: string, payload: Record<string, unknown>) => {
  logger.debug({ event, ...payload }, event);
};

const userKey = (schoolId: string, userId: string, roleName: string | null | undefined) =>
  `authz:${schoolId}:${userId}:${normalizeRole(roleName)}`;

const roleKey = (schoolId: string, roleName: string | null | undefined) =>
  `authz:role:${schoolId}:${normalizeRole(roleName)}`;

const planSchoolKey = (schoolId: string) => `authz:plan-school:${schoolId}`;
const schoolIndexKey = (schoolId: string) => `authz:index:school:${schoolId}`;
const userIndexKey = (schoolId: string, userId: string) => `authz:index:user:${schoolId}:${userId}`;
const roleIndexKey = (schoolId: string, roleName: string | null | undefined) =>
  `authz:index:role:${schoolId}:${normalizeRole(roleName)}`;
const planIndexKey = (planId: string) => `authz:index:plan:${planId}`;

const readJson = async <T>(key: string, scope: CacheScope): Promise<T | null> => {
  if (!cacheEnabled()) return null;
  const latency = measure();
  try {
    const redis = await getRedis();
    const raw = await redis.get(key);
    const latencyMs = latency();
    if (!raw) {
      logMetric('authorization_cache_miss', { key, latencyMs, ...scope });
      return null;
    }
    logMetric('authorization_cache_hit', { key, latencyMs, ...scope });
    return JSON.parse(raw) as T;
  } catch (err) {
    logMetric('authorization_cache_error', { key, err, ...scope });
    return null;
  }
};

const writeJson = async (
  key: string,
  value: unknown,
  scope: CacheScope,
  indexes: string[],
) => {
  if (!cacheEnabled()) return;
  const latency = measure();
  try {
    const redis = await getRedis();
    await redis.set(key, JSON.stringify(value), 'EX', AUTHZ_CACHE_TTL_SECONDS);
    if (indexes.length) {
      await Promise.all(indexes.map(async (indexKey) => {
        await redis.sadd(indexKey, key);
        await redis.expire(indexKey, INDEX_TTL_SECONDS);
      }));
    }
    logMetric('authorization_cache_rebuild', { key, latencyMs: latency(), ...scope });
  } catch (err) {
    logMetric('authorization_cache_error', { key, err, ...scope });
  }
};

const deleteIndexedKeys = async (indexKey: string) => {
  if (!cacheEnabled()) return;
  try {
    const redis = await getRedis();
    const keys = await redis.smembers(indexKey);
    const keysToDelete = [...keys, indexKey];
    if (keysToDelete.length) {
      await redis.del(...keysToDelete);
    }
    logMetric('authorization_cache_invalidate', { indexKey, keysCount: keys.length });
  } catch (err) {
    logMetric('authorization_cache_error', { indexKey, err });
  }
};

export const PermissionCacheService = {
  userKey,
  roleKey,
  planSchoolKey,

  getUserPermissions(schoolId: string, userId: string, roleName: string | null | undefined) {
    return readJson<CachedEffectivePermissions>(
      userKey(schoolId, userId, roleName),
      { schoolId, userId, roleName },
    );
  },

  async setUserPermissions(
    schoolId: string,
    userId: string,
    roleName: string | null | undefined,
    planId: string | null,
    permissions: string[],
  ) {
    const indexes = [
      schoolIndexKey(schoolId),
      userIndexKey(schoolId, userId),
      roleIndexKey(schoolId, roleName),
      ...(planId ? [planIndexKey(planId)] : []),
    ];
    await writeJson(
      userKey(schoolId, userId, roleName),
      { permissions, role: roleName ?? null, plan: planId, generatedAt: new Date().toISOString() },
      { schoolId, userId, roleName, planId },
      indexes,
    );
  },

  getRolePermissions(schoolId: string, roleName: string | null | undefined) {
    return readJson<CachedEffectivePermissions>(
      roleKey(schoolId, roleName),
      { schoolId, roleName },
    );
  },

  async setRolePermissions(
    schoolId: string,
    roleName: string | null | undefined,
    planId: string | null,
    permissions: string[],
  ) {
    const indexes = [
      schoolIndexKey(schoolId),
      roleIndexKey(schoolId, roleName),
      ...(planId ? [planIndexKey(planId)] : []),
    ];
    await writeJson(
      roleKey(schoolId, roleName),
      { permissions, role: roleName ?? null, plan: planId, generatedAt: new Date().toISOString() },
      { schoolId, roleName, planId },
      indexes,
    );
  },

  getPlanPermissions(schoolId: string) {
    return readJson<{ permissions: string[]; plan: string | null; generatedAt: string }>(
      planSchoolKey(schoolId),
      { schoolId },
    );
  },

  async setPlanPermissions(schoolId: string, planId: string | null, permissions: string[]) {
    const indexes = [
      schoolIndexKey(schoolId),
      ...(planId ? [planIndexKey(planId)] : []),
    ];
    await writeJson(
      planSchoolKey(schoolId),
      { permissions, plan: planId, generatedAt: new Date().toISOString() },
      { schoolId, planId },
      indexes,
    );
  },

  invalidateSchool(schoolId: string) {
    return deleteIndexedKeys(schoolIndexKey(schoolId));
  },

  invalidateUser(schoolId: string, userId: string) {
    return deleteIndexedKeys(userIndexKey(schoolId, userId));
  },

  invalidateRole(schoolId: string, roleName: string | null | undefined) {
    return deleteIndexedKeys(roleIndexKey(schoolId, roleName));
  },

  invalidatePlan(planId: string) {
    return deleteIndexedKeys(planIndexKey(planId));
  },

  setRedisClientForTests(client: PermissionCacheRedisClient | null) {
    redisClientForTests = client;
  },
};
