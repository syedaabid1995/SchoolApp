import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../config/db';
import { dispatchNotification } from './notificationDispatcher.service';
import { resolvePlatformEmailProvider, resolveSchoolMessagingProvider } from './messagingSettings.service';

export type EmailDeliveryResult = 'development_log' | 'email_not_configured' | 'email_sent' | 'email_failed';

export const sendConfiguredEmail = async (params: {
  to: string;
  subject: string;
  body: string;
  userId?: string | null;
  schoolId: string | null;
  safePayload?: Record<string, unknown>;
}): Promise<Exclude<EmailDeliveryResult, 'development_log'>> => {
  const provider =
    (await resolveSchoolMessagingProvider({ schoolId: params.schoolId, channel: 'EMAIL' })) ??
    (await resolvePlatformEmailProvider());
  if (!provider) {
    return 'email_not_configured';
  }

  const log = await prisma.notificationLog.create({
    data: {
      schoolId: params.schoolId,
      userId: params.userId ?? null,
      channel: 'EMAIL',
      payload: {
        to: params.to,
        subject: params.subject,
        ...(params.safePayload ?? {}),
      },
      status: 'QUEUED',
    },
  });

  const result = await dispatchNotification({
    logId: log.id,
    to: params.to,
    channel: 'EMAIL',
    schoolId: params.schoolId,
    payload: {
      to: params.to,
      subject: params.subject,
      body: params.body,
    },
  });

  return result.status === 'SENT' ? 'email_sent' : 'email_failed';
};

export const sendLoginOtpEmail = async (params: {
  to: string;
  otp: string;
  challengeId: string;
  userId: string;
  schoolId: string | null;
  expiresAt: Date;
}): Promise<EmailDeliveryResult> => {
  const delivery = await sendConfiguredEmail({
    to: params.to,
    subject: 'Your login verification code',
    body: [
      `Your verification code is ${params.otp}.`,
      `This code expires at ${params.expiresAt.toISOString()}.`,
      'If you did not request this code, contact your school administrator.',
    ].join('\n\n'),
    userId: params.userId,
    schoolId: params.schoolId,
    safePayload: {
      purpose: 'LOGIN_MFA_OTP',
      challengeId: params.challengeId,
      expiresAt: params.expiresAt.toISOString(),
    },
  });

  if (delivery !== 'email_not_configured') {
    return delivery;
  }

  if (env.NODE_ENV === 'development') {
    logger.info(
      {
        to: params.to,
        userId: params.userId,
        schoolId: params.schoolId,
        challengeId: params.challengeId,
        otp: params.otp,
        expiresAt: params.expiresAt.toISOString(),
      },
      'development MFA login OTP',
    );
    return 'development_log';
  }

  logger.warn(
    {
      to: params.to,
      userId: params.userId,
      schoolId: params.schoolId,
      challengeId: params.challengeId,
      expiresAt: params.expiresAt.toISOString(),
    },
    'MFA login OTP email service not configured',
  );
  return 'email_not_configured';
};
