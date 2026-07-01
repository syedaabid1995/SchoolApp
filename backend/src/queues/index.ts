import { Queue } from 'bullmq';
import { redis } from '../config/redis';

export const faceQueue = new Queue('face-processing', { connection: redis });
export const reportQueue = new Queue('report-generation', { connection: redis });
export const notificationQueue = new Queue('notifications', { connection: redis });
export const importQueue = new Queue('import-jobs', { connection: redis });
export const feeGenerationQueue = new Queue('fee-generation', { connection: redis });

export const queues = {
  faceQueue,
  reportQueue,
  notificationQueue,
  importQueue,
  feeGenerationQueue,
};

export const closeQueues = async () => {
  const results = await Promise.allSettled(Object.values(queues).map((queue) => queue.close()));
  const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failed) {
    throw failed.reason;
  }
};
