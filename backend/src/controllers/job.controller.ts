import type { Request, Response } from 'express';
import { QueueEvents } from 'bullmq';
import { redis } from '../config/redis';
import { queues } from '../queues';
import { HttpError } from '../middlewares/error.middleware';

const queueEvents = new QueueEvents('import-jobs', { connection: redis });

export const getJobStatus = async (req: Request, res: Response) => {
  const { queue, id } = req.params;

  const targetQueue = queues[`${queue}Queue` as keyof typeof queues];
  if (!targetQueue) {
    throw new HttpError(404, 'Queue not found');
  }

  const job = await targetQueue.getJob(id);
  if (!job) {
    throw new HttpError(404, 'Job not found');
  }

  const state = await job.getState();
  const progress = await job.progress;
  const result = await job.returnvalue;

  res.status(200).json({
    id: job.id,
    state,
    progress,
    result: result ?? null,
    failedReason: job.failedReason ?? null,
  });
};

queueEvents.on('error', () => {
  // no-op: handled via logger in worker files
});
