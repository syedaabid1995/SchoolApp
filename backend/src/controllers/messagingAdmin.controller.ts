import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  getPlatformEmailConfig,
  listMessagingServicesAdmin,
  setPlatformEmailConfigStatus,
  updateMessagingServiceStatus,
  upsertPlatformEmailConfig,
} from '../services/messagingSettings.service';

const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

const platformEmailSchema = z.object({
  serviceId: z.string().uuid(),
  isEnabled: z.boolean().default(true),
  credentials: z.record(z.string(), z.string()).default({}),
});

const platformEmailStatusSchema = z.object({
  isEnabled: z.boolean(),
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

export const getPlatformEmailConfigApi = async (_req: Request, res: Response) => {
  const config = await getPlatformEmailConfig();
  res.status(200).json({ config });
};

export const upsertPlatformEmailConfigApi = async (req: Request, res: Response) => {
  const payload = platformEmailSchema.parse(req.body);
  const config = await upsertPlatformEmailConfig({
    serviceId: payload.serviceId as string,
    isEnabled: payload.isEnabled ?? true,
    credentials: payload.credentials ?? {},
  });
  res.status(200).json(config);
};

export const togglePlatformEmailConfigApi = async (req: Request, res: Response) => {
  const payload = platformEmailStatusSchema.parse(req.body);
  const config = await setPlatformEmailConfigStatus(payload.isEnabled);
  res.status(200).json(config);
};

