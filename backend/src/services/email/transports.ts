import crypto from 'crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailMessage, EmailProviderDeliveryResult } from './email.types';

type SmtpTransportConfig = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  fromEmail: string;
  fromName?: string;
  replyToEmail?: string;
  secure?: boolean;
  requireTLS?: boolean;
};

const SMTP_TIMEOUT_MS = 30_000;
const SMTP_POOL_MAX_CONNECTIONS = 5;
const SMTP_POOL_MAX_MESSAGES = 100;

type TransportMessage = EmailMessage & {
  fromEmail?: string;
  fromName?: string;
  replyToEmail?: string;
};

const cachedTransports = new Map<string, Transporter>();

const formatFrom = (email: string, name?: string) => {
  const trimmedEmail = email.trim();
  const trimmedName = name?.trim();
  return trimmedName ? `"${trimmedName.replace(/"/g, '\\"')}" <${trimmedEmail}>` : trimmedEmail;
};

const summarizeSmtpError = (error: unknown) => {
  if (!(error instanceof Error)) return 'SMTP email failed';
  const code = (error as { code?: string; responseCode?: number }).code;
  const responseCode = (error as { responseCode?: number }).responseCode;
  return [code, responseCode, error.message].filter(Boolean).join(' ');
};

const elapsedMs = (startedAt: bigint) => Number((process.hrtime.bigint() - startedAt) / BigInt(1_000_000));

const secretDigest = (value: string | undefined) =>
  value ? crypto.createHash('sha256').update(value).digest('hex') : undefined;

const transportCacheKey = (provider: string, config: SmtpTransportConfig) =>
  JSON.stringify({
    provider,
    host: config.host,
    port: config.port,
    username: config.username,
    passwordDigest: secretDigest(config.password),
    secure: config.secure ?? config.port === 465,
    requireTLS: config.requireTLS ?? false,
  });

const getCachedTransport = (provider: string, config: SmtpTransportConfig) => {
  const cacheKey = transportCacheKey(provider, config);
  const existing = cachedTransports.get(cacheKey);
  if (existing) return existing;

  const transporter = nodemailer.createTransport({
    pool: true,
    host: config.host,
    port: config.port,
    secure: config.secure ?? config.port === 465,
    requireTLS: config.requireTLS,
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
    maxConnections: SMTP_POOL_MAX_CONNECTIONS,
    maxMessages: SMTP_POOL_MAX_MESSAGES,
    ...(config.username && config.password
      ? {
          auth: {
            user: config.username,
            pass: config.password,
          },
        }
      : {}),
  });

  cachedTransports.set(cacheKey, transporter);
  return transporter;
};

export const closeEmailTransports = async () => {
  for (const transporter of cachedTransports.values()) {
    transporter.close();
  }
  cachedTransports.clear();
};

export class SMTPTransport {
  constructor(
    private readonly provider: string,
    private readonly config: SmtpTransportConfig,
  ) {}

  async send(message: TransportMessage): Promise<EmailProviderDeliveryResult> {
    const startedAt = process.hrtime.bigint();
    const sender = message.fromEmail ?? this.config.fromEmail;
    if (!this.config.host || !this.config.port || !sender) {
      return {
        status: 'FAILED',
        provider: this.provider,
        sender,
        error: 'SMTP credentials are incomplete',
        durationMs: elapsedMs(startedAt),
      };
    }

    const transporter = getCachedTransport(this.provider, this.config);

    try {
      const result = await transporter.sendMail({
        to: message.to,
        from: formatFrom(sender, message.fromName ?? this.config.fromName),
        replyTo: message.replyToEmail?.trim() || this.config.replyToEmail?.trim() || undefined,
        subject: message.subject,
        text: message.body,
        html: message.html || undefined,
      });
      return {
        status: 'SENT',
        provider: this.provider,
        sender,
        providerId: result.messageId,
        durationMs: elapsedMs(startedAt),
      };
    } catch (error) {
      return {
        status: 'FAILED',
        provider: this.provider,
        sender,
        error: summarizeSmtpError(error),
        durationMs: elapsedMs(startedAt),
      };
    }
  }
}

export class GoogleWorkspaceTransport extends SMTPTransport {
  constructor(config: SmtpTransportConfig) {
    super('GOOGLE_WORKSPACE', config);
  }
}
