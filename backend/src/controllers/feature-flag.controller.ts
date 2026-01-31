import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';

const flagSchema = z.object({
  key: z.string().min(1),
  status: z.enum(['DISABLED', 'ENABLED']).optional(),
});

const overrideSchema = z.object({
  flagId: z.string().uuid(),
  status: z.enum(['DISABLED', 'ENABLED']),
  schoolId: z.string().uuid().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
});

const configSchema = z.object({
  key: z.string().min(1),
  value: z.record(z.unknown()),
});

const configOverrideSchema = z.object({
  configId: z.string().uuid(),
  value: z.record(z.unknown()),
  schoolId: z.string().uuid().optional(),
});

export const createFeatureFlag = async (req: Request, res: Response) => {
  const payload = flagSchema.parse(req.body);

  const flag = await prisma.featureFlag.create({
    data: { key: payload.key, status: payload.status ?? 'DISABLED' },
  });

  res.status(201).json(flag);
};

export const listFeatureFlags = async (_req: Request, res: Response) => {
  const flags = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  res.status(200).json(flags);
};

export const updateFeatureFlag = async (req: Request, res: Response) => {
  const payload = flagSchema.parse(req.body);
  const { id } = req.params;

  const existing = await prisma.featureFlag.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Feature flag not found');

  const flag = await prisma.featureFlag.update({
    where: { id },
    data: { key: payload.key, status: payload.status ?? existing.status },
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
  const payload = configSchema.parse(req.body);

  const config = await prisma.configEntry.create({
    data: { key: payload.key, value: payload.value },
  });

  res.status(201).json(config);
};

export const listConfigEntries = async (_req: Request, res: Response) => {
  const configs = await prisma.configEntry.findMany({ orderBy: { key: 'asc' } });
  res.status(200).json(configs);
};

export const updateConfigEntry = async (req: Request, res: Response) => {
  const payload = configSchema.parse(req.body);
  const { id } = req.params;

  const existing = await prisma.configEntry.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Config entry not found');

  const config = await prisma.configEntry.update({
    where: { id },
    data: { key: payload.key, value: payload.value, version: existing.version + 1 },
  });

  res.status(200).json(config);
};

export const setTenantConfigOverride = async (req: Request, res: Response) => {
  const payload = configOverrideSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const override = await prisma.tenantConfigOverride.upsert({
    where: { configId_schoolId: { configId: payload.configId, schoolId } },
    update: { value: payload.value, version: { increment: 1 } },
    create: { configId: payload.configId, schoolId, value: payload.value },
  });

  res.status(200).json(override);
};
