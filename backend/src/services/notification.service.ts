import { prisma } from '../config/db';
import { dispatchNotification } from './notificationDispatcher.service';

export type NotificationPayload = {
  schoolId?: string | null;
  userId?: string | null;
  channel: 'PUSH' | 'WHATSAPP' | 'SMS' | 'EMAIL';
  templateKey?: string;
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
  let subject: string | undefined;
  let body: string | undefined;

  if (payload.templateKey) {
    const template = await prisma.notificationTemplate.findUnique({
      where: { key: payload.templateKey },
    });

    if (template) {
      templateId = template.id;
      subject = template.subject ?? undefined;
      body = renderTemplate(template.body, payload.data);
    }
  }

  const log = await prisma.notificationLog.create({
    data: {
      schoolId: payload.schoolId ?? null,
      userId: payload.userId ?? null,
      channel: payload.channel,
      templateId: templateId ?? null,
      payload: payload.data,
      status: 'QUEUED',
    },
  });

  if (body) {
    await dispatchNotification({
      logId: log.id,
      to: payload.data.to ? String(payload.data.to) : '',
      channel: payload.channel,
      payload: { to: payload.data.to ? String(payload.data.to) : '', subject, body },
    });
  }

  return { logId: log.id, subject, body };
};
