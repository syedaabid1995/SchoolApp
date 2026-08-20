import { prisma } from '../../config/db';
import { decryptMessagingCredentials } from '../../utils/messagingCredentialsCrypto';
import type { EmailMessage, EmailProviderDeliveryResult, TenantEmailIntent } from './email.types';
import { SMTPTransport } from './transports';

type TenantSmtpConfig = {
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

const isValidEmail = (value: string | undefined) => Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));

const asBoolean = (value: string | undefined, fallback = false) => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const normalizeEncryption = (credentials: Record<string, string>, port: number) => {
  const encryption = (credentials.encryption ?? '').trim().toUpperCase();
  const ssl = asBoolean(credentials.ssl, false);
  const tls = asBoolean(credentials.tls, false);
  const secure = asBoolean(credentials.secure, encryption === 'SSL' || ssl || port === 465);
  return {
    secure,
    requireTLS: encryption === 'TLS' || tls || (!secure && port === 587),
  };
};

export const TenantEmailProvider = {
  async resolveConfig(schoolId: string): Promise<TenantSmtpConfig | null> {
    const config = await prisma.schoolMessagingConfig.findUnique({
      where: { schoolId_channel: { schoolId, channel: 'EMAIL' } },
      include: { service: true },
    });
    if (!config || !config.isEnabled || config.service.status !== 'ACTIVE') return null;
    if (config.service.code !== 'SMTP') return null;

    const credentials = decryptMessagingCredentials(config.credentials);
    const port = Number.parseInt(credentials.port ?? '', 10);
    if (!credentials.host || !Number.isInteger(port) || port < 1 || port > 65535 || !isValidEmail(credentials.fromEmail)) {
      return null;
    }

    return {
      host: credentials.host,
      port,
      username: credentials.username,
      password: credentials.password,
      fromEmail: credentials.fromEmail,
      fromName: credentials.fromName,
      replyToEmail: credentials.replyToEmail,
      ...normalizeEncryption(credentials, port),
    };
  },

  async isConfigured(schoolId: string) {
    return Boolean(await this.resolveConfigWithoutSecrets(schoolId));
  },

  async resolveConfigWithoutSecrets(schoolId: string) {
    const config = await prisma.schoolMessagingConfig.findUnique({
      where: { schoolId_channel: { schoolId, channel: 'EMAIL' } },
      include: { service: true },
    });
    if (!config || !config.isEnabled || config.service.status !== 'ACTIVE') return null;
    if (config.service.code !== 'SMTP') return null;
    const credentials = decryptMessagingCredentials(config.credentials);
    const port = Number.parseInt(credentials.port ?? '', 10);
    if (!credentials.host || !Number.isInteger(port) || port < 1 || port > 65535 || !isValidEmail(credentials.fromEmail)) {
      return null;
    }
    return {
      provider: 'SMTP',
      sender: credentials.fromEmail,
    };
  },

  async send(params: {
    schoolId: string;
    intent: TenantEmailIntent;
    message: EmailMessage;
  }): Promise<EmailProviderDeliveryResult> {
    const config = await this.resolveConfig(params.schoolId);
    if (!config) {
      return {
        status: 'FAILED',
        provider: 'SMTP',
        sender: '',
        error: 'School SMTP provider is not configured',
        durationMs: 0,
      };
    }

    const transport = new SMTPTransport('SMTP', config);
    return transport.send(params.message);
  },
};
