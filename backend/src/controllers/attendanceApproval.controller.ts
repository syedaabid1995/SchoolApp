import type { Request, Response } from 'express';
import { z } from 'zod';
import { resolveSchoolId } from '../utils/tenant';
import { HttpError } from '../middlewares/error.middleware';
import { approveAttendanceSession, rejectAttendanceSession } from '../services/attendanceApproval.service';
import { logAudit } from '../utils/audit';
import { invalidateAttendanceCache } from '../services/cache/cache.invalidation';

const approveSchema = z.object({
  schoolId: z.string().uuid().optional(),
});

const rejectSchema = z.object({
  reason: z.string().min(1),
  schoolId: z.string().uuid().optional(),
});

export const approveSession = async (req: Request, res: Response) => {
  const payload = approveSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');

  const session = await approveAttendanceSession(req, {
    schoolId,
    sessionId: req.params.sessionId,
    approvedById: auth.userId,
  });

  await logAudit(req, {
    schoolId,
    entityType: 'ATTENDANCE_SESSION',
    entityId: session.id,
    action: 'APPROVE',
    afterState: { approvalStatus: session.approvalStatus },
  });
  await invalidateAttendanceCache(schoolId);

  res.status(200).json(session);
};

export const rejectSession = async (req: Request, res: Response) => {
  const payload = rejectSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');

  const result = await rejectAttendanceSession(req, {
    schoolId,
    sessionId: req.params.sessionId,
    rejectedById: auth.userId,
    reason: payload.reason,
  });

  await logAudit(req, {
    schoolId,
    entityType: 'ATTENDANCE_SESSION',
    entityId: result.id,
    action: 'REJECT',
    afterState: { approvalStatus: result.approvalStatus, reason: payload.reason },
  });
  await invalidateAttendanceCache(schoolId);

  res.status(200).json(result);
};
