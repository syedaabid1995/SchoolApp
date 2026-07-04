import type { Queue } from 'bullmq';
import { queues } from '../../queues';
import { metricsRegistry } from './metrics.service';

type QueueTarget = {
  name: string;
  queue: Queue;
};

const queueTargets = (): QueueTarget[] => [
  { name: 'imports', queue: queues.importQueue },
  { name: 'notifications', queue: queues.notificationQueue },
  { name: 'platform-email', queue: queues.platformEmailQueue },
  { name: 'tenant-email', queue: queues.tenantEmailQueue },
  { name: 'email-dead-letter', queue: queues.emailDeadLetterQueue },
  { name: 'reports', queue: queues.reportQueue },
  { name: 'face-processing', queue: queues.faceQueue },
];

export const QueueMetricsService = {
  async collectQueueMetrics() {
    const results = await Promise.allSettled(
      queueTargets().map(async ({ name, queue }) => {
        const counts = await queue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
          'waiting-children',
          'prioritized',
        );

        for (const [status, count] of Object.entries(counts)) {
          metricsRegistry.setGauge('bullmq_jobs', 'BullMQ job counts by queue and status.', {
            queue: name,
            status,
          }, Number(count));
        }

        const delayedJobs = await queue.getJobs(['delayed'], 0, 100);
        const retryCount = delayedJobs.reduce((total, job) => total + (job.attemptsMade ?? 0), 0);
        metricsRegistry.setGauge('bullmq_job_retries', 'Sampled BullMQ delayed job retry attempts.', {
          queue: name,
        }, retryCount);
      }),
    );

    const failed = results.filter((result) => result.status === 'rejected').length;
    return {
      checked: results.length,
      failed,
      healthy: failed === 0,
    };
  },
};
