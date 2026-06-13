import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { invalidateAttendanceCache } from '../services/cache/cache.invalidation';
import { attendancePeriodCreateSchema, attendancePeriodUpdateSchema } from '../validations/attendance.validation';

const attendancePeriodResponseSelect = {
  id: true,
  schoolId: true,
  type: true,
  name: true,
  startTime: true,
  endTime: true,
  lateThresholdMinutes: true,
  earlyThresholdMinutes: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { timetableEntries: true, sessions: true } },
} as const;

export const createAttendancePeriod = async (req: Request, res: Response) => {
  const payload = attendancePeriodCreateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  if (payload.endTime <= payload.startTime) {
    throw new HttpError(400, 'End time must be after start time');
  }

  const period = await prisma.attendancePeriod.create({
    data: {
      schoolId,
      type: payload.type ?? 'CLASS_TIME',
      name: payload.name,
      startTime: payload.startTime,
      endTime: payload.endTime,
      lateThresholdMinutes: payload.lateThresholdMinutes ?? 0,
      earlyThresholdMinutes: payload.earlyThresholdMinutes ?? 0,
    },
    select: attendancePeriodResponseSelect,
  });

  await invalidateAttendanceCache(schoolId);

  res.status(201).json(period);
};

export const listAttendancePeriods = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const periods = await prisma.attendancePeriod.findMany({
    where: { schoolId },
    orderBy: { name: 'asc' },
    select: attendancePeriodResponseSelect,
  });

  res.status(200).json(periods);
};

export const getAttendancePeriod = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const period = await prisma.attendancePeriod.findFirst({
    where: { id, schoolId },
    select: attendancePeriodResponseSelect,
  });

  if (!period) {
    throw new HttpError(404, 'Attendance period not found');
  }

  res.status(200).json(period);
};

export const updateAttendancePeriod = async (req: Request, res: Response) => {
  const payload = attendancePeriodUpdateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  const existing = await prisma.attendancePeriod.findFirst({
    where: { id, schoolId },
    select: { id: true, startTime: true, endTime: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Attendance period not found');
  }

  if ((payload.endTime ?? existing.endTime) <= (payload.startTime ?? existing.startTime)) {
    throw new HttpError(400, 'End time must be after start time');
  }

  const period = await prisma.attendancePeriod.update({
    where: { id },
    data: {
      name: payload.name ?? undefined,
      type: payload.type ?? undefined,
      startTime: payload.startTime ?? undefined,
      endTime: payload.endTime ?? undefined,
      lateThresholdMinutes: payload.lateThresholdMinutes ?? undefined,
      earlyThresholdMinutes: payload.earlyThresholdMinutes ?? undefined,
    },
    select: attendancePeriodResponseSelect,
  });

  await invalidateAttendanceCache(schoolId);

  res.status(200).json(period);
};

export const deleteAttendancePeriod = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const existing = await prisma.attendancePeriod.findFirst({
    where: { id, schoolId },
    include: { _count: { select: { timetableEntries: true, sessions: true } } },
  });

  if (!existing) {
    throw new HttpError(404, 'Attendance period not found');
  }

  if (existing._count.timetableEntries > 0 || existing._count.sessions > 0) {
    throw new HttpError(409, 'Cannot delete period while timetable or attendance records exist');
  }

  await prisma.attendancePeriod.delete({ where: { id } });
  await invalidateAttendanceCache(schoolId);

  res.status(204).send();
};
