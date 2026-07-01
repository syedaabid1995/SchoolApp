import { Worker } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../config/logger';

let faceWorker: Worker | undefined;

export const startFaceWorker = () => {
  if (faceWorker) return faceWorker;
  faceWorker = new Worker(
    'face-processing',
    async () => {
      // Implemented in face recognition integration layer.
    },
    { connection: redis },
  );

  faceWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'face processing job failed');
  });

  return faceWorker;
};

export const stopFaceWorker = async () => {
  if (!faceWorker) return;
  await faceWorker.close();
  faceWorker = undefined;
};
