import type { Request, Response } from 'express';
import { NotificationChannel } from '@prisma/client';
import { z } from 'zod';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import {
  getSchoolMessagingConfig,
  listMessagingServicesForSchool,
  resolveSchoolMessagingProvider,
  setSchoolMessagingConfigStatus,
  upsertSchoolMessagingConfig,
} from '../services/messagingSettings.service';
import { sendNotification } from '../services/notification.service';

const channelSchema = z.nativeEnum(NotificationChannel).default('WHATSAPP');

const upsertSchema = z.object({
  schoolId: z.string().uuid().optional(),
  channel: z.nativeEnum(NotificationChannel).default('WHATSAPP'),
  serviceId: z.string().uuid(),
  isEnabled: z.boolean().default(true),
  credentials: z.record(z.string(), z.string()).default({}),
});

const toggleSchema = z.object({
  schoolId: z.string().uuid().optional(),
  channel: z.nativeEnum(NotificationChannel),
  isEnabled: z.boolean(),
});

const testMessageSchema = z.object({
  schoolId: z.string().uuid().optional(),
  to: z.string().trim().min(1, 'Recipient is required'),
});

const sendTestMessage = async (req: Request, res: Response, channel: 'EMAIL' | 'SMS' | 'WHATSAPP') => {
  const payload = testMessageSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const provider = await resolveSchoolMessagingProvider({ schoolId, channel });
  if (!provider) {
    throw new HttpError(400, `${channel} provider is not configured for this school`);
  }

  const result = await sendNotification({
    schoolId,
    userId: req.auth?.userId ?? null,
    channel,
    data: {
      to: payload.to,
      subject: `Test ${channel.toLowerCase()} from School ERP`,
      body: `This is a test ${channel.toLowerCase()} from your school messaging settings.`,
      ...(channel === 'EMAIL' ? { emailIntent: 'GENERAL_COMMUNICATION' } : {}),
    },
  });

  res.status(200).json({
    success: result.delivery?.status === 'SENT' || result.delivery?.status === 'QUEUED',
    logId: result.logId,
    delivery: result.delivery
      ? {
          status: result.delivery.status,
          error: result.delivery.error ?? null,
        }
      : null,
  });
};

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

export const toggleSchoolMessagingConfigApi = async (req: Request, res: Response) => {
  const payload = toggleSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const result = await setSchoolMessagingConfigStatus({
    schoolId,
    channel: payload.channel,
    isEnabled: payload.isEnabled,
  });
  res.status(200).json({
    id: result.id,
    schoolId: result.schoolId,
    channel: result.channel,
    isEnabled: result.isEnabled,
    serviceId: result.serviceId,
    serviceCode: result.service.code,
  });
};

export const testEmailMessagingConfigApi = async (req: Request, res: Response) => {
  await sendTestMessage(req, res, 'EMAIL');
};

export const testSmsMessagingConfigApi = async (req: Request, res: Response) => {
  await sendTestMessage(req, res, 'SMS');
};

export const testWhatsappMessagingConfigApi = async (req: Request, res: Response) => {
  await sendTestMessage(req, res, 'WHATSAPP');
};
