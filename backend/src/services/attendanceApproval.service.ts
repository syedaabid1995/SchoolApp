import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { auditAttendance } from '../middlewares/audit.middleware';
import type { Request } from 'express';

export const approveAttendanceSession = async (req: Request, params: {
  schoolId: string;
  sessionId: string;
  approvedById: string;
}) => {
  const session = await prisma.attendanceSession.findFirst({
    where: { id: params.sessionId, schoolId: params.schoolId },
    include: { records: true },
  });

  if (!session) {
    throw new HttpError(404, 'Attendance session not found');
  }

  if (session.status === 'CLOSED') {
    throw new HttpError(409, 'Attendance session already locked');
  }

  const updated = await prisma.attendanceSession.update({
    where: { id: session.id },
    data: { status: 'CLOSED', approvalStatus: 'APPROVED', approvalReason: null },
  });

  for (const record of session.records) {
    await auditAttendance(req, {
      recordId: record.id,
      action: 'APPROVE',
      previousValue: { status: record.status },
      newValue: { status: record.status, approved: true },
      reason: 'Session approved',
    });
  }

  return updated;
};

export const rejectAttendanceSession = async (req: Request, params: {
  schoolId: string;
  sessionId: string;
  rejectedById: string;
  reason: string;
}) => {
  const session = await prisma.attendanceSession.findFirst({
    where: { id: params.sessionId, schoolId: params.schoolId },
    include: { records: true },
  });

  if (!session) {
    throw new HttpError(404, 'Attendance session not found');
  }

  if (session.status === 'CLOSED') {
    throw new HttpError(409, 'Attendance session already locked');
  }

  const updated = await prisma.attendanceSession.update({
    where: { id: session.id },
    data: { approvalStatus: 'REJECTED', approvalReason: params.reason },
  });

  for (const record of session.records) {
    await auditAttendance(req, {
      recordId: record.id,
      action: 'REJECT',
      previousValue: { status: record.status },
      newValue: { status: record.status, rejected: true },
      reason: params.reason,
    });
  }

  return updated;
};
