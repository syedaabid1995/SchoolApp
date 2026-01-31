import { Worker } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../config/logger';

export const faceWorker = new Worker(
  'face-processing',
  async () => {
    // Implemented in face recognition integration layer.
  },
  { connection: redis },
);

faceWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'face processing job failed');
});
