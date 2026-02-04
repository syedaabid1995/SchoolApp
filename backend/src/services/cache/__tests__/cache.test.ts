import test from 'node:test';
import assert from 'node:assert/strict';

import { env } from '../../../config/env';
import { redis } from '../../../config/redis';
import { buildKey } from '../cache.keys';
import {
  delKeys,
  getJson,
  remember,
  setJson,
} from '../cache.service';

type RedisMock = {
  get?: (key: string) => Promise<string | null>;
  set?: (key: string, value: string, ex: 'EX', ttl: number) => Promise<unknown>;
  del?: (...keys: string[]) => Promise<number>;
  scan?: (cursor: string, mode: 'MATCH', pattern: string, countKey: 'COUNT', count: string) => Promise<[string, string[]]>;
};

const originalGet = redis.get.bind(redis);
const originalSet = redis.set.bind(redis);
const originalDel = redis.del.bind(redis);
const originalScan = redis.scan.bind(redis);
const originalCacheEnabled = env.REDIS_CACHE_ENABLED;

const patchRedis = (mock: RedisMock) => {
  if (mock.get) (redis as unknown as { get: RedisMock['get'] }).get = mock.get;
  if (mock.set) (redis as unknown as { set: RedisMock['set'] }).set = mock.set;
  if (mock.del) (redis as unknown as { del: RedisMock['del'] }).del = mock.del;
  if (mock.scan) (redis as unknown as { scan: RedisMock['scan'] }).scan = mock.scan;
};

const restoreRedis = () => {
  (redis as unknown as { get: typeof originalGet }).get = originalGet;
  (redis as unknown as { set: typeof originalSet }).set = originalSet;
  (redis as unknown as { del: typeof originalDel }).del = originalDel;
  (redis as unknown as { scan: typeof originalScan }).scan = originalScan;
};

test.afterEach(() => {
  restoreRedis();
  env.REDIS_CACHE_ENABLED = originalCacheEnabled;
});

test('buildKey sanitizes and joins values', () => {
  const key = buildKey('cache', 'schools list', '58e2/001', null, true);
  assert.equal(key, 'cache:schools_list:58e2_001:na:true');
});

test('getJson returns parsed object when key exists', async () => {
  env.REDIS_CACHE_ENABLED = true;
  patchRedis({
    get: async () => JSON.stringify({ ok: true }),
  });

  const value = await getJson<{ ok: boolean }>('cache:test');
  assert.deepEqual(value, { ok: true });
});

test('setJson stores JSON payload with ttl', async () => {
  env.REDIS_CACHE_ENABLED = true;
  const calls: Array<[string, string, 'EX', number]> = [];
  patchRedis({
    set: async (key, value, ex, ttl) => {
      calls.push([key, value, ex, ttl]);
      return 'OK';
    },
  });

  await setJson('cache:test', { count: 2 }, 60);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'cache:test');
  assert.equal(calls[0][2], 'EX');
  assert.equal(calls[0][3], 60);
  assert.deepEqual(JSON.parse(calls[0][1]), { count: 2 });
});

test('delKeys deletes explicit keys and wildcard patterns', async () => {
  env.REDIS_CACHE_ENABLED = true;
  const deleted: string[][] = [];
  const scans: string[] = [];
  patchRedis({
    del: async (...keys: string[]) => {
      deleted.push(keys);
      return keys.length;
    },
    scan: async (cursor, _mode, pattern) => {
      scans.push(pattern);
      if (cursor === '0') return ['1', ['cache:a', 'cache:b']];
      return ['0', []];
    },
  });

  await delKeys(['cache:one', 'cache:two']);
  await delKeys('cache:*');

  assert.deepEqual(deleted[0], ['cache:one', 'cache:two']);
  assert.deepEqual(deleted[1], ['cache:a', 'cache:b']);
  assert.deepEqual(scans, ['cache:*', 'cache:*']);
});

test('remember returns HIT when cached value exists', async () => {
  env.REDIS_CACHE_ENABLED = true;
  patchRedis({
    get: async () => JSON.stringify({ total: 10 }),
  });

  let fetcherCalled = false;
  const result = await remember('cache:dash', 30, async () => {
    fetcherCalled = true;
    return { total: 99 };
  });

  assert.equal(result.status, 'HIT');
  assert.deepEqual(result.value, { total: 10 });
  assert.equal(fetcherCalled, false);
});

test('remember returns MISS and caches fetcher result', async () => {
  env.REDIS_CACHE_ENABLED = true;
  const sets: string[] = [];
  patchRedis({
    get: async () => null,
    set: async (_key, value) => {
      sets.push(value);
      return 'OK';
    },
  });

  const result = await remember('cache:dash', 30, async () => ({ total: 99 }));
  assert.equal(result.status, 'MISS');
  assert.deepEqual(result.value, { total: 99 });
  assert.deepEqual(JSON.parse(sets[0]), { total: 99 });
});

test('remember returns BYPASS when cache is disabled', async () => {
  env.REDIS_CACHE_ENABLED = false;
  let fetcherCalled = false;

  const result = await remember('cache:dash', 30, async () => {
    fetcherCalled = true;
    return { total: 5 };
  });

  assert.equal(result.status, 'BYPASS');
  assert.deepEqual(result.value, { total: 5 });
  assert.equal(fetcherCalled, true);
});
