import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';

const featureFlagKeySchema = z
  .string()
  .trim()
  .min(1, 'Feature flag key is required.')
  .regex(/^[a-z0-9][a-z0-9_-]*$/, 'Feature flag key must use lowercase letters, numbers, hyphens, or underscores.');

const flagSchema = z.object({
  key: featureFlagKeySchema.optional(),
  code: featureFlagKeySchema.optional(),
  name: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  status: z.enum(['DISABLED', 'ENABLED']).optional(),
  enabled: z.boolean().optional(),
});

const overrideSchema = z.object({
  flagId: z.string().uuid(),
  status: z.enum(['DISABLED', 'ENABLED']),
  schoolId: z.string().uuid().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
});

const configSchema = z.object({
  key: z.string().trim().min(1, 'Config key is required.'),
  description: z.string().trim().max(500).optional().nullable(),
  value: z.record(z.unknown(), {
    invalid_type_error: 'Config value must be a JSON object.',
    required_error: 'Config value must be a JSON object.',
  }),
});

const configUpdateSchema = z.object({
  key: z.string().trim().min(1, 'Config key is required.').optional(),
  description: z.string().trim().max(500).optional().nullable(),
  value: z
    .record(z.unknown(), {
      invalid_type_error: 'Config value must be a JSON object.',
      required_error: 'Config value must be a JSON object.',
    })
    .optional(),
});

const configOverrideSchema = z.object({
  configId: z.string().uuid(),
  value: z.record(z.unknown()),
  schoolId: z.string().uuid().optional(),
});

const parseRequest = <T>(schema: z.ZodType<T>, body: unknown, message = 'Invalid request body.') => {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, message, result.error.flatten());
  }
  return result.data;
};

const normalizeFlagPayload = (body: unknown, options?: { requireKey?: boolean }) => {
  const payload = parseRequest(flagSchema, body, 'Invalid feature flag request.');
  const hasName = Object.prototype.hasOwnProperty.call(payload, 'name');
  const hasDescription = Object.prototype.hasOwnProperty.call(payload, 'description');
  if (payload.key && payload.code && payload.key !== payload.code) {
    throw new HttpError(400, 'Feature flag key conflict.');
  }

  const statusFromEnabled =
    payload.enabled === undefined ? undefined : payload.enabled ? 'ENABLED' : 'DISABLED';
  if (payload.status && statusFromEnabled && payload.status !== statusFromEnabled) {
    throw new HttpError(400, 'Feature flag status conflict.');
  }

  const key = payload.key ?? payload.code;
  if (options?.requireKey && !key) {
    throw new HttpError(400, 'Feature flag key is required.');
  }

  return {
    key,
    name: hasName ? payload.name ?? null : undefined,
    description: hasDescription ? payload.description ?? null : undefined,
    status: payload.status ?? statusFromEnabled,
  };
};

export const createFeatureFlag = async (req: Request, res: Response) => {
  const payload = normalizeFlagPayload(req.body, { requireKey: true });

  const flag = await prisma.featureFlag.create({
    data: {
      key: payload.key!,
      name: payload.name ?? null,
      description: payload.description ?? null,
      status: payload.status ?? 'DISABLED',
    },
  });

  res.status(201).json(flag);
};

export const listFeatureFlags = async (_req: Request, res: Response) => {
  const flags = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  res.status(200).json(flags);
};

export const updateFeatureFlag = async (req: Request, res: Response) => {
  const payload = normalizeFlagPayload(req.body);
  const { id } = req.params;

  const existing = await prisma.featureFlag.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Feature flag not found');

  const flag = await prisma.featureFlag.update({
    where: { id },
    data: {
      ...(payload.key ? { key: payload.key } : {}),
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.status ? { status: payload.status } : {}),
    },
  });

  res.status(200).json(flag);
};

export const deleteFeatureFlag = async (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = await prisma.featureFlag.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Feature flag not found');

  await prisma.featureFlag.delete({ where: { id } });
  res.status(204).send();
};

export const setFeatureOverride = async (req: Request, res: Response) => {
  const payload = overrideSchema.parse(req.body);

  const override = await prisma.featureFlagOverride.upsert({
    where: {
      flagId_schoolId_userId: {
        flagId: payload.flagId,
        schoolId: payload.schoolId ?? null,
        userId: payload.userId ?? null,
      },
    },
    update: { status: payload.status },
    create: {
      flagId: payload.flagId,
      status: payload.status,
      schoolId: payload.schoolId ?? null,
      userId: payload.userId ?? null,
    },
  });

  res.status(200).json(override);
};

export const createConfigEntry = async (req: Request, res: Response) => {
  const payload = parseRequest(configSchema, req.body, 'Invalid config entry request.');

  const config = await prisma.configEntry.create({
    data: {
      key: payload.key,
      value: payload.value as Prisma.InputJsonValue,
      description: payload.description ?? null,
    },
  });

  res.status(201).json(config);
};

export const listConfigEntries = async (_req: Request, res: Response) => {
  const configs = await prisma.configEntry.findMany({ orderBy: { key: 'asc' } });
  res.status(200).json(configs);
};

export const updateConfigEntry = async (req: Request, res: Response) => {
  const payload = parseRequest(configUpdateSchema, req.body, 'Invalid config entry request.');
  const { id } = req.params;

  const existing = await prisma.configEntry.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Config entry not found');

  const config = await prisma.configEntry.update({
    where: { id },
    data: {
      ...(payload.key ? { key: payload.key } : {}),
      ...(payload.description !== undefined ? { description: payload.description ?? null } : {}),
      ...(payload.value ? { value: payload.value as Prisma.InputJsonValue } : {}),
      version: existing.version + 1,
    },
  });

  res.status(200).json(config);
};

export const setTenantConfigOverride = async (req: Request, res: Response) => {
  const payload = configOverrideSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const override = await prisma.tenantConfigOverride.upsert({
    where: { configId_schoolId: { configId: payload.configId, schoolId } },
    update: { value: payload.value as Prisma.InputJsonValue, version: { increment: 1 } },
    create: { configId: payload.configId, schoolId, value: payload.value as Prisma.InputJsonValue },
  });

  res.status(200).json(override);
};
