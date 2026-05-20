import type { Queue } from 'bullmq';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { redis } from '../config/redis';
import { queues } from '../queues';

type HealthStatus = 'healthy' | 'warning' | 'down' | 'unknown' | 'not_implemented';

type ServiceHealth = {
  status: HealthStatus;
  latencyMs?: number;
  provider?: string;
  uptimeSeconds?: number;
  version?: string;
  environment?: string;
  description?: string;
};

const queueMap: Array<{ name: string; queue: Queue }> = [
  { name: 'face-processing', queue: queues.faceQueue },
  { name: 'report-generation', queue: queues.reportQueue },
  { name: 'notifications', queue: queues.notificationQueue },
  { name: 'import-jobs', queue: queues.importQueue },
];

const nowIso = () => new Date().toISOString();

const withLatency = async <T>(fn: () => Promise<T>) => {
  const startedAt = Date.now();
  const value = await fn();
  return { value, latencyMs: Date.now() - startedAt };
};

const normalizeSupportedChannels = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).toUpperCase());
};

const getDatabaseHealth = async (): Promise<ServiceHealth> => {
  try {
    const { latencyMs } = await withLatency(() => prisma.$queryRaw`SELECT 1`);
    return { status: 'healthy', latencyMs };
  } catch {
    return { status: 'down', description: 'Database connectivity check failed.' };
  }
};

const getRedisHealth = async (): Promise<ServiceHealth> => {
  try {
    const { latencyMs } = await withLatency(() =>
      Promise.race([
        redis.ping(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Redis health check timed out')), 1500);
        }),
      ]),
    );
    return { status: 'healthy', latencyMs };
  } catch {
    return {
      status: env.NODE_ENV === 'development' ? 'warning' : 'down',
      description: 'Redis ping failed.',
    };
  }
};

const getQueueHealth = async () => {
  try {
    const results = await Promise.all(
      queueMap.map(async ({ name, queue }) => {
        const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed');
        return {
          name,
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          completed: counts.completed ?? 0,
          failed: counts.failed ?? 0,
        };
      }),
    );

    const pendingJobs = results.reduce((sum, item) => sum + item.waiting + item.delayed, 0);
    const activeJobs = results.reduce((sum, item) => sum + item.active, 0);
    const failedJobs = results.reduce((sum, item) => sum + item.failed, 0);

    return {
      status: failedJobs > 0 ? ('warning' as const) : ('healthy' as const),
      pendingJobs,
      activeJobs,
      failedJobs,
      queues: results,
    };
  } catch {
    return {
      status: 'warning' as const,
      pendingJobs: 0,
      activeJobs: 0,
      failedJobs: 0,
      queues: [],
      description: 'Queue counts unavailable.',
    };
  }
};

const getStorageHealth = (): ServiceHealth => {
  const isConfigured = Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_REGION && env.AWS_S3_BUCKET);
  return {
    status: isConfigured ? 'unknown' : 'warning',
    provider: 's3',
    description: isConfigured
      ? 'S3 is configured. Active object-store probing is not performed by this endpoint.'
      : 'S3 configuration is incomplete.',
  };
};

const getMessagingHealth = async (channel: 'EMAIL' | 'SMS'): Promise<ServiceHealth> => {
  try {
    const services = await prisma.messagingService.findMany({
      where: { status: 'ACTIVE' },
      select: { name: true, supportedChannels: true },
    });
    const matching = services.filter((service) => normalizeSupportedChannels(service.supportedChannels).includes(channel));
    const enabledConfigs = await prisma.schoolMessagingConfig.count({
      where: { channel, isEnabled: true },
    });

    return {
      status: matching.length || enabledConfigs ? 'unknown' : 'warning',
      provider: matching.length ? 'configured' : 'not_configured',
      description: matching.length
        ? `${channel} provider records are configured. Live send checks are not performed automatically.`
        : `${channel} provider records are not configured.`,
    };
  } catch {
    return {
      status: 'unknown',
      provider: 'unknown',
      description: `${channel} provider configuration could not be checked.`,
    };
  }
};

const getRecentErrors = async () => {
  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { action: { contains: 'ERROR', mode: 'insensitive' } },
        { action: { contains: 'FAILED', mode: 'insensitive' } },
        { action: { contains: 'RATE_LIMIT', mode: 'insensitive' } },
        { action: { contains: 'BACKUP', mode: 'insensitive' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      action: true,
      entityType: true,
      schoolId: true,
      createdAt: true,
    },
  });

  return logs.map((log) => ({
    id: log.id,
    type: log.action,
    message: `${log.entityType} ${log.action}`.replace(/_/g, ' '),
    severity: log.action.includes('FAILED') || log.action.includes('ERROR') ? 'warning' : 'info',
    schoolId: log.schoolId,
    createdAt: log.createdAt.toISOString(),
  }));
};

const getBackupHealth = async () => {
  try {
    const [lastBackup, failedBackupJobs, runningBackupJobs] = await Promise.all([
      prisma.backupJob.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { status: true, finishedAt: true, createdAt: true },
      }),
      prisma.backupJob.count({ where: { status: 'FAILED' } }),
      prisma.backupJob.count({ where: { status: 'RUNNING' } }),
    ]);

    if (!lastBackup) {
      return {
        status: 'unknown' as const,
        lastBackupAt: null,
        lastBackupStatus: null,
        failedBackupJobs,
        runningBackupJobs,
      };
    }

    return {
      status: failedBackupJobs > 0 ? ('warning' as const) : ('healthy' as const),
      lastBackupAt: (lastBackup.finishedAt ?? lastBackup.createdAt).toISOString(),
      lastBackupStatus: lastBackup.status,
      failedBackupJobs,
      runningBackupJobs,
    };
  } catch {
    return {
      status: 'unknown' as const,
      lastBackupAt: null,
      lastBackupStatus: null,
      failedBackupJobs: 0,
      runningBackupJobs: 0,
    };
  }
};

const calculateOverallStatus = (params: {
  database: ServiceHealth;
  redis: ServiceHealth;
  queues: Awaited<ReturnType<typeof getQueueHealth>>;
  storage: ServiceHealth;
  email: ServiceHealth;
  sms: ServiceHealth;
  backup: Awaited<ReturnType<typeof getBackupHealth>>;
}): HealthStatus => {
  if (params.database.status === 'down') return 'down';

  const importantStatuses: HealthStatus[] = [params.redis.status, params.queues.status, params.backup.status];
  if (importantStatuses.some((status) => status === 'down' || status === 'warning')) return 'warning';
  if (params.queues.failedJobs > 0 || params.backup.failedBackupJobs > 0) return 'warning';

  return 'healthy';
};

export const getSystemHealth = async () => {
  const [database, redisHealth, queuesHealth, email, sms, recentErrors, backup] = await Promise.all([
    getDatabaseHealth(),
    getRedisHealth(),
    getQueueHealth(),
    getMessagingHealth('EMAIL'),
    getMessagingHealth('SMS'),
    getRecentErrors(),
    getBackupHealth(),
  ]);

  const storage = getStorageHealth();
  const api: ServiceHealth = {
    status: 'healthy',
    uptimeSeconds: Math.floor(process.uptime()),
    version: process.env.npm_package_version ?? '0.1.0',
    environment: env.NODE_ENV,
  };

  const overallStatus = calculateOverallStatus({
    database,
    redis: redisHealth,
    queues: queuesHealth,
    storage,
    email,
    sms,
    backup,
  });

  return {
    generatedAt: nowIso(),
    overallStatus,
    services: {
      api,
      database,
      redis: redisHealth,
      queues: queuesHealth,
      storage,
      email,
      sms,
    },
    recentErrors,
    backup,
  };
};
