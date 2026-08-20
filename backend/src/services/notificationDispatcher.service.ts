import { prisma } from '../config/db';
import { PushAdapter } from '../notifications/PushAdapter';
import { WhatsAppAdapter } from '../notifications/WhatsAppAdapter';
import { SmsAdapter } from '../notifications/SmsAdapter';
import { DeliveryResult, NotificationAdapter, NotificationDispatch } from '../notifications/NotificationAdapter';
import { logger } from '../config/logger';
import { resolveSchoolMessagingProvider } from './messagingSettings.service';
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

  const provider = await resolveSchoolMessagingProvider({
    schoolId: params.schoolId ?? null,
    channel: params.channel,
  });
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
      replyToEmail: provider.credentials.replyToEmail,
      secure: provider.credentials.secure,
    });
  }

  if (provider.serviceCode === 'SENDGRID' && params.channel === 'EMAIL') {
    return new SendGridEmailAdapter({
      apiKey: provider.credentials.apiKey ?? '',
      fromEmail: provider.credentials.fromEmail ?? '',
      fromName: provider.credentials.fromName,
      replyToEmail: provider.credentials.replyToEmail,
      apiUrl: provider.credentials.apiUrl,
    });
  }

  return adapters[params.channel];
};

const isInvalidFirebaseTokenError = (error?: string) => {
  if (!error) return false;
  const normalized = error.toLowerCase();
  return (
    normalized.includes('registration-token-not-registered') ||
    normalized.includes('requested entity was not found') ||
    normalized.includes('invalid registration token')
  );
};

export const dispatchPushToUser = async (params: {
  logId: string;
  recipientUserId: string;
  schoolId?: string | null;
  payload: NotificationDispatch;
}) => {
  const recipientUserId = params.recipientUserId.trim();
  if (!recipientUserId) {
    const result = { status: 'FAILED' as const, error: 'Push notification is missing recipient user ID.' };
    await prisma.notificationLog.update({ where: { id: params.logId }, data: { status: result.status, error: result.error } });
    return result;
  }

  const preference = await prisma.userNotificationPreference.findUnique({
    where: { userId: recipientUserId },
    select: { pushEnabled: true },
  });
  if (preference?.pushEnabled === false) {
    const result = { status: 'FAILED' as const, error: 'Recipient has disabled push notifications.' };
    await prisma.notificationLog.update({ where: { id: params.logId }, data: { status: result.status, error: result.error } });
    return result;
  }

  const tokens = await prisma.pushDeviceToken.findMany({
    where: {
      userId: recipientUserId,
      isEnabled: true,
    },
    orderBy: { lastSeenAt: 'desc' },
  });
  if (!tokens.length) {
    const result = { status: 'FAILED' as const, error: 'Recipient has no active push devices.' };
    await prisma.notificationLog.update({ where: { id: params.logId }, data: { status: result.status, error: result.error } });
    return result;
  }

  const adapter = await resolveAdapter({ channel: 'PUSH', schoolId: params.schoolId ?? null });
  const results = [];
  for (const device of tokens) {
    const result = await adapter.send({ ...params.payload, to: device.token, platform: device.platform });
    results.push({ device, result });
    if (result.status === 'FAILED' && isInvalidFirebaseTokenError(result.error)) {
      await prisma.pushDeviceToken.update({
        where: { id: device.id },
        data: { isEnabled: false, disabledAt: new Date() },
      });
    }
  }

  const sent = results.filter((item) => item.result.status === 'SENT').length;
  const firstSent = results.find((item) => item.result.status === 'SENT')?.result;
  const firstFailure = results.find((item) => item.result.status === 'FAILED')?.result;
  const status: DeliveryResult['status'] = sent > 0 ? 'SENT' : 'FAILED';
  const error = sent > 0 ? null : firstFailure?.error ?? 'Push delivery failed for every device.';
  await prisma.notificationLog.update({
    where: { id: params.logId },
    data: {
      status,
      providerId: firstSent?.providerId ?? null,
      error,
      sentAt: sent > 0 ? new Date() : null,
    },
  });

  if (sent > 0) {
    logger.info({ logId: params.logId, channel: 'PUSH', recipientUserId, deviceCount: tokens.length, sent }, 'push notification sent');
  } else {
    logger.warn({ logId: params.logId, channel: 'PUSH', recipientUserId, deviceCount: tokens.length, error }, 'push notification failed');
  }

  return {
    status,
    providerId: firstSent?.providerId,
    error: error ?? undefined,
  };
};

export const dispatchNotification = async (params: {
  logId: string;
  to: string;
  channel: 'PUSH' | 'WHATSAPP' | 'SMS' | 'EMAIL';
  schoolId?: string | null;
  payload: NotificationDispatch;
}) => {
  if (params.channel === 'PUSH') {
    return dispatchPushToUser({
      logId: params.logId,
      recipientUserId: params.to,
      schoolId: params.schoolId ?? null,
      payload: params.payload,
    });
  }

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
