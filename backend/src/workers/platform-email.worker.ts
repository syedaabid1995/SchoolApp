import { Worker } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { EmailService } from '../services/email.service';
import type { EmailQueueJobData } from '../services/email/email.types';

let platformEmailWorker: Worker<EmailQueueJobData> | undefined;

export const startPlatformEmailWorker = () => {
  if (platformEmailWorker) return platformEmailWorker;
  platformEmailWorker = new Worker<EmailQueueJobData>(
    'platform-email',
    async (job) => EmailService.processPlatformEmailJob(job.data, job.attemptsMade + 1),
    { connection: redis },
  );

  platformEmailWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err, attemptsMade: job?.attemptsMade }, 'platform email job failed');
    const maxAttempts = Number(job?.opts.attempts ?? 1);
    if (job && job.attemptsMade >= maxAttempts) {
      void EmailService.recordDeadLetter('PLATFORM', job, err);
    }
  });

  return platformEmailWorker;
};

export const stopPlatformEmailWorker = async () => {
  if (!platformEmailWorker) return;
  await platformEmailWorker.close();
  platformEmailWorker = undefined;
};
