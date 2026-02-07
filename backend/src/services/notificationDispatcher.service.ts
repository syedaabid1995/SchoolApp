import { prisma } from '../config/db';
import { PushAdapter } from '../notifications/PushAdapter';
import { WhatsAppAdapter } from '../notifications/WhatsAppAdapter';
import { SmsAdapter } from '../notifications/SmsAdapter';
import { NotificationAdapter, NotificationDispatch } from '../notifications/NotificationAdapter';
import { logger } from '../config/logger';
import { resolveSchoolMessagingProvider } from './messagingSettings.service';
import { TwilioAdapter } from '../notifications/TwilioAdapter';

const adapters: Record<string, NotificationAdapter> = {
  PUSH: new PushAdapter(),
  WHATSAPP: new WhatsAppAdapter(),
  SMS: new SmsAdapter(),
  EMAIL: new SmsAdapter(),
};

const resolveAdapter = async (params: {
  channel: 'PUSH' | 'WHATSAPP' | 'SMS' | 'EMAIL';
  schoolId?: string | null;
}) => {
  if (params.channel !== 'WHATSAPP' && params.channel !== 'SMS') {
    return adapters[params.channel];
  }

  const provider = await resolveSchoolMessagingProvider({
    schoolId: params.schoolId ?? null,
    channel: params.channel,
  });
  if (!provider) {
    return adapters[params.channel];
  }

  if (provider.serviceCode === 'TWILIO') {
    return new TwilioAdapter(
      {
        accountSid: provider.credentials.accountSid ?? '',
        authToken: provider.credentials.authToken ?? '',
        from: provider.credentials.from ?? '',
        messagingServiceSid: provider.credentials.messagingServiceSid,
      },
      params.channel,
    );
  }

  return adapters[params.channel];
};

export const dispatchNotification = async (params: {
  logId: string;
  to: string;
  channel: 'PUSH' | 'WHATSAPP' | 'SMS' | 'EMAIL';
  schoolId?: string | null;
  payload: NotificationDispatch;
}) => {
  const adapter = await resolveAdapter({ channel: params.channel, schoolId: params.schoolId ?? null });
  const result = await adapter.send(params.payload);

  if (result.status === 'SENT') {
    logger.info(
      { logId: params.logId, channel: params.channel, to: params.to, providerId: result.providerId ?? null },
      'notification sent',
    );
  } else {
    logger.warn(
      { logId: params.logId, channel: params.channel, to: params.to, error: result.error ?? 'unknown' },
      'notification failed',
    );
  }

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
