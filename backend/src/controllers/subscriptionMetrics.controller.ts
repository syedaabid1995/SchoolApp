import type { Request, Response } from 'express';
import { z } from 'zod';
import { getSubscriptionMetrics } from '../services/subscriptionMetrics.service';

const paramsSchema = z.object({
  schoolId: z.string().uuid(),
});

export const getSubscriptionMetricsApi = async (req: Request, res: Response) => {
  const payload = paramsSchema.parse(req.params);
  const metrics = await getSubscriptionMetrics(payload.schoolId);
  res.status(200).json(metrics);
};
