import type { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { resolveSchoolId } from '../utils/tenant';

const ATTENDANCE_MODE_KEY = 'attendance.mode';
const modeSchema = z.enum(['DAILY', 'PERIOD_WISE', 'SHIFT_WISE']);

const updateSchema = z.object({
  schoolId: z.string().uuid().optional(),
  mode: modeSchema,
});

const ensureModeConfigEntry = async () => {
  return prisma.configEntry.upsert({
    where: { key: ATTENDANCE_MODE_KEY },
    update: {},
    create: {
      key: ATTENDANCE_MODE_KEY,
      value: { default: 'DAILY' } as Prisma.InputJsonValue,
    },
  });
};

const parseModeFromJson = (value: unknown): z.infer<typeof modeSchema> | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const raw = record.mode ?? record.default;
  const result = modeSchema.safeParse(raw);
  return result.success ? result.data : null;
};

export const getAttendanceMode = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const config = await ensureModeConfigEntry();

  const override = await prisma.tenantConfigOverride.findUnique({
    where: {
      configId_schoolId: {
        configId: config.id,
        schoolId,
      },
    },
    select: { value: true, updatedAt: true },
  });

  const mode = parseModeFromJson(override?.value) ?? parseModeFromJson(config.value) ?? 'DAILY';

  res.status(200).json({
    key: ATTENDANCE_MODE_KEY,
    schoolId,
    mode,
    source: override ? 'OVERRIDE' : 'DEFAULT',
    updatedAt: override?.updatedAt ?? config.updatedAt,
  });
};

export const updateAttendanceMode = async (req: Request, res: Response) => {
  const payload = updateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const config = await ensureModeConfigEntry();

  const override = await prisma.tenantConfigOverride.upsert({
    where: {
      configId_schoolId: {
        configId: config.id,
        schoolId,
      },
    },
    update: {
      value: { mode: payload.mode } as Prisma.InputJsonValue,
      version: { increment: 1 },
    },
    create: {
      configId: config.id,
      schoolId,
      value: { mode: payload.mode } as Prisma.InputJsonValue,
    },
  });

  res.status(200).json({
    key: ATTENDANCE_MODE_KEY,
    schoolId,
    mode: payload.mode,
    source: 'OVERRIDE',
    updatedAt: override.updatedAt,
  });
};
