import type { Request, Response } from 'express';
import { z } from 'zod';
import { listMessagingServicesAdmin, updateMessagingServiceStatus } from '../services/messagingSettings.service';

const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

export const listMessagingServicesAdminApi = async (_req: Request, res: Response) => {
  const items = await listMessagingServicesAdmin();
  res.status(200).json({ items });
};

export const updateMessagingServiceStatusApi = async (req: Request, res: Response) => {
  const payload = statusSchema.parse(req.body);
  const updated = await updateMessagingServiceStatus(req.params.id, payload.status);
  res.status(200).json(updated);
};

