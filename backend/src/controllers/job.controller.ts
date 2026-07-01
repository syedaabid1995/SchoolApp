import type { Request, Response } from 'express';
import { queues } from '../queues';
import { HttpError } from '../middlewares/error.middleware';

export const __closeJobQueueEventsForTests = async () => {
  // QueueEvents is no longer created at import time; this hook remains for old tests.
};

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

  if (req.auth?.schoolId) {
    const data = job.data as { schoolId?: unknown } | undefined;
    if (data?.schoolId !== req.auth.schoolId) {
      throw new HttpError(403, 'Forbidden');
    }
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
