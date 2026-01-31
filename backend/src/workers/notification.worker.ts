import { Worker } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../config/logger';

export const notificationWorker = new Worker(
  'notifications',
  async () => {
    // Implemented in notification service.
  },
  { connection: redis },
);

notificationWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'notification job failed');
});
