import { NotificationChannel, Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';

const TWILIO_SERVICE_CODE = 'TWILIO';

const DEFAULT_SERVICES: Array<{ code: string; name: string; supportedChannels: NotificationChannel[] }> = [
  { code: TWILIO_SERVICE_CODE, name: 'Twilio', supportedChannels: ['SMS', 'WHATSAPP'] },
];

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
    normalizeSupportedChannels(service.supportedChannels).includes(channel),
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

  if (service.code === TWILIO_SERVICE_CODE) {
    const required = ['accountSid', 'authToken', 'from'];
    const missing = required.filter((key) => !params.credentials[key]?.trim());
    if (missing.length) throw new HttpError(400, `Missing required Twilio fields: ${missing.join(', ')}`);
  }

  const config = await prisma.schoolMessagingConfig.upsert({
    where: { schoolId_channel: { schoolId: params.schoolId, channel: params.channel } },
    update: {
      serviceId: params.serviceId,
      isEnabled: params.isEnabled,
      credentials: params.credentials as unknown as Prisma.InputJsonValue,
    },
    create: {
      schoolId: params.schoolId,
      channel: params.channel,
      serviceId: params.serviceId,
      isEnabled: params.isEnabled,
      credentials: params.credentials as unknown as Prisma.InputJsonValue,
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
    credentialKeys: Object.keys(params.credentials),
  };
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
  if (!params.schoolId) return false;
  const channels: NotificationChannel[] = params.channels?.length ? params.channels : ['SMS', 'WHATSAPP'];
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
