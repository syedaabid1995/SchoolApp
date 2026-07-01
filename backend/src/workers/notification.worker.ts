import { Worker } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../config/logger';

let notificationWorker: Worker | undefined;

export const startNotificationWorker = () => {
  if (notificationWorker) return notificationWorker;
  notificationWorker = new Worker(
    'notifications',
    async () => {
      // Implemented in notification service.
    },
    { connection: redis },
  );

  notificationWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'notification job failed');
  });

  return notificationWorker;
};

export const stopNotificationWorker = async () => {
  if (!notificationWorker) return;
  await notificationWorker.close();
  notificationWorker = undefined;
};
