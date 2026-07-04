import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { isLoadTestingRateLimitBypass, rateLimit } from '../middlewares/rate-limit.middleware';

const originalLoadTestingEnabled = env.LOAD_TESTING_ENABLED;
const originalLoadTestingSecret = env.LOAD_TESTING_SECRET;
const originalNodeEnv = env.NODE_ENV;
const originalLoggerInfo = logger.info;

afterEach(() => {
  env.LOAD_TESTING_ENABLED = originalLoadTestingEnabled;
  env.LOAD_TESTING_SECRET = originalLoadTestingSecret;
  env.NODE_ENV = originalNodeEnv;
  (logger as unknown as { info: typeof originalLoggerInfo }).info = originalLoggerInfo;
});

const createRequest = (headers: Record<string, string | string[]> = {}, path = '/api/v1/users/me') =>
  ({
    headers,
    path,
    method: 'GET',
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  }) as unknown as Request;

test('load-test bypass is disabled by default even when a header is supplied', () => {
  env.LOAD_TESTING_ENABLED = false;
  env.LOAD_TESTING_SECRET = 'test-load-secret';

  assert.equal(
    isLoadTestingRateLimitBypass(createRequest({ 'x-load-test-key': 'test-load-secret' })),
    false,
  );
});

test('load-test bypass requires enabled flag and matching x-load-test-key', () => {
  env.LOAD_TESTING_ENABLED = true;
  env.LOAD_TESTING_SECRET = 'test-load-secret';

  assert.equal(
    isLoadTestingRateLimitBypass(createRequest({ 'x-load-test-key': 'test-load-secret' })),
    true,
  );
  assert.equal(
    isLoadTestingRateLimitBypass(createRequest({ 'x-load-test-key': 'wrong-secret' })),
    false,
  );
  assert.equal(isLoadTestingRateLimitBypass(createRequest()), false);
});

test('load-test bypass logs and skips only the global rate limiter', async () => {
  env.NODE_ENV = 'development';
  env.LOAD_TESTING_ENABLED = true;
  env.LOAD_TESTING_SECRET = 'test-load-secret';

  const logs: unknown[][] = [];
  (logger as unknown as { info: (...args: unknown[]) => void }).info = (...args: unknown[]) => {
    logs.push(args);
  };

  let nextCalls = 0;
  let nextError: unknown;
  const next: NextFunction = (err?: unknown) => {
    nextCalls += 1;
    nextError = err;
  };

  await rateLimit()(
    createRequest({ 'x-load-test-key': 'test-load-secret' }),
    {} as Response,
    next,
  );

  assert.equal(nextCalls, 1);
  assert.equal(nextError, undefined);
  assert.equal(logs.length, 1);
  assert.equal(logs[0][1], 'load-test rate limit bypass used');
});
