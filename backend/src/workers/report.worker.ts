import { Worker } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../config/logger';

let reportWorker: Worker | undefined;

export const startReportWorker = () => {
  if (reportWorker) return reportWorker;
  reportWorker = new Worker(
    'report-generation',
    async () => {
      // Implemented in report generation service when async exports are required.
    },
    { connection: redis },
  );

  reportWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'report generation job failed');
  });

  return reportWorker;
};

export const stopReportWorker = async () => {
  if (!reportWorker) return;
  await reportWorker.close();
  reportWorker = undefined;
};
