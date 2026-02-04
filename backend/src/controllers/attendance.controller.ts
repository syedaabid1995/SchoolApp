import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { computeStatus, isWithinWindow } from '../utils/attendance';
import { auditAttendance } from '../middlewares/audit.middleware';
import { logAudit } from '../utils/audit';
import { invalidateAttendanceCache } from '../services/cache/cache.invalidation';
import { buildQueryFingerprint, cacheKeys } from '../services/cache/cache.keys';
import { rememberCache, setCacheHeader } from '../services/cache/cache.service';
import { cacheTTL } from '../services/cache/cache.ttl';

const startSchema = z.object({
  periodId: z.string().uuid(),
  date: z.coerce.date().optional(),
  deviceId: z.string().min(1),
  gpsLat: z.number().optional(),
  gpsLng: z.number().optional(),
  schoolId: z.string().uuid().optional(),
});

const markSchema = z.object({
  sessionId: z.string().uuid(),
  records: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .min(1),
  deviceId: z.string().min(1),
  gpsLat: z.number().optional(),
  gpsLng: z.number().optional(),
  schoolId: z.string().uuid().optional(),
});

const overrideSchema = z.object({
  status: z.enum(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED']),
  reason: z.string().min(1),
  schoolId: z.string().uuid().optional(),
});

const listSessionsSchema = z.object({
  schoolId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

export const startSession = async (req: Request, res: Response) => {
  const payload = startSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');

  const teacher = await prisma.teacherProfile.findFirst({
    where: { userId: auth.userId, schoolId },
    select: { isActive: true },
  });
  if (teacher && !teacher.isActive) {
    throw new HttpError(403, 'Teacher account is inactive');
  }

  const period = await prisma.attendancePeriod.findFirst({
    where: { id: payload.periodId, schoolId },
  });

  if (!period) {
    throw new HttpError(404, 'Attendance period not found');
  }

  const sessionDate = payload.date ? new Date(payload.date) : new Date();
  sessionDate.setHours(0, 0, 0, 0);

  const existing = await prisma.attendanceSession.findFirst({
    where: { schoolId, periodId: payload.periodId, date: sessionDate },
  });

  if (existing) {
    return res.status(200).json(existing);
  }

  const session = await prisma.attendanceSession.create({
    data: {
      schoolId,
      periodId: payload.periodId,
      date: sessionDate,
      status: 'OPEN',
      startedById: auth.userId,
      deviceId: payload.deviceId,
      gpsLat: payload.gpsLat ?? null,
      gpsLng: payload.gpsLng ?? null,
    },
  });

  await logAudit(req, {
    schoolId,
    entityType: 'ATTENDANCE_SESSION',
    entityId: session.id,
    action: 'START',
    afterState: {
      periodId: session.periodId,
      date: session.date,
      status: session.status,
      deviceId: session.deviceId,
    },
  });
  await invalidateAttendanceCache(schoolId);

  res.status(201).json(session);
};

export const markAttendance = async (req: Request, res: Response) => {
  const payload = markSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');

  const teacher = await prisma.teacherProfile.findFirst({
    where: { userId: auth.userId, schoolId },
    select: { isActive: true },
  });
  if (teacher && !teacher.isActive) {
    throw new HttpError(403, 'Teacher account is inactive');
  }

  const session = await prisma.attendanceSession.findFirst({
    where: { id: payload.sessionId, schoolId },
    include: { period: true },
  });

  if (!session) {
    throw new HttpError(404, 'Attendance session not found');
  }

  if (session.status !== 'OPEN') {
    throw new HttpError(409, 'Attendance session is closed');
  }

  if (session.deviceId !== payload.deviceId) {
    throw new HttpError(403, 'Device binding violation');
  }

  const now = new Date();
  if (!isWithinWindow(now, session.period.startTime, session.period.endTime)) {
    throw new HttpError(422, 'Attendance window closed');
  }

  const created = await prisma.$transaction(async (tx) => {
    const results = [] as Array<{ studentId: string; status: string }>;

    for (const record of payload.records) {
      const student = await tx.student.findFirst({
        where: { id: record.studentId, schoolId },
        select: { id: true },
      });

      if (!student) {
        throw new HttpError(404, `Student not found: ${record.studentId}`);
      }

      const status = computeStatus(now, session.period.startTime, session.period.lateThresholdMinutes);

      const attendance = await tx.attendanceRecord.create({
        data: {
          sessionId: session.id,
          studentId: record.studentId,
          status,
          confidence: record.confidence ?? null,
          capturedAt: now,
          deviceId: payload.deviceId,
          gpsLat: payload.gpsLat ?? null,
          gpsLng: payload.gpsLng ?? null,
        },
      });

      await auditAttendance(
        req,
        {
          recordId: attendance.id,
          action: 'CREATE',
          newValue: {
            status: attendance.status,
            confidence: attendance.confidence,
            capturedAt: attendance.capturedAt,
          },
        },
        tx,
      );

      results.push({ studentId: attendance.studentId, status: attendance.status });
    }

    return results;
  });

  await logAudit(req, {
    schoolId,
    entityType: 'ATTENDANCE',
    entityId: payload.sessionId,
    action: 'CAPTURE',
    afterState: {
      sessionId: payload.sessionId,
      records: payload.records.length,
      deviceId: payload.deviceId,
    },
  });
  await invalidateAttendanceCache(schoolId);

  res.status(201).json({ records: created });
};

export const closeSession = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.body.schoolId ?? (req.query.schoolId as string | undefined));
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');
  const teacher = await prisma.teacherProfile.findFirst({
    where: { userId: auth.userId, schoolId },
    select: { isActive: true },
  });
  if (teacher && !teacher.isActive) {
    throw new HttpError(403, 'Teacher account is inactive');
  }
  const { id } = req.params;

  const session = await prisma.attendanceSession.findFirst({
    where: { id, schoolId },
  });

  if (!session) {
    throw new HttpError(404, 'Attendance session not found');
  }

  const updated = await prisma.attendanceSession.update({
    where: { id },
    data: { status: 'CLOSED' },
  });

  await logAudit(req, {
    schoolId,
    entityType: 'ATTENDANCE_SESSION',
    entityId: updated.id,
    action: 'CLOSE',
    afterState: { status: updated.status },
  });
  await invalidateAttendanceCache(schoolId);

  res.status(200).json(updated);
};

export const overrideAttendance = async (req: Request, res: Response) => {
  const payload = overrideSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');
  const { id } = req.params;

  const record = await prisma.attendanceRecord.findFirst({
    where: { id, session: { schoolId } },
  });

  if (!record) {
    throw new HttpError(404, 'Attendance record not found');
  }

  const updated = await prisma.attendanceRecord.update({
    where: { id },
    data: {
      status: payload.status,
      manualOverrideReason: payload.reason,
    },
  });

  await auditAttendance(req, {
    recordId: updated.id,
    action: 'OVERRIDE',
    previousValue: {
      status: record.status,
      manualOverrideReason: record.manualOverrideReason,
    },
    newValue: {
      status: updated.status,
      manualOverrideReason: updated.manualOverrideReason,
    },
    reason: payload.reason,
  });

  await logAudit(req, {
    schoolId,
    entityType: 'ATTENDANCE_RECORD',
    entityId: updated.id,
    action: 'OVERRIDE',
    beforeState: { status: record.status, manualOverrideReason: record.manualOverrideReason },
    afterState: { status: updated.status, manualOverrideReason: updated.manualOverrideReason },
  });
  await invalidateAttendanceCache(schoolId);

  res.status(200).json(updated);
};

export const listSessionRecords = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { sessionId } = req.params;

  const session = await prisma.attendanceSession.findFirst({
    where: { id: sessionId, schoolId },
  });

  if (!session) {
    throw new HttpError(404, 'Attendance session not found');
  }

  const records = await prisma.attendanceRecord.findMany({
    where: { sessionId },
    include: { student: true },
    orderBy: { capturedAt: 'asc' },
  });

  res.status(200).json(records);
};

export const listSessions = async (req: Request, res: Response) => {
  const payload = listSessionsSchema.parse(req.query);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const to = payload.dateTo ?? new Date();
  const from = payload.dateFrom ?? new Date(to.getTime() - 6 * 24 * 60 * 60 * 1000);

  const queryFingerprint = buildQueryFingerprint({
    schoolId,
    dateFrom: from.toISOString(),
    dateTo: to.toISOString(),
    approvalStatus: payload.approvalStatus ?? null,
  });
  const { value: sessions, status } = await rememberCache(
    cacheKeys.attendanceSummary(schoolId, queryFingerprint),
    cacheTTL.ATTENDANCE,
    () =>
      prisma.attendanceSession.findMany({
        where: {
          schoolId,
          date: { gte: from, lte: to },
          ...(payload.approvalStatus ? { approvalStatus: payload.approvalStatus } : {}),
        },
        include: {
          period: true,
          startedBy: { select: { id: true, email: true } },
          _count: { select: { records: true } },
        },
        orderBy: { date: 'desc' },
      }),
  );
  setCacheHeader(res, status);

  res.status(200).json(sessions);
};
