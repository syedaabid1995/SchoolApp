import { Worker } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../config/logger';

export const reportWorker = new Worker(
  'report-generation',
  async () => {
    // Implemented in report generation service when async exports are required.
  },
  { connection: redis },
);

reportWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'report generation job failed');
});
