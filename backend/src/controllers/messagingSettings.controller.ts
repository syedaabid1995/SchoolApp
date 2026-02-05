import type { Request, Response } from 'express';
import { NotificationChannel } from '@prisma/client';
import { z } from 'zod';
import { resolveSchoolId } from '../utils/tenant';
import {
  getSchoolMessagingConfig,
  listMessagingServicesForSchool,
  upsertSchoolMessagingConfig,
} from '../services/messagingSettings.service';

const channelSchema = z.nativeEnum(NotificationChannel).default('WHATSAPP');

const upsertSchema = z.object({
  schoolId: z.string().uuid().optional(),
  channel: z.nativeEnum(NotificationChannel).default('WHATSAPP'),
  serviceId: z.string().uuid(),
  isEnabled: z.boolean().default(true),
  credentials: z.record(z.string(), z.string()).default({}),
});

export const listMessagingServicesForSchoolApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const channel = channelSchema.parse(req.query.channel);
  const result = await listMessagingServicesForSchool(schoolId, channel);
  res.status(200).json(result);
};

export const getSchoolMessagingConfigApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const channel = channelSchema.parse(req.query.channel);
  const config = await getSchoolMessagingConfig(schoolId, channel);
  res.status(200).json({ config });
};

export const upsertSchoolMessagingConfigApi = async (req: Request, res: Response) => {
  const payload = upsertSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const result = await upsertSchoolMessagingConfig({
    schoolId,
    channel: payload.channel,
    serviceId: payload.serviceId,
    isEnabled: payload.isEnabled,
    credentials: payload.credentials,
  });
  res.status(200).json(result);
};

