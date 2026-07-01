import { Redis } from 'ioredis';
import { env } from './env';
import { logger } from './logger';
import { RedisMetricsService } from '../services/observability/redis-metrics.service';

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
  RedisMetricsService.recordRedisError('connection');
  if (didLogRedisError) return;
  didLogRedisError = true;
  logger.warn({ err: error }, 'redis unavailable; continuing with degraded mode');
});

export const closeRedis = async () => {
  if (redis.status === 'end') return;
  if (redis.status === 'wait' || redis.status === 'close') {
    redis.disconnect();
    return;
  }
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
};
