import { prisma } from '../config/db';
import { PushAdapter } from '../notifications/PushAdapter';
import { WhatsAppAdapter } from '../notifications/WhatsAppAdapter';
import { SmsAdapter } from '../notifications/SmsAdapter';
import { NotificationAdapter, NotificationDispatch } from '../notifications/NotificationAdapter';
import { logger } from '../config/logger';
import { resolvePlatformEmailProvider, resolveSchoolMessagingProvider } from './messagingSettings.service';
import { TwilioAdapter } from '../notifications/TwilioAdapter';
import { Msg91Adapter } from '../notifications/Msg91Adapter';
import { WatiAdapter } from '../notifications/WatiAdapter';
import { EmailAdapter } from '../notifications/EmailAdapter';
import { SmtpEmailAdapter } from '../notifications/SmtpEmailAdapter';
import { SendGridEmailAdapter } from '../notifications/SendGridEmailAdapter';

const adapters: Record<string, NotificationAdapter> = {
  PUSH: new PushAdapter(),
  WHATSAPP: new WhatsAppAdapter(),
  SMS: new SmsAdapter(),
  EMAIL: new EmailAdapter(),
};

const resolveAdapter = async (params: {
  channel: 'PUSH' | 'WHATSAPP' | 'SMS' | 'EMAIL';
  schoolId?: string | null;
}) => {
  if (!['WHATSAPP', 'SMS', 'EMAIL'].includes(params.channel)) {
    return adapters[params.channel];
  }

  const provider =
    (await resolveSchoolMessagingProvider({
      schoolId: params.schoolId ?? null,
      channel: params.channel,
    })) ??
    (params.channel === 'EMAIL' ? await resolvePlatformEmailProvider() : null);
  if (!provider) {
    return adapters[params.channel];
  }

  if (provider.serviceCode === 'TWILIO' && (params.channel === 'SMS' || params.channel === 'WHATSAPP')) {
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

  if (provider.serviceCode === 'MSG91' && params.channel === 'SMS') {
    return new Msg91Adapter({
      authKey: provider.credentials.authKey ?? '',
      senderId: provider.credentials.senderId ?? '',
      route: provider.credentials.route,
      country: provider.credentials.country,
      templateId: provider.credentials.templateId,
      flowUrl: provider.credentials.flowUrl,
      sendUrl: provider.credentials.sendUrl,
    });
  }

  if (provider.serviceCode === 'WATI' && params.channel === 'WHATSAPP') {
    return new WatiAdapter({
      apiEndpoint: provider.credentials.apiEndpoint ?? '',
      accessToken: provider.credentials.accessToken ?? '',
    });
  }

  if (provider.serviceCode === 'SMTP' && params.channel === 'EMAIL') {
    return new SmtpEmailAdapter({
      host: provider.credentials.host ?? '',
      port: provider.credentials.port ?? '',
      username: provider.credentials.username,
      password: provider.credentials.password,
      fromEmail: provider.credentials.fromEmail ?? '',
      fromName: provider.credentials.fromName,
      secure: provider.credentials.secure,
    });
  }

  if (provider.serviceCode === 'SENDGRID' && params.channel === 'EMAIL') {
    return new SendGridEmailAdapter({
      apiKey: provider.credentials.apiKey ?? '',
      fromEmail: provider.credentials.fromEmail ?? '',
      fromName: provider.credentials.fromName,
      apiUrl: provider.credentials.apiUrl,
    });
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
