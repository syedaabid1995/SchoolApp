import type { Job } from 'bullmq';
import type { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../config/db';
import { emailDeadLetterQueue, platformEmailQueue, tenantEmailQueue } from '../queues';
import {
  emailScopeForIntent,
  normalizeEmailIntent,
  type EmailDeliveryStatus,
  type EmailFacadeDeliveryResult,
  type EmailIntent,
  type EmailProviderDeliveryResult,
  type EmailQueueJobData,
  type EmailSenderIdentity,
  type PlatformEmailIntent,
  type TenantEmailIntent,
} from './email/email.types';
import { PlatformEmailProvider } from './email/platformEmailProvider';
import { TenantEmailProvider } from './email/tenantEmailProvider';
import {
  buildTemporaryPasswordCredentialEmailContent,
  resolveCredentialSenderNameFromLoginUrl,
} from './email/credentialEmailContent';
import { renderEmailTemplate } from './email/templateRenderer';

export type { EmailDeliveryStatus };

const EMAIL_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: 1000,
  removeOnFail: false,
};

type EmailServiceResult = {
  status: EmailDeliveryStatus;
  logId?: string;
  delivery?: EmailFacadeDeliveryResult | null;
};

type SendEmailParams = {
  intent: EmailIntent;
  to: string;
  subject?: string;
  body?: string;
  html?: string;
  schoolId?: string | null;
  userId?: string | null;
  data?: Record<string, unknown>;
  safePayload?: Record<string, unknown>;
  senderIdentity?: EmailSenderIdentity;
  senderName?: string | null;
};

const payloadRecord = (payload: unknown): Record<string, unknown> => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  return payload as Record<string, unknown>;
};

const updateLogPayload = async (logId: string, values: Record<string, unknown>) => {
  const log = await prisma.notificationLog.findUnique({ where: { id: logId }, select: { payload: true } });
  const payload = payloadRecord(log?.payload);
  const audit = payloadRecord(payload.emailAudit);
  await prisma.notificationLog.update({
    where: { id: logId },
    data: {
      payload: {
        ...payload,
        emailAudit: {
          ...audit,
          ...values,
        },
      } as Prisma.InputJsonValue,
    },
  });
};

const failLog = async (logId: string, error: string) => {
  await prisma.notificationLog.update({
    where: { id: logId },
    data: {
      status: 'FAILED',
      error,
      sentAt: null,
    },
  });
  await updateLogPayload(logId, {
    failureReason: error,
    failedAt: new Date().toISOString(),
  });
};

const updateLogFromDelivery = async (logId: string, delivery: EmailProviderDeliveryResult, attemptCount: number) => {
  await prisma.notificationLog.update({
    where: { id: logId },
    data: {
      status: delivery.status,
      providerId: delivery.providerId ?? null,
      error: delivery.error ?? null,
      sentAt: delivery.status === 'SENT' ? new Date() : null,
    },
  });
  await updateLogPayload(logId, {
    provider: delivery.provider,
    sender: delivery.sender,
    attemptCount,
    providerMessageId: delivery.providerId ?? null,
    durationMs: delivery.durationMs,
    failureReason: delivery.error ?? null,
    ...(delivery.status === 'SENT' ? { sentAt: new Date().toISOString() } : {}),
  });
};

const emailJobId = (scope: 'PLATFORM' | 'TENANT', logId: string) => `email-${scope.toLowerCase()}-${logId}`;

const sentFacadeDeliveryFromLog = async (logId: string): Promise<EmailFacadeDeliveryResult | null> => {
  const log = await prisma.notificationLog.findUnique({
    where: { id: logId },
    select: { status: true, providerId: true },
  });
  if (log?.status !== 'SENT') return null;
  return { status: 'SENT', providerId: log.providerId ?? undefined };
};

const sentProviderDeliveryFromLog = async (
  logId: string,
  fallback: { provider: string; sender: string },
): Promise<EmailProviderDeliveryResult | null> => {
  const log = await prisma.notificationLog.findUnique({
    where: { id: logId },
    select: { status: true, providerId: true, payload: true },
  });
  if (log?.status !== 'SENT') return null;

  const payload = payloadRecord(log.payload);
  const audit = payloadRecord(payload.emailAudit);
  return {
    status: 'SENT',
    provider: typeof audit.provider === 'string' ? audit.provider : fallback.provider,
    sender: typeof audit.sender === 'string' ? audit.sender : fallback.sender,
    providerId: log.providerId ?? undefined,
    durationMs: 0,
  };
};

const addDeadLetterJob = async (params: {
  scope: 'PLATFORM' | 'TENANT';
  job?: Job<EmailQueueJobData>;
  error: Error;
}) => {
  const data = params.job?.data;
  try {
    await emailDeadLetterQueue.add(
      'email-dead-letter',
      {
        scope: params.scope,
        failedAt: new Date().toISOString(),
        error: params.error.message,
        jobId: params.job?.id ?? null,
        data: data
          ? {
              logId: data.logId,
              schoolId: data.schoolId ?? null,
              userId: data.userId ?? null,
              intent: data.intent,
              senderIdentity: data.senderIdentity ?? null,
              senderName: data.senderName ?? null,
              templateKey: data.templateKey ?? null,
              to: data.to,
              queuedAt: data.queuedAt,
            }
          : null,
        attemptsMade: params.job?.attemptsMade ?? 0,
      },
      { removeOnComplete: 1000, removeOnFail: false },
    );
  } catch (deadLetterError) {
    logger.error({ err: deadLetterError, scope: params.scope, jobId: params.job?.id }, 'failed to enqueue email dead letter');
  }
};

const enqueue = async (scope: 'PLATFORM' | 'TENANT', data: EmailQueueJobData): Promise<EmailFacadeDeliveryResult> => {
  const queue = scope === 'PLATFORM' ? platformEmailQueue : tenantEmailQueue;
  try {
    const alreadySent = await sentFacadeDeliveryFromLog(data.logId);
    if (alreadySent) return alreadySent;

    const job = await queue.add(scope === 'PLATFORM' ? 'send-platform-email' : 'send-tenant-email', data, {
      ...EMAIL_JOB_OPTIONS,
      jobId: emailJobId(scope, data.logId),
    });
    await prisma.notificationLog.update({
      where: { id: data.logId },
      data: { scheduledAt: null },
    });
    await updateLogPayload(data.logId, {
      provider: scope === 'PLATFORM' ? 'GOOGLE_WORKSPACE' : 'SMTP',
      recipient: data.to,
      intent: data.intent,
      scope,
      template: data.templateKey ?? null,
      queuedAt: data.queuedAt,
      jobId: job.id ?? null,
    });
    return { status: 'QUEUED', providerId: job.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to enqueue email';
    logger.error({ err: error, scope, logId: data.logId, intent: data.intent }, 'failed to enqueue email');
    await failLog(data.logId, message);
    return { status: 'FAILED', error: message };
  }
};

const createEmailLog = async (params: {
  schoolId?: string | null;
  userId?: string | null;
  intent: EmailIntent;
  scope: 'PLATFORM' | 'TENANT';
  to: string;
  subject: string;
  templateKey?: string | null;
  provider: string;
  sender: string;
  safePayload?: Record<string, unknown>;
}) =>
  prisma.notificationLog.create({
    data: {
      schoolId: params.schoolId ?? null,
      userId: params.userId ?? null,
      channel: 'EMAIL',
      payload: {
        to: params.to,
        subject: params.subject,
        ...(params.safePayload ?? {}),
        emailAudit: {
          provider: params.provider,
          sender: params.sender,
          recipient: params.to,
          template: params.templateKey ?? null,
          intent: params.intent,
          scope: params.scope,
          queuedAt: new Date().toISOString(),
        },
      } as Prisma.InputJsonValue,
      status: 'QUEUED',
      scheduledAt: null,
    },
  });

const statusFromDelivery = (delivery: EmailFacadeDeliveryResult): EmailDeliveryStatus => {
  if (delivery.status === 'QUEUED') return 'email_queued';
  return delivery.status === 'SENT' ? 'email_sent' : 'email_failed';
};

export const EmailService = {
  async sendEmail(params: SendEmailParams): Promise<EmailServiceResult> {
    const scope = emailScopeForIntent(params.intent);
    if (scope === 'PLATFORM') {
      return this.sendPlatformEmail({ ...params, intent: params.intent as PlatformEmailIntent });
    }
    return this.sendTenantEmail({ ...params, intent: params.intent as TenantEmailIntent });
  },

  async sendPlatformEmail(params: SendEmailParams & { intent: PlatformEmailIntent }): Promise<EmailServiceResult> {
    if (!PlatformEmailProvider.isConfigured()) {
      return { status: 'email_not_configured', delivery: { status: 'FAILED', error: 'Platform email is not configured' } };
    }

    const rendered = renderEmailTemplate({
      intent: params.intent,
      subject: params.subject,
      body: params.body,
      html: params.html,
      data: params.data,
    });
    const sender = PlatformEmailProvider.resolveSender(params.intent, params.senderIdentity, params.senderName);
    const log = await createEmailLog({
      schoolId: null,
      userId: params.userId ?? null,
      intent: params.intent,
      scope: 'PLATFORM',
      to: params.to,
      subject: rendered.subject,
      templateKey: rendered.templateKey,
      provider: 'GOOGLE_WORKSPACE',
      sender: sender.email,
      safePayload: {
        ...(params.safePayload ?? {}),
        ...(params.senderName ? { senderName: params.senderName } : {}),
      },
    });
    const delivery = await enqueue('PLATFORM', {
      logId: log.id,
      schoolId: null,
      userId: params.userId ?? null,
      intent: params.intent,
      senderIdentity: params.senderIdentity,
      senderName: params.senderName,
      templateKey: rendered.templateKey,
      to: params.to,
      subject: rendered.subject,
      body: rendered.body,
      html: rendered.html,
      queuedAt: new Date().toISOString(),
    });
    return { status: statusFromDelivery(delivery), logId: log.id, delivery };
  },

  async sendTenantEmail(params: SendEmailParams & { intent: TenantEmailIntent }): Promise<EmailServiceResult> {
    if (!params.schoolId) {
      return { status: 'email_not_configured', delivery: { status: 'FAILED', error: 'Tenant email requires a schoolId' } };
    }
    const config = await TenantEmailProvider.resolveConfigWithoutSecrets(params.schoolId);
    if (!config) {
      return { status: 'email_not_configured', delivery: { status: 'FAILED', error: 'School SMTP provider is not configured' } };
    }

    const rendered = renderEmailTemplate({
      intent: params.intent,
      subject: params.subject,
      body: params.body,
      html: params.html,
      data: params.data,
    });
    const log = await createEmailLog({
      schoolId: params.schoolId,
      userId: params.userId ?? null,
      intent: params.intent,
      scope: 'TENANT',
      to: params.to,
      subject: rendered.subject,
      templateKey: rendered.templateKey,
      provider: config.provider,
      sender: config.sender,
      safePayload: params.safePayload,
    });
    const delivery = await enqueue('TENANT', {
      logId: log.id,
      schoolId: params.schoolId,
      userId: params.userId ?? null,
      intent: params.intent,
      templateKey: rendered.templateKey,
      to: params.to,
      subject: rendered.subject,
      body: rendered.body,
      html: rendered.html,
      queuedAt: new Date().toISOString(),
    });
    return { status: statusFromDelivery(delivery), logId: log.id, delivery };
  },

  async enqueueExistingNotificationLog(params: {
    logId: string;
    schoolId?: string | null;
    userId?: string | null;
    intent?: EmailIntent;
    to: string;
    subject?: string;
    body?: string;
    html?: string;
    templateKey?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<EmailFacadeDeliveryResult> {
    const fallbackIntent: EmailIntent = params.schoolId ? 'GENERAL_COMMUNICATION' : 'PLATFORM_NOTIFICATION';
    const intent = normalizeEmailIntent(params.intent ?? params.payload?.emailIntent, fallbackIntent);
    const scope = emailScopeForIntent(intent);
    const body = params.body ?? '';
    const subject = params.subject ?? 'Notification';
    if (!params.to || (!body && !params.html)) {
      const error = 'Email notification is missing recipient or message content';
      await failLog(params.logId, error);
      return { status: 'FAILED', error };
    }

    if (scope === 'PLATFORM') {
      if (!PlatformEmailProvider.isConfigured()) {
        const error = 'Platform email is not configured';
        await failLog(params.logId, error);
        return { status: 'FAILED', error };
      }
      return enqueue('PLATFORM', {
        logId: params.logId,
        schoolId: null,
        userId: params.userId ?? null,
        intent,
        templateKey: params.templateKey ?? null,
        to: params.to,
        subject,
        body,
        html: params.html,
        queuedAt: new Date().toISOString(),
      });
    }

    if (!params.schoolId) {
      const error = 'Tenant email requires a schoolId';
      await failLog(params.logId, error);
      return { status: 'FAILED', error };
    }
    const config = await TenantEmailProvider.resolveConfigWithoutSecrets(params.schoolId);
    if (!config) {
      const error = 'School SMTP provider is not configured';
      await failLog(params.logId, error);
      return { status: 'FAILED', error };
    }
    await updateLogPayload(params.logId, {
      provider: config.provider,
      sender: config.sender,
    });
    return enqueue('TENANT', {
      logId: params.logId,
      schoolId: params.schoolId,
      userId: params.userId ?? null,
      intent,
      templateKey: params.templateKey ?? null,
      to: params.to,
      subject,
      body,
      html: params.html,
      queuedAt: new Date().toISOString(),
    });
  },

  async processPlatformEmailJob(data: EmailQueueJobData, attemptCount: number) {
    const sender = PlatformEmailProvider.resolveSender(
      data.intent as PlatformEmailIntent,
      data.senderIdentity,
      data.senderName,
    );
    const alreadySent = await sentProviderDeliveryFromLog(data.logId, {
      provider: 'GOOGLE_WORKSPACE',
      sender: sender.email,
    });
    if (alreadySent) return alreadySent;

    const result = await PlatformEmailProvider.send({
      intent: data.intent as PlatformEmailIntent,
      senderIdentity: data.senderIdentity,
      senderName: data.senderName,
      message: {
        to: data.to,
        subject: data.subject,
        body: data.body,
        html: data.html,
      },
    }).catch((error): EmailProviderDeliveryResult => ({
      status: 'FAILED',
      provider: 'GOOGLE_WORKSPACE',
      sender: sender.email,
      error: error instanceof Error ? error.message : 'Platform email failed',
      durationMs: 0,
    }));

    await updateLogFromDelivery(data.logId, result, attemptCount);
    if (result.status === 'FAILED') throw new Error(result.error ?? 'Platform email failed');
    return result;
  },

  async processTenantEmailJob(data: EmailQueueJobData, attemptCount: number) {
    if (!data.schoolId) {
      await failLog(data.logId, 'Tenant email requires a schoolId');
      throw new Error('Tenant email requires a schoolId');
    }
    const alreadySent = await sentProviderDeliveryFromLog(data.logId, {
      provider: 'SMTP',
      sender: '',
    });
    if (alreadySent) return alreadySent;

    const result = await TenantEmailProvider.send({
      schoolId: data.schoolId,
      intent: data.intent as TenantEmailIntent,
      message: {
        to: data.to,
        subject: data.subject,
        body: data.body,
        html: data.html,
      },
    }).catch((error): EmailProviderDeliveryResult => ({
      status: 'FAILED',
      provider: 'SMTP',
      sender: '',
      error: error instanceof Error ? error.message : 'Tenant email failed',
      durationMs: 0,
    }));

    await updateLogFromDelivery(data.logId, result, attemptCount);
    if (result.status === 'FAILED') throw new Error(result.error ?? 'Tenant email failed');
    return result;
  },

  async recordDeadLetter(scope: 'PLATFORM' | 'TENANT', job: Job<EmailQueueJobData> | undefined, error: Error) {
    await addDeadLetterJob({ scope, job, error });
  },

  async sendSchoolAdminCredentials(params: {
    to: string;
    schoolName?: string | null;
    schoolCode?: string | null;
    loginUrl?: string | null;
    tempPassword: string;
    userId?: string | null;
  }) {
    return this.sendPlatformEmail({
      intent: 'SCHOOL_ADMIN_CREATED',
      to: params.to,
      userId: params.userId ?? null,
      senderName: resolveCredentialSenderNameFromLoginUrl(params.loginUrl),
      data: {
        recipientName: params.to,
        schoolName: params.schoolName ?? 'your school',
        schoolCode: params.schoolCode ?? 'N/A',
        loginUrl: params.loginUrl ?? env.FRONTEND_URL,
        email: params.to,
        tempPassword: params.tempPassword,
      },
      safePayload: {
        purpose: 'SCHOOL_ADMIN_CREATED',
        schoolName: params.schoolName ?? null,
        schoolCode: params.schoolCode ?? null,
      },
    });
  },

  async sendTemporaryPasswordCredentials(params: {
    to: string;
    recipientName?: string | null;
    schoolName?: string | null;
    schoolCode?: string | null;
    loginUrl: string;
    tempPassword: string;
    userId?: string | null;
    roleLabel?: string | null;
  }) {
    const content = buildTemporaryPasswordCredentialEmailContent({
      recipientName: params.recipientName?.trim() || params.to,
      schoolName: params.schoolName ?? null,
      schoolCode: params.schoolCode ?? null,
      loginUrl: params.loginUrl,
      email: params.to,
      tempPassword: params.tempPassword,
      roleLabel: params.roleLabel ?? null,
    });

    return this.sendPlatformEmail({
      intent: 'PLATFORM_NOTIFICATION',
      to: params.to,
      subject: content.subject,
      body: content.body,
      userId: params.userId ?? null,
      senderName: resolveCredentialSenderNameFromLoginUrl(params.loginUrl),
      safePayload: {
        purpose: 'TEMPORARY_PASSWORD_CREDENTIALS',
        roleLabel: params.roleLabel ?? null,
        schoolName: params.schoolName ?? null,
        schoolCode: params.schoolCode ?? null,
      },
    });
  },
};

/**
 * @deprecated Use EmailService.sendEmail() so platform and tenant routing stays explicit.
 */
export const sendConfiguredEmail = async (params: {
  to: string;
  subject: string;
  body: string;
  userId?: string | null;
  schoolId: string | null;
  safePayload?: Record<string, unknown>;
}): Promise<Exclude<EmailDeliveryStatus, 'development_log'>> => {
  const result = await EmailService.sendEmail({
    intent: params.schoolId ? 'GENERAL_COMMUNICATION' : 'PLATFORM_NOTIFICATION',
    to: params.to,
    subject: params.subject,
    body: params.body,
    userId: params.userId,
    schoolId: params.schoolId,
    safePayload: params.safePayload,
  });
  return result.status === 'development_log' ? 'email_failed' : result.status;
};

export const sendLoginOtpEmail = async (params: {
  to: string;
  otp: string;
  challengeId: string;
  userId: string;
  schoolId: string | null;
  expiresAt: Date;
}): Promise<EmailDeliveryStatus> => {
  const result = await EmailService.sendEmail({
    intent: 'LOGIN_OTP',
    to: params.to,
    userId: params.userId,
    data: {
      otp: params.otp,
      expiresAt: params.expiresAt.toISOString(),
    },
    safePayload: {
      purpose: 'LOGIN_MFA_OTP',
      challengeId: params.challengeId,
      expiresAt: params.expiresAt.toISOString(),
    },
  });

  if (result.status !== 'email_not_configured') {
    return result.status;
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
