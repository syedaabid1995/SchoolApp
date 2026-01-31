import { Worker } from 'bullmq';
import { redis } from '../config/redis';
import { processImportJob } from '../services/import.service';
import { logger } from '../config/logger';

export const importWorker = new Worker(
  'import-jobs',
  async (job) => {
    await processImportJob(job.data.importJobId as string);
  },
  { connection: redis },
);

importWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'import job failed');
});
