import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { redis } from '../../config/redis';
import type { CacheResult, CacheStatus } from './cache.types';

const cacheEnabled = () => env.REDIS_CACHE_ENABLED;
const debugEnabled = () => env.REDIS_CACHE_DEBUG;
const inFlightByKey = new Map<string, Promise<unknown>>();

const logDebug = (payload: Record<string, unknown>, message: string) => {
  if (!debugEnabled()) return;
  logger.debug(payload, message);
};

const resolveCacheDomain = (key: string) => key.split(':')[1] ?? '';

const isCacheDomainEnabled = (domain: string) => {
  switch (domain) {
    case 'admin_dashboard':
      return env.REDIS_CACHE_DASHBOARD_ENABLED;
    case 'analytics':
      return env.REDIS_CACHE_ANALYTICS_ENABLED;
    case 'schools':
      return env.REDIS_CACHE_SCHOOLS_ENABLED;
    case 'students':
      return env.REDIS_CACHE_STUDENTS_ENABLED;
    case 'teachers':
      return env.REDIS_CACHE_TEACHERS_ENABLED;
    case 'attendance':
      return env.REDIS_CACHE_ATTENDANCE_ENABLED;
    case 'notifications':
      return env.REDIS_CACHE_NOTIFICATIONS_ENABLED;
    case 'subscription_plans':
    case 'subscription_metrics':
    case 'subscription':
      return env.REDIS_CACHE_SUBSCRIPTIONS_ENABLED;
    case 'themes':
      return env.REDIS_CACHE_THEMES_ENABLED;
    case 'audit_logs':
      return env.REDIS_CACHE_AUDIT_LOGS_ENABLED;
    case 'marks':
      return env.REDIS_CACHE_MARKS_ENABLED;
    default:
      return true;
  }
};

const isCacheAllowedForKey = (key: string) => {
  if (!cacheEnabled()) return false;
  const domain = resolveCacheDomain(key);
  if (!domain) return true;
  return isCacheDomainEnabled(domain);
};

export const getCacheJson = async <T>(key: string): Promise<T | null> => {
  if (!isCacheAllowedForKey(key)) return null;
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logDebug({ err, key }, 'cache get failed');
    return null;
  }
};

export const setCacheJson = async (key: string, value: unknown, ttlSeconds: number) => {
  if (!isCacheAllowedForKey(key)) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    logDebug({ key, ttlSeconds }, 'cache set');
  } catch (err) {
    logDebug({ err, key }, 'cache set failed');
  }
};

export const deleteCacheKeys = async (keys: string[]) => {
  if (!cacheEnabled() || keys.length === 0) return;
  try {
    await redis.del(...keys);
    logDebug({ keysCount: keys.length }, 'cache delete keys');
  } catch (err) {
    logDebug({ err, keys }, 'cache delete keys failed');
  }
};

export const deleteCacheByPattern = async (pattern: string) => {
  if (!cacheEnabled()) return;
  try {
    let cursor = '0';
    const matched: string[] = [];
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', '100');
      cursor = nextCursor;
      if (keys.length) matched.push(...keys);
    } while (cursor !== '0');

    if (matched.length) {
      await redis.del(...matched);
      logDebug({ pattern, deleted: matched.length }, 'cache delete pattern');
    }
  } catch (err) {
    logDebug({ err, pattern }, 'cache delete pattern failed');
  }
};

// Prompt-3 aliases (stable API names)
export const getJson = getCacheJson;
export const setJson = setCacheJson;

/**
 * Deletes explicit keys or a wildcard pattern.
 * - string[] => direct DEL
 * - string   => SCAN + DEL by pattern
 */
export const delKeys = async (keysOrPattern: string[] | string) => {
  if (Array.isArray(keysOrPattern)) {
    await deleteCacheKeys(keysOrPattern);
    return;
  }
  await deleteCacheByPattern(keysOrPattern);
};

export const rememberCache = async <T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<CacheResult<T>> => {
  if (!isCacheAllowedForKey(key)) {
    const value = await fetcher();
    return { value, status: 'BYPASS' };
  }

  const cached = await getCacheJson<T>(key);
  if (cached !== null) {
    logDebug({ key }, 'cache hit');
    return { value: cached, status: 'HIT' };
  }

  const existing = inFlightByKey.get(key) as Promise<T> | undefined;
  if (existing) {
    const value = await existing;
    logDebug({ key }, 'cache single-flight wait');
    return { value, status: 'MISS' };
  }

  const load = (async () => {
    const value = await fetcher();
    await setCacheJson(key, value, ttlSeconds);
    return value;
  })();

  inFlightByKey.set(key, load);
  try {
    const value = await load;
    logDebug({ key }, 'cache miss');
    return { value, status: 'MISS' };
  } finally {
    inFlightByKey.delete(key);
  }
};

export const remember = rememberCache;

export const setCacheHeader = (res: { setHeader: (name: string, value: string) => void }, status: CacheStatus) => {
  res.setHeader('X-Cache', status);
};
