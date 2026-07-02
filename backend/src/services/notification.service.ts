import { prisma } from '../config/db';
import type { NotificationTemplate, Prisma } from '@prisma/client';
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

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const renderTemplate = (body: string, data: Record<string, unknown>) => {
  return Object.keys(data).reduce((result, key) => {
    const value = String(data[key] ?? '');
    return result.replace(new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, 'g'), value);
  }, body);
};

export const resolveNotificationContent = (params: {
  channel: NotificationPayload['channel'];
  template?: Pick<NotificationTemplate, 'subject' | 'body'> | null;
  data: Record<string, unknown>;
}) => {
  const template = params.template ?? null;
  let subject = params.data.subject ? String(params.data.subject) : undefined;
  let body = params.data.body ? String(params.data.body) : undefined;
  let html = params.data.html ? String(params.data.html) : undefined;

  if (template) {
    subject = subject ?? template.subject ?? undefined;
    if (!body && !html) {
      body = template.body;
      html = params.channel === 'EMAIL' ? body : html;
    }
  }

  return {
    subject: subject !== undefined ? renderTemplate(subject, params.data) : undefined,
    body: body !== undefined ? renderTemplate(body, params.data) : undefined,
    html: html !== undefined ? renderTemplate(html, params.data) : undefined,
  };
};

export const sendNotification = async (payload: NotificationPayload) => {
  let templateId: string | undefined;
  let delivery: DeliveryResult | null = null;
  let template: Pick<NotificationTemplate, 'id' | 'subject' | 'body'> | null = null;

  if (payload.templateKey) {
    template = await prisma.notificationTemplate.findUnique({
      where: { key: payload.templateKey },
      select: { id: true, subject: true, body: true },
    });

    if (template) {
      templateId = template.id;
    }
  }

  const { subject, body, html } = resolveNotificationContent({
    channel: payload.channel,
    template,
    data: payload.data,
  });
  const resolvedPayload = {
    ...payload.data,
    ...(subject !== undefined ? { subject } : {}),
    ...(body !== undefined ? { body } : {}),
    ...(html !== undefined ? { html } : {}),
  };

  const log = await prisma.notificationLog.create({
    data: {
      schoolId: payload.schoolId ?? null,
      userId: payload.userId ?? null,
      channel: payload.channel,
      templateId: templateId ?? null,
      payload: resolvedPayload as Prisma.InputJsonValue,
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
