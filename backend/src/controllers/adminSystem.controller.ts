import type { Request, Response } from 'express';
import { getSystemHealth } from '../services/systemHealth.service';

export const getSystemHealthApi = async (_req: Request, res: Response) => {
  const health = await getSystemHealth();
  res.status(200).json(health);
};
