import { Redis } from 'ioredis';
import { env } from './env';
import { logger } from './logger';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 5) {
      return null;
    }
    return Math.min(times * 500, 2000);
  },
});

let didLogRedisError = false;
redis.on('error', (error) => {
  if (didLogRedisError) return;
  didLogRedisError = true;
  logger.warn({ err: error }, 'redis unavailable; continuing with degraded mode');
});
