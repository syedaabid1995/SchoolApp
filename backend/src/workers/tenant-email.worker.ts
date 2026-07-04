import { Worker } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { EmailService } from '../services/email.service';
import type { EmailQueueJobData } from '../services/email/email.types';

let tenantEmailWorker: Worker<EmailQueueJobData> | undefined;

export const startTenantEmailWorker = () => {
  if (tenantEmailWorker) return tenantEmailWorker;
  tenantEmailWorker = new Worker<EmailQueueJobData>(
    'tenant-email',
    async (job) => EmailService.processTenantEmailJob(job.data, job.attemptsMade + 1),
    { connection: redis },
  );

  tenantEmailWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err, attemptsMade: job?.attemptsMade }, 'tenant email job failed');
    const maxAttempts = Number(job?.opts.attempts ?? 1);
    if (job && job.attemptsMade >= maxAttempts) {
      void EmailService.recordDeadLetter('TENANT', job, err);
    }
  });

  return tenantEmailWorker;
};

export const stopTenantEmailWorker = async () => {
  if (!tenantEmailWorker) return;
  await tenantEmailWorker.close();
  tenantEmailWorker = undefined;
};
