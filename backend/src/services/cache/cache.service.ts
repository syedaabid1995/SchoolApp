import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { redis } from '../../config/redis';
import type { CacheResult, CacheStatus } from './cache.types';

const cacheEnabled = () => env.REDIS_CACHE_ENABLED;
const debugEnabled = () => env.REDIS_CACHE_DEBUG;

const logDebug = (payload: Record<string, unknown>, message: string) => {
  if (!debugEnabled()) return;
  logger.debug(payload, message);
};

export const getCacheJson = async <T>(key: string): Promise<T | null> => {
  if (!cacheEnabled()) return null;
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
  if (!cacheEnabled()) return;
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
  if (!cacheEnabled()) {
    const value = await fetcher();
    return { value, status: 'BYPASS' };
  }

  const cached = await getCacheJson<T>(key);
  if (cached !== null) {
    logDebug({ key }, 'cache hit');
    return { value: cached, status: 'HIT' };
  }

  const value = await fetcher();
  await setCacheJson(key, value, ttlSeconds);
  logDebug({ key }, 'cache miss');
  return { value, status: 'MISS' };
};

export const remember = rememberCache;

export const setCacheHeader = (res: { setHeader: (name: string, value: string) => void }, status: CacheStatus) => {
  res.setHeader('X-Cache', status);
};
