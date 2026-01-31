import { prisma } from '../config/db';
import { PushAdapter } from '../notifications/PushAdapter';
import { WhatsAppAdapter } from '../notifications/WhatsAppAdapter';
import { SmsAdapter } from '../notifications/SmsAdapter';
import { NotificationAdapter, NotificationDispatch } from '../notifications/NotificationAdapter';

const adapters: Record<string, NotificationAdapter> = {
  PUSH: new PushAdapter(),
  WHATSAPP: new WhatsAppAdapter(),
  SMS: new SmsAdapter(),
  EMAIL: new SmsAdapter(),
};

export const dispatchNotification = async (params: {
  logId: string;
  to: string;
  channel: 'PUSH' | 'WHATSAPP' | 'SMS' | 'EMAIL';
  payload: NotificationDispatch;
}) => {
  const adapter = adapters[params.channel];
  const result = await adapter.send(params.payload);

  await prisma.notificationLog.update({
    where: { id: params.logId },
    data: {
      status: result.status,
      providerId: result.providerId ?? null,
      error: result.error ?? null,
      sentAt: result.status === 'SENT' ? new Date() : null,
    },
  });

  return result;
};
