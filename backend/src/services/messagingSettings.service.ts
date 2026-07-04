import { NotificationChannel, Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { encryptSecret, isEncryptedSecret } from '../utils/cryptoVault';
import { PlatformEmailProvider } from './email/platformEmailProvider';

export const TWILIO_SERVICE_CODE = 'TWILIO';
export const MSG91_SERVICE_CODE = 'MSG91';
export const WATI_SERVICE_CODE = 'WATI';
export const SMTP_SERVICE_CODE = 'SMTP';
export const SENDGRID_SERVICE_CODE = 'SENDGRID';

const DEFAULT_SERVICES: Array<{ code: string; name: string; supportedChannels: NotificationChannel[] }> = [
  { code: TWILIO_SERVICE_CODE, name: 'Twilio', supportedChannels: ['SMS', 'WHATSAPP'] },
  { code: MSG91_SERVICE_CODE, name: 'MSG91', supportedChannels: ['SMS'] },
  { code: WATI_SERVICE_CODE, name: 'WATI', supportedChannels: ['WHATSAPP'] },
  { code: SMTP_SERVICE_CODE, name: 'SMTP Email', supportedChannels: ['EMAIL'] },
  { code: SENDGRID_SERVICE_CODE, name: 'SendGrid', supportedChannels: ['EMAIL'] },
];

const REQUIRED_CREDENTIALS: Partial<Record<string, Partial<Record<NotificationChannel, string[]>>>> = {
  [TWILIO_SERVICE_CODE]: {
    SMS: ['accountSid', 'authToken', 'from'],
    WHATSAPP: ['accountSid', 'authToken', 'from'],
  },
  [MSG91_SERVICE_CODE]: {
    SMS: ['authKey', 'senderId'],
  },
  [WATI_SERVICE_CODE]: {
    WHATSAPP: ['apiEndpoint', 'accessToken'],
  },
  [SMTP_SERVICE_CODE]: {
    EMAIL: ['host', 'port', 'fromEmail'],
  },
  [SENDGRID_SERVICE_CODE]: {
    EMAIL: ['apiKey', 'fromEmail'],
  },
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const normalizeSupportedChannels = (value: unknown): NotificationChannel[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry).toUpperCase())
    .filter((entry): entry is NotificationChannel => ['SMS', 'WHATSAPP', 'EMAIL', 'PUSH'].includes(entry));
};

const maskCredentials = (credentials: Record<string, unknown>) =>
  Object.keys(credentials).reduce<Record<string, string>>((acc, key) => {
    const value = String(credentials[key] ?? '');
    acc[key] = value ? `${'*'.repeat(Math.min(8, value.length))}` : '';
    return acc;
  }, {});

const cleanCredentials = (credentials: Record<string, string>) =>
  Object.entries(credentials).reduce<Record<string, string>>((acc, [key, value]) => {
    const normalizedKey = key.trim();
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    if (normalizedKey && normalizedValue) {
      acc[normalizedKey] = normalizedValue;
    }
    return acc;
  }, {});

const mergeSavedCredentials = (
  existingCredentials: unknown,
  incomingCredentials: Record<string, string>,
) => ({
  ...readStringCredentials(existingCredentials),
  ...cleanCredentials(incomingCredentials),
});

const prepareCredentialsForStorage = (
  serviceCode: string,
  channel: NotificationChannel,
  credentials: Record<string, string>,
) => {
  if (serviceCode !== SMTP_SERVICE_CODE || channel !== 'EMAIL') return credentials;
  const password = credentials.password?.trim();
  if (!password || isEncryptedSecret(password)) return credentials;
  return {
    ...credentials,
    password: encryptSecret(password),
  };
};

const validateCredentials = (serviceCode: string, channel: NotificationChannel, credentials: Record<string, string>) => {
  const required = REQUIRED_CREDENTIALS[serviceCode]?.[channel] ?? [];
  const missing = required.filter((key) => !credentials[key]?.trim());
  if (missing.length) {
    throw new HttpError(400, `Missing required ${serviceCode} fields: ${missing.join(', ')}`);
  }

  if (serviceCode === SMTP_SERVICE_CODE && channel === 'EMAIL') {
    const port = Number.parseInt(credentials.port ?? '', 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new HttpError(400, 'SMTP port must be a valid port number');
    }
    if (!isValidEmail(credentials.fromEmail)) {
      throw new HttpError(400, 'SMTP fromEmail must be a valid email address');
    }
    if (credentials.replyToEmail && !isValidEmail(credentials.replyToEmail)) {
      throw new HttpError(400, 'SMTP replyToEmail must be a valid email address');
    }
  }

  if (serviceCode === SENDGRID_SERVICE_CODE && channel === 'EMAIL') {
    if (!isValidEmail(credentials.fromEmail)) {
      throw new HttpError(400, 'SendGrid fromEmail must be a valid email address');
    }
    if (credentials.replyToEmail && !isValidEmail(credentials.replyToEmail)) {
      throw new HttpError(400, 'SendGrid replyToEmail must be a valid email address');
    }
  }
};

const readStringCredentials = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, entry]) => {
    if (typeof entry === 'string') {
      acc[key] = entry;
    }
    return acc;
  }, {});
};

export const ensureDefaultMessagingServices = async () => {
  await Promise.all(
    DEFAULT_SERVICES.map((service) =>
      prisma.messagingService.upsert({
        where: { code: service.code },
        update: {
          name: service.name,
          supportedChannels: service.supportedChannels as unknown as Prisma.InputJsonValue,
        },
        create: {
          code: service.code,
          name: service.name,
          status: 'ACTIVE',
          supportedChannels: service.supportedChannels as unknown as Prisma.InputJsonValue,
        },
      }),
    ),
  );
};

export const listMessagingServicesAdmin = async () => {
  await ensureDefaultMessagingServices();
  const services = await prisma.messagingService.findMany({
    orderBy: [{ status: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { schoolConfigs: true } } },
  });
  return services.map((service) => ({
    id: service.id,
    code: service.code,
    name: service.name,
    status: service.status,
    supportedChannels: normalizeSupportedChannels(service.supportedChannels),
    schoolConfigsCount: service._count.schoolConfigs,
  }));
};

export const updateMessagingServiceStatus = async (id: string, status: 'ACTIVE' | 'INACTIVE') => {
  const service = await prisma.messagingService.findUnique({ where: { id } });
  if (!service) throw new HttpError(404, 'Messaging service not found');
  return prisma.messagingService.update({
    where: { id },
    data: { status },
  });
};

export const listMessagingServicesForSchool = async (schoolId: string, channel: NotificationChannel) => {
  await ensureDefaultMessagingServices();
  const services = await prisma.messagingService.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { name: 'asc' },
  });
  const compatible = services.filter((service) =>
    normalizeSupportedChannels(service.supportedChannels).includes(channel) &&
      (channel !== 'EMAIL' || service.code === SMTP_SERVICE_CODE),
  );
  const current = await prisma.schoolMessagingConfig.findUnique({
    where: { schoolId_channel: { schoolId, channel } },
  });

  return {
    channel,
    currentServiceId: current?.serviceId ?? null,
    currentEnabled: current?.isEnabled ?? false,
    services: compatible.map((service) => ({
      id: service.id,
      code: service.code,
      name: service.name,
      supportedChannels: normalizeSupportedChannels(service.supportedChannels),
    })),
  };
};

export const getSchoolMessagingConfig = async (schoolId: string, channel: NotificationChannel) => {
  const config = await prisma.schoolMessagingConfig.findUnique({
    where: { schoolId_channel: { schoolId, channel } },
    include: { service: true },
  });
  if (!config) return null;
  return {
    id: config.id,
    channel: config.channel,
    isEnabled: config.isEnabled,
    serviceId: config.serviceId,
    serviceCode: config.service.code,
    serviceName: config.service.name,
    credentialKeys: Object.keys((config.credentials as Record<string, unknown>) ?? {}),
    maskedCredentials: maskCredentials((config.credentials as Record<string, unknown>) ?? {}),
  };
};

export const upsertSchoolMessagingConfig = async (params: {
  schoolId: string;
  channel: NotificationChannel;
  serviceId: string;
  isEnabled: boolean;
  credentials: Record<string, string>;
}) => {
  const service = await prisma.messagingService.findUnique({ where: { id: params.serviceId } });
  if (!service) throw new HttpError(404, 'Messaging service not found');
  if (service.status !== 'ACTIVE') throw new HttpError(400, 'Messaging service is inactive');
  if (!normalizeSupportedChannels(service.supportedChannels).includes(params.channel)) {
    throw new HttpError(400, 'Selected service does not support this channel');
  }
  if (params.channel === 'EMAIL' && service.code !== SMTP_SERVICE_CODE) {
    throw new HttpError(400, 'Tenant email must use the school SMTP provider');
  }

  const existing = await prisma.schoolMessagingConfig.findUnique({
    where: { schoolId_channel: { schoolId: params.schoolId, channel: params.channel } },
  });
  const credentials =
    existing?.serviceId === params.serviceId
      ? mergeSavedCredentials(existing.credentials, params.credentials)
      : cleanCredentials(params.credentials);
  validateCredentials(service.code, params.channel, credentials);

  const credentialsForStorage = prepareCredentialsForStorage(service.code, params.channel, credentials);
  const config = await prisma.schoolMessagingConfig.upsert({
    where: { schoolId_channel: { schoolId: params.schoolId, channel: params.channel } },
    update: {
      serviceId: params.serviceId,
      isEnabled: params.isEnabled,
      credentials: credentialsForStorage as unknown as Prisma.InputJsonValue,
    },
    create: {
      schoolId: params.schoolId,
      channel: params.channel,
      serviceId: params.serviceId,
      isEnabled: params.isEnabled,
      credentials: credentialsForStorage as unknown as Prisma.InputJsonValue,
    },
    include: { service: true },
  });

  return {
    id: config.id,
    schoolId: config.schoolId,
    channel: config.channel,
    isEnabled: config.isEnabled,
    serviceId: config.serviceId,
    serviceCode: config.service.code,
    serviceName: config.service.name,
    credentialKeys: Object.keys(credentialsForStorage),
  };
};

export const getPlatformEmailConfig = async () => {
  return PlatformEmailProvider.getStatus();
};

export const upsertPlatformEmailConfig = async (params: {
  serviceId: string;
  isEnabled: boolean;
  credentials: Record<string, string>;
}) => {
  void params;
  return PlatformEmailProvider.getStatus();
};

export const setPlatformEmailConfigStatus = async (isEnabled: boolean) => {
  void isEnabled;
  return PlatformEmailProvider.getStatus();
};

export const setSchoolMessagingConfigStatus = async (params: {
  schoolId: string;
  channel: NotificationChannel;
  isEnabled: boolean;
}) => {
  const existing = await prisma.schoolMessagingConfig.findUnique({
    where: { schoolId_channel: { schoolId: params.schoolId, channel: params.channel } },
  });
  if (!existing) {
    throw new HttpError(404, 'Messaging config not found for this channel');
  }

  return prisma.schoolMessagingConfig.update({
    where: { schoolId_channel: { schoolId: params.schoolId, channel: params.channel } },
    data: { isEnabled: params.isEnabled },
    include: { service: true },
  });
};

export const hasActiveMessagingGateway = async (params: {
  schoolId?: string | null;
  channels?: NotificationChannel[];
}) => {
  const channels: NotificationChannel[] = params.channels?.length ? params.channels : ['SMS', 'WHATSAPP'];
  if (!params.schoolId) return false;

  const count = await prisma.schoolMessagingConfig.count({
    where: {
      schoolId: params.schoolId,
      channel: { in: channels },
      isEnabled: true,
      service: { status: 'ACTIVE' },
    },
  });
  return count > 0;
};

export const resolveSchoolMessagingProvider = async (params: {
  schoolId?: string | null;
  channel: NotificationChannel;
}) => {
  if (!params.schoolId) return null;

  const config = await prisma.schoolMessagingConfig.findUnique({
    where: { schoolId_channel: { schoolId: params.schoolId, channel: params.channel } },
    include: { service: true },
  });
  if (!config || !config.isEnabled) return null;
  if (config.service.status !== 'ACTIVE') return null;

  return {
    serviceCode: config.service.code,
    credentials: (config.credentials as Record<string, string>) ?? {},
  };
};
