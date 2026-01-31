import { Queue } from 'bullmq';
import { redis } from '../config/redis';

export const faceQueue = new Queue('face-processing', { connection: redis });
export const reportQueue = new Queue('report-generation', { connection: redis });
export const notificationQueue = new Queue('notifications', { connection: redis });
export const importQueue = new Queue('import-jobs', { connection: redis });

export const queues = {
  faceQueue,
  reportQueue,
  notificationQueue,
  importQueue,
};
