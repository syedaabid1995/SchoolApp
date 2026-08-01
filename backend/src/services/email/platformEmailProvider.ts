import { env } from '../../config/env';
import {
  defaultPlatformSenderForIntent,
  PLATFORM_SENDER_EMAILS,
  type EmailMessage,
  type EmailProviderDeliveryResult,
  type EmailSenderIdentity,
  type PlatformEmailIntent,
} from './email.types';
import { GoogleWorkspaceTransport, SMTPTransport } from './transports';

const isValidEmail = (value: string | undefined) => Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));

const hasPlatformSmtpAuth = () => Boolean(env.PLATFORM_SMTP_USERNAME && env.PLATFORM_SMTP_PASSWORD);

const isPlatformSmtpConfigured = () =>
  Boolean(
    env.PLATFORM_SMTP_HOST &&
      env.PLATFORM_SMTP_PORT &&
      env.PLATFORM_SMTP_FROM_NAME &&
      isValidEmail(env.PLATFORM_SMTP_FROM_EMAIL) &&
      isValidEmail(env.PLATFORM_SMTP_REPLY_TO) &&
      Boolean(env.PLATFORM_SMTP_USERNAME) === Boolean(env.PLATFORM_SMTP_PASSWORD),
  );

const isGoogleSmtpConfigured = () =>
  Boolean(
    env.GOOGLE_SMTP_HOST &&
      env.GOOGLE_SMTP_PORT &&
      env.GOOGLE_SMTP_FROM_NAME &&
      isValidEmail(env.GOOGLE_SMTP_FROM_EMAIL) &&
      isValidEmail(env.GOOGLE_SMTP_REPLY_TO),
  );

const getActiveProvider = () => {
  if (isPlatformSmtpConfigured()) {
    return {
      provider: 'PLATFORM_SMTP',
      id: 'platform-smtp',
      serviceId: 'platform-smtp',
      serviceCode: 'SMTP',
      serviceName: 'Platform SMTP',
      host: env.PLATFORM_SMTP_HOST!,
      port: env.PLATFORM_SMTP_PORT!,
      username: env.PLATFORM_SMTP_USERNAME,
      password: env.PLATFORM_SMTP_PASSWORD,
      fromName: env.PLATFORM_SMTP_FROM_NAME!,
      fromEmail: env.PLATFORM_SMTP_FROM_EMAIL!,
      replyToEmail: env.PLATFORM_SMTP_REPLY_TO!,
      ehloName: env.PLATFORM_SMTP_EHLO_NAME ?? 'mail.saapttech.com',
      debug: env.PLATFORM_SMTP_DEBUG,
      authenticated: hasPlatformSmtpAuth(),
    };
  }

  if (isGoogleSmtpConfigured()) {
    return {
      provider: 'GOOGLE_WORKSPACE',
      id: 'platform-google-workspace',
      serviceId: 'google-workspace',
      serviceCode: 'GOOGLE_WORKSPACE',
      serviceName: 'Google Workspace',
      host: env.GOOGLE_SMTP_HOST!,
      port: env.GOOGLE_SMTP_PORT!,
      username: undefined,
      password: undefined,
      fromName: env.GOOGLE_SMTP_FROM_NAME!,
      fromEmail: env.GOOGLE_SMTP_FROM_EMAIL!,
      replyToEmail: env.GOOGLE_SMTP_REPLY_TO!,
      ehloName: env.GOOGLE_SMTP_EHLO_NAME ?? 'mail.akademifyy.in',
      debug: env.GOOGLE_SMTP_DEBUG,
      authenticated: false,
    };
  }

  return null;
};

export const PlatformEmailProvider = {
  isConfigured() {
    if (process.env.NODE_ENV === 'test') return false;
    return Boolean(getActiveProvider());
  },

  getStatus() {
    const provider = getActiveProvider();
    const sender = provider?.fromEmail ?? null;
    return {
      id: provider?.id ?? 'platform-email',
      channel: 'EMAIL' as const,
      isEnabled: this.isConfigured(),
      configured: this.isConfigured(),
      serviceId: provider?.serviceId ?? null,
      serviceCode: provider?.serviceCode ?? null,
      serviceName: provider?.serviceName ?? null,
      credentialKeys: provider?.authenticated ? ['username', 'password'] : [],
      maskedCredentials: {},
      currentSender: sender,
      currentReplyTo: provider?.replyToEmail ?? null,
    };
  },

  resolveSender(intent: PlatformEmailIntent, identity?: EmailSenderIdentity, senderName?: string | null) {
    const provider = getActiveProvider();
    const senderIdentity = identity ?? defaultPlatformSenderForIntent(intent);
    const defaultSender = provider?.fromEmail ?? PLATFORM_SENDER_EMAILS.NO_REPLY;
    return {
      identity: senderIdentity,
      email:
        provider?.provider === 'PLATFORM_SMTP'
          ? defaultSender
          : senderIdentity === 'NO_REPLY'
            ? defaultSender
            : PLATFORM_SENDER_EMAILS[senderIdentity],
      name: senderName?.trim() || provider?.fromName,
      replyToEmail: provider?.replyToEmail,
    };
  },

  async send(params: {
    intent: PlatformEmailIntent;
    message: EmailMessage;
    senderIdentity?: EmailSenderIdentity;
    senderName?: string | null;
  }): Promise<EmailProviderDeliveryResult> {
    const provider = getActiveProvider();
    if (!this.isConfigured()) {
      return {
        status: 'FAILED',
        provider: 'PLATFORM_EMAIL',
        sender: '',
        error: 'Platform email environment variables are incomplete',
        durationMs: 0,
      };
    }

    const sender = this.resolveSender(params.intent, params.senderIdentity, params.senderName);
    const transportConfig = {
      host: provider!.host,
      port: provider!.port,
      username: provider!.username,
      password: provider!.password,
      name: provider!.ehloName,
      fromEmail: sender.email,
      fromName: sender.name,
      replyToEmail: sender.replyToEmail,
      secure: provider!.port === 465,
      requireTLS: provider!.port === 587,
      logger: provider!.debug,
      debug: provider!.debug,
      tls: {
        rejectUnauthorized: true,
      },
    };
    const transport =
      provider!.provider === 'GOOGLE_WORKSPACE'
        ? new GoogleWorkspaceTransport(transportConfig)
        : new SMTPTransport(provider!.provider, transportConfig);

    return transport.send({
      ...params.message,
      fromEmail: sender.email,
      fromName: sender.name,
      replyToEmail: sender.replyToEmail,
    });
  },
};
