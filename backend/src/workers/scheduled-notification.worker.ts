import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { dispatchNotification } from '../services/notificationDispatcher.service';
import { resolveNotificationContent } from '../services/notification.service';
import { EmailService } from '../services/email.service';
import { normalizeEmailIntent } from '../services/email/email.types';
import { runWithDistributedLock, type DistributedLockClient } from '../services/distributedLock.service';

type DispatchableChannel = 'PUSH' | 'WHATSAPP' | 'SMS' | 'EMAIL';

const scheduledNotificationJobName = 'notifications.scheduled-dispatch';
const scheduledNotificationLockKey = 'academify:scheduler:notifications:scheduled-dispatch';
const scheduledNotificationLockTtlMs = 2 * 60 * 1000;
const scheduledNotificationIntervalMs = 30 * 1000;
const scheduledNotificationBatchSize = 100;

let scheduledNotificationInterval: NodeJS.Timeout | undefined;
let activeScheduledNotificationRun: Promise<unknown> | undefined;

const payloadRecord = (payload: unknown): Record<string, unknown> => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  return payload as Record<string, unknown>;
};

const failScheduledLog = async (id: string, error: string) => {
  await prisma.notificationLog.update({
    where: { id },
    data: {
      status: 'FAILED',
      error,
      sentAt: null,
    },
  });
};

export const processDueScheduledNotifications = async (params?: { now?: Date; batchSize?: number }) => {
  const now = params?.now ?? new Date();
  const logs = await prisma.notificationLog.findMany({
    where: {
      status: 'QUEUED',
      scheduledAt: { lte: now },
    },
    include: {
      template: { select: { subject: true, body: true } },
    },
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
    take: params?.batchSize ?? scheduledNotificationBatchSize,
  });

  let sent = 0;
  let failed = 0;

  for (const log of logs) {
    const payload = payloadRecord(log.payload);
    const to = typeof payload.to === 'string' ? payload.to.trim() : '';
    const channel = log.channel as DispatchableChannel;
    const { subject, body, html } = resolveNotificationContent({
      channel,
      template: log.template,
      data: payload,
    });

    if (!to) {
      failed += 1;
      await failScheduledLog(log.id, 'Scheduled notification is missing a recipient address or phone number.');
      continue;
    }

    if (!body && !html) {
      failed += 1;
      await failScheduledLog(log.id, 'Scheduled notification is missing message content.');
      continue;
    }

    try {
      const delivery =
        channel === 'EMAIL'
          ? await EmailService.enqueueExistingNotificationLog({
              logId: log.id,
              schoolId: log.schoolId,
              userId: log.userId,
              intent: normalizeEmailIntent(payload.emailIntent, log.schoolId ? 'GENERAL_COMMUNICATION' : 'PLATFORM_NOTIFICATION'),
              to,
              subject,
              body: body ?? '',
              html,
              payload,
            })
          : await dispatchNotification({
              logId: log.id,
              to,
              channel,
              schoolId: log.schoolId,
              payload: {
                to,
                subject,
                body: body ?? '',
                html,
              },
            });

      if (delivery.status === 'SENT' || delivery.status === 'QUEUED') sent += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : 'Scheduled notification dispatch failed.';
      logger.error({ err: error, logId: log.id, channel, to }, 'scheduled notification dispatch failed');
      await failScheduledLog(log.id, message);
    }
  }

  if (logs.length > 0) {
    logger.info({ processed: logs.length, sent, failed, dueAt: now }, 'processed scheduled notifications');
  }

  return { processed: logs.length, sent, failed };
};

export const runScheduledNotificationDispatchOnce = async (params?: {
  lockClient?: DistributedLockClient;
  now?: Date;
  batchSize?: number;
}) =>
  runWithDistributedLock({
    key: scheduledNotificationLockKey,
    ttlMs: scheduledNotificationLockTtlMs,
    jobName: scheduledNotificationJobName,
    client: params?.lockClient,
    run: () => processDueScheduledNotifications({ now: params?.now, batchSize: params?.batchSize }),
  });

const triggerScheduledNotificationRun = () => {
  if (activeScheduledNotificationRun) return activeScheduledNotificationRun;
  activeScheduledNotificationRun = runScheduledNotificationDispatchOnce().finally(() => {
    activeScheduledNotificationRun = undefined;
  });
  return activeScheduledNotificationRun;
};

export const startScheduledNotificationScheduler = () => {
  if (scheduledNotificationInterval) return;
  scheduledNotificationInterval = setInterval(() => {
    void triggerScheduledNotificationRun();
  }, scheduledNotificationIntervalMs);
  void triggerScheduledNotificationRun();
};

export const stopScheduledNotificationScheduler = async () => {
  const activeRun = activeScheduledNotificationRun;
  clearInterval(scheduledNotificationInterval);
  scheduledNotificationInterval = undefined;
  if (activeRun) await activeRun;
};
