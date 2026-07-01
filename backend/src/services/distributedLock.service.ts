import crypto from 'crypto';
import { redis } from '../config/redis';
import { logger } from '../config/logger';

export type DistributedLockClient = {
  set: (key: string, value: string, pxMode: 'PX', ttlMs: number, nxMode: 'NX') => Promise<'OK' | null>;
  eval: (script: string, keyCount: number, key: string, token: string) => Promise<number | string>;
};

export type DistributedLock = {
  key: string;
  ownerToken: string;
  release: () => Promise<boolean>;
};

const releaseScript = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

export const acquireDistributedLock = async (params: {
  key: string;
  ttlMs: number;
  client?: DistributedLockClient;
  ownerToken?: string;
}): Promise<DistributedLock | null> => {
  const client = params.client ?? redis;
  const ownerToken = params.ownerToken ?? crypto.randomUUID();
  const result = await client.set(params.key, ownerToken, 'PX', params.ttlMs, 'NX');
  if (result !== 'OK') return null;

  return {
    key: params.key,
    ownerToken,
    release: async () => {
      const released = await client.eval(releaseScript, 1, params.key, ownerToken);
      return Number(released) === 1;
    },
  };
};

export const runWithDistributedLock = async <T>(params: {
  key: string;
  ttlMs: number;
  jobName: string;
  client?: DistributedLockClient;
  run: () => Promise<T>;
  onSkipped?: () => void;
}) => {
  const lock = await acquireDistributedLock({
    key: params.key,
    ttlMs: params.ttlMs,
    client: params.client,
  });

  if (!lock) {
    logger.info({ jobName: params.jobName, lockKey: params.key }, 'scheduled job skipped because lock is held');
    params.onSkipped?.();
    return { status: 'skipped' as const };
  }

  try {
    const value = await params.run();
    return { status: 'completed' as const, value };
  } finally {
    const released = await lock.release();
    if (!released) {
      logger.warn({ jobName: params.jobName, lockKey: params.key }, 'scheduled job lock was not released by owner');
    }
  }
};
