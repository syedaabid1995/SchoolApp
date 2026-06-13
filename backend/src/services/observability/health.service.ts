import { prisma } from '../../config/db';
import { redis } from '../../config/redis';
import { QueueMetricsService } from './queue-metrics.service';

type DependencyStatus = 'up' | 'down';

export type HealthStatus = {
  status: 'healthy' | 'unhealthy';
  database: DependencyStatus;
  redis: DependencyStatus;
  queues: DependencyStatus;
};

const withTimeout = async <T>(operation: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('health check timeout')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

const checkDatabase = async (): Promise<DependencyStatus> => {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 1500);
    return 'up';
  } catch {
    return 'down';
  }
};

const checkRedis = async (): Promise<DependencyStatus> => {
  try {
    const pong = await withTimeout(redis.ping(), 1500);
    return pong === 'PONG' ? 'up' : 'down';
  } catch {
    return 'down';
  }
};

const checkQueues = async (): Promise<DependencyStatus> => {
  try {
    const result = await withTimeout(QueueMetricsService.collectQueueMetrics(), 2000);
    return result.healthy ? 'up' : 'down';
  } catch {
    return 'down';
  }
};

export const getHealthStatus = async (): Promise<HealthStatus> => {
  const [database, redisStatus, queues] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkQueues(),
  ]);
  const status = database === 'up' && redisStatus === 'up' && queues === 'up' ? 'healthy' : 'unhealthy';

  return {
    status,
    database,
    redis: redisStatus,
    queues,
  };
};
