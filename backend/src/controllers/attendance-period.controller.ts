import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { isValidTime } from '../utils/attendance';
import { invalidateAttendanceCache } from '../services/cache/cache.invalidation';

const timeSchema = z.string().refine(isValidTime, 'Invalid time format');

const createSchema = z.object({
  name: z.string().min(1),
  startTime: timeSchema,
  endTime: timeSchema,
  lateThresholdMinutes: z.number().int().min(0).optional(),
  earlyThresholdMinutes: z.number().int().min(0).optional(),
  schoolId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  lateThresholdMinutes: z.number().int().min(0).optional(),
  earlyThresholdMinutes: z.number().int().min(0).optional(),
  schoolId: z.string().uuid().optional(),
});

export const createAttendancePeriod = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const period = await prisma.attendancePeriod.create({
    data: {
      schoolId,
      name: payload.name,
      startTime: payload.startTime,
      endTime: payload.endTime,
      lateThresholdMinutes: payload.lateThresholdMinutes ?? 0,
      earlyThresholdMinutes: payload.earlyThresholdMinutes ?? 0,
    },
  });

  await invalidateAttendanceCache(schoolId);

  res.status(201).json(period);
};

export const listAttendancePeriods = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const periods = await prisma.attendancePeriod.findMany({
    where: { schoolId },
    orderBy: { name: 'asc' },
  });

  res.status(200).json(periods);
};

export const getAttendancePeriod = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const period = await prisma.attendancePeriod.findFirst({
    where: { id, schoolId },
  });

  if (!period) {
    throw new HttpError(404, 'Attendance period not found');
  }

  res.status(200).json(period);
};

export const updateAttendancePeriod = async (req: Request, res: Response) => {
  const payload = updateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  const existing = await prisma.attendancePeriod.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Attendance period not found');
  }

  const period = await prisma.attendancePeriod.update({
    where: { id },
    data: {
      name: payload.name ?? undefined,
      startTime: payload.startTime ?? undefined,
      endTime: payload.endTime ?? undefined,
      lateThresholdMinutes: payload.lateThresholdMinutes ?? undefined,
      earlyThresholdMinutes: payload.earlyThresholdMinutes ?? undefined,
    },
  });

  await invalidateAttendanceCache(schoolId);

  res.status(200).json(period);
};

export const deleteAttendancePeriod = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const existing = await prisma.attendancePeriod.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Attendance period not found');
  }

  await prisma.attendancePeriod.delete({ where: { id } });
  await invalidateAttendanceCache(schoolId);

  res.status(204).send();
};
