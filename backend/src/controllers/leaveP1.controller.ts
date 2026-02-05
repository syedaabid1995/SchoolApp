import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { createLeaveRequest, listLeaveRequests, reviewLeaveRequest } from '../services/attendanceP1.service';

const createLeaveSchema = z.object({
  schoolId: z.string().uuid().optional(),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  reason: z.string().trim().min(3),
});

const leaveListSchema = z.object({
  schoolId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

const reviewLeaveSchema = z.object({
  schoolId: z.string().uuid().optional(),
  reason: z.string().trim().optional(),
});

const requireAuth = (req: Request) => {
  if (!req.auth) throw new HttpError(401, 'Unauthorized');
  return req.auth;
};

const ensureLeaveEnabled = () => {
  if (!env.ATTENDANCE_ENABLED || !env.LEAVE_BASIC_ENABLED) {
    throw new HttpError(503, 'Leave module is disabled');
  }
};

export const createLeaveRequestApi = async (req: Request, res: Response) => {
  ensureLeaveEnabled();
  const auth = requireAuth(req);
  const payload = createLeaveSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const request = await createLeaveRequest({
    schoolId,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
    fromDate: payload.fromDate,
    toDate: payload.toDate,
    reason: payload.reason,
  });

  res.status(201).json(request);
};

export const listLeaveRequestsApi = async (req: Request, res: Response) => {
  ensureLeaveEnabled();
  const auth = requireAuth(req);
  const payload = leaveListSchema.parse(req.query);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const requests = await listLeaveRequests({
    schoolId,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
    status: payload.status,
  });

  res.status(200).json(requests);
};

export const approveLeaveRequestApi = async (req: Request, res: Response) => {
  ensureLeaveEnabled();
  const auth = requireAuth(req);
  const payload = reviewLeaveSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const request = await reviewLeaveRequest({
    schoolId,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
    leaveId: req.params.id,
    status: 'APPROVED',
    reason: payload.reason,
  });

  res.status(200).json(request);
};

export const rejectLeaveRequestApi = async (req: Request, res: Response) => {
  ensureLeaveEnabled();
  const auth = requireAuth(req);
  const payload = reviewLeaveSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const request = await reviewLeaveRequest({
    schoolId,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
    leaveId: req.params.id,
    status: 'REJECTED',
    reason: payload.reason,
  });

  res.status(200).json(request);
};
