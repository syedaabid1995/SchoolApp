import { prisma } from '../config/db';
import type { Prisma } from '@prisma/client';
import { dispatchNotification } from './notificationDispatcher.service';
import type { DeliveryResult } from '../notifications/NotificationAdapter';

export type NotificationPayload = {
  schoolId?: string | null;
  userId?: string | null;
  channel: 'PUSH' | 'WHATSAPP' | 'SMS' | 'EMAIL';
  templateKey?: string;
  scheduledAt?: Date | null;
  data: Record<string, unknown>;
};

const renderTemplate = (body: string, data: Record<string, unknown>) => {
  return Object.keys(data).reduce((result, key) => {
    const value = String(data[key] ?? '');
    return result.replace(new RegExp(`{{\s*${key}\s*}}`, 'g'), value);
  }, body);
};

export const sendNotification = async (payload: NotificationPayload) => {
  let templateId: string | undefined;
  let subject = payload.data.subject ? String(payload.data.subject) : undefined;
  let body = payload.data.body ? String(payload.data.body) : undefined;
  let html = payload.data.html ? String(payload.data.html) : undefined;
  let delivery: DeliveryResult | null = null;

  if (payload.templateKey) {
    const template = await prisma.notificationTemplate.findUnique({
      where: { key: payload.templateKey },
    });

    if (template) {
      templateId = template.id;
      subject = subject ?? template.subject ?? undefined;
      if (!body && !html) {
        body = renderTemplate(template.body, payload.data);
        html = payload.channel === 'EMAIL' ? body : html;
      }
    }
  }

  const log = await prisma.notificationLog.create({
    data: {
      schoolId: payload.schoolId ?? null,
      userId: payload.userId ?? null,
      channel: payload.channel,
      templateId: templateId ?? null,
      payload: payload.data as Prisma.InputJsonValue,
      status: 'QUEUED',
      scheduledAt: payload.scheduledAt ?? null,
    },
  });

  const shouldDispatchNow = !payload.scheduledAt || payload.scheduledAt.getTime() <= Date.now();
  if ((body || html) && shouldDispatchNow) {
    delivery = await dispatchNotification({
      logId: log.id,
      to: payload.data.to ? String(payload.data.to) : '',
      channel: payload.channel,
      schoolId: payload.schoolId ?? null,
      payload: { to: payload.data.to ? String(payload.data.to) : '', subject, body: body ?? '', html },
    });
  }

  return { logId: log.id, subject, body, delivery };
};
