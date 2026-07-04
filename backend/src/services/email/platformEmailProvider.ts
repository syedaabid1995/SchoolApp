import { env } from '../../config/env';
import {
  defaultPlatformSenderForIntent,
  PLATFORM_SENDER_EMAILS,
  type EmailMessage,
  type EmailProviderDeliveryResult,
  type EmailSenderIdentity,
  type PlatformEmailIntent,
} from './email.types';
import { GoogleWorkspaceTransport } from './transports';

const isValidEmail = (value: string | undefined) => Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));

export const PlatformEmailProvider = {
  isConfigured() {
    if (process.env.NODE_ENV === 'test') return false;
    return Boolean(
      env.GOOGLE_SMTP_HOST &&
        env.GOOGLE_SMTP_PORT &&
        env.GOOGLE_SMTP_FROM_NAME &&
        isValidEmail(env.GOOGLE_SMTP_FROM_EMAIL) &&
        isValidEmail(env.GOOGLE_SMTP_REPLY_TO),
    );
  },

  getStatus() {
    const sender = env.GOOGLE_SMTP_FROM_EMAIL ?? null;
    return {
      id: 'platform-google-workspace',
      channel: 'EMAIL' as const,
      isEnabled: this.isConfigured(),
      configured: this.isConfigured(),
      serviceId: 'google-workspace',
      serviceCode: 'GOOGLE_WORKSPACE',
      serviceName: 'Google Workspace',
      credentialKeys: [],
      maskedCredentials: {},
      currentSender: sender,
      currentReplyTo: env.GOOGLE_SMTP_REPLY_TO ?? null,
    };
  },

  resolveSender(intent: PlatformEmailIntent, identity?: EmailSenderIdentity) {
    const senderIdentity = identity ?? defaultPlatformSenderForIntent(intent);
    const defaultSender = env.GOOGLE_SMTP_FROM_EMAIL ?? PLATFORM_SENDER_EMAILS.NO_REPLY;
    return {
      identity: senderIdentity,
      email: senderIdentity === 'NO_REPLY' ? defaultSender : PLATFORM_SENDER_EMAILS[senderIdentity],
      name: env.GOOGLE_SMTP_FROM_NAME,
      replyToEmail: env.GOOGLE_SMTP_REPLY_TO,
    };
  },

  async send(params: {
    intent: PlatformEmailIntent;
    message: EmailMessage;
    senderIdentity?: EmailSenderIdentity;
  }): Promise<EmailProviderDeliveryResult> {
    if (!this.isConfigured()) {
      return {
        status: 'FAILED',
        provider: 'GOOGLE_WORKSPACE',
        sender: env.GOOGLE_SMTP_FROM_EMAIL ?? '',
        error: 'Google Workspace SMTP relay environment variables are incomplete',
        durationMs: 0,
      };
    }

    const sender = this.resolveSender(params.intent, params.senderIdentity);
    const transport = new GoogleWorkspaceTransport({
      host: env.GOOGLE_SMTP_HOST!,
      port: env.GOOGLE_SMTP_PORT!,
      name: env.GOOGLE_SMTP_EHLO_NAME ?? 'mail.akademifyy.in',
      fromEmail: sender.email,
      fromName: sender.name,
      replyToEmail: sender.replyToEmail,
      secure: false,
      requireTLS: env.GOOGLE_SMTP_PORT === 587,
      logger: env.GOOGLE_SMTP_DEBUG,
      debug: env.GOOGLE_SMTP_DEBUG,
      tls: {
        rejectUnauthorized: true,
      },
    });

    return transport.send({
      ...params.message,
      fromEmail: sender.email,
      fromName: sender.name,
      replyToEmail: sender.replyToEmail,
    });
  },
};
