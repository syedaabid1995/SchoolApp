import type { Request, Response } from 'express';
import { z } from 'zod';
import { getSubscriptionMetrics } from '../services/subscriptionMetrics.service';
import { cacheKeys } from '../services/cache/cache.keys';
import { rememberCache, setCacheHeader } from '../services/cache/cache.service';
import { cacheTTL } from '../services/cache/cache.ttl';

const paramsSchema = z.object({
  schoolId: z.string().uuid(),
});

export const getSubscriptionMetricsApi = async (req: Request, res: Response) => {
  const payload = paramsSchema.parse(req.params);
  const { value: metrics, status } = await rememberCache(
    cacheKeys.subscriptionMetrics(payload.schoolId),
    cacheTTL.SUBSCRIPTION,
    () => getSubscriptionMetrics(payload.schoolId),
  );
  setCacheHeader(res, status);
  res.status(200).json(metrics);
};
