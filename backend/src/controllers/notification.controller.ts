import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { resolveSchoolId } from '../utils/tenant';
import { sendNotification } from '../services/notification.service';
import { HttpError } from '../middlewares/error.middleware';

const templateSchema = z.object({
  key: z.string().min(1),
  channel: z.enum(['PUSH', 'WHATSAPP', 'SMS', 'EMAIL']),
  subject: z.string().min(1).optional(),
  body: z.string().min(1),
});

const sendSchema = z.object({
  channel: z.enum(['PUSH', 'WHATSAPP', 'SMS', 'EMAIL']),
  templateKey: z.string().optional(),
  schoolId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  data: z.record(z.unknown()),
});

export const createTemplate = async (req: Request, res: Response) => {
  const payload = templateSchema.parse(req.body);

  const template = await prisma.notificationTemplate.create({
    data: {
      key: payload.key,
      channel: payload.channel,
      subject: payload.subject ?? null,
      body: payload.body,
    },
  });

  res.status(201).json(template);
};

export const listTemplates = async (_req: Request, res: Response) => {
  const templates = await prisma.notificationTemplate.findMany({ orderBy: { key: 'asc' } });
  res.status(200).json(templates);
};

export const sendNotificationApi = async (req: Request, res: Response) => {
  const payload = sendSchema.parse(req.body);
  const schoolId = payload.schoolId ? resolveSchoolId(req, payload.schoolId) : req.auth?.schoolId ?? null;

  if (!req.auth) throw new HttpError(401, 'Unauthorized');

  const result = await sendNotification({
    schoolId,
    userId: payload.userId ?? null,
    channel: payload.channel,
    templateKey: payload.templateKey,
    data: payload.data,
  });

  res.status(202).json(result);
};

export const listNotificationLogs = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const logs = await prisma.notificationLog.findMany({
    where: { schoolId },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json(logs);
};
