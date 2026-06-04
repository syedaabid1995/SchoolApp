import type { Request, Response } from 'express';
import { z } from 'zod';
import { resolveSchoolId } from '../utils/tenant';
import {
  confirmTeacherCredentialManualShare,
  getTeacherOnboarding,
  listTeacherOnboarding,
  recalculateTeacherOnboarding,
  resendTeacherCredentials,
  updateTeacherOnboarding,
} from '../services/teacherOnboarding.service';
import { HttpError } from '../middlewares/error.middleware';

const teacherParams = z.object({ teacherId: z.string().uuid() });
const listQuery = z.object({ schoolId: z.string().uuid().optional() });
const patchSchema = z.object({
  readinessStatus: z.enum(['PENDING', 'READY', 'BLOCKED']).optional(),
  note: z.string().trim().max(1000).optional().nullable(),
});
const manualShareSchema = z.object({ note: z.string().trim().min(1).max(1000) });

const actor = (req: Request) => {
  if (!req.auth) throw new HttpError(401, 'Unauthorized');
  return { userId: req.auth.userId, role: req.auth.role, schoolId: req.auth.schoolId };
};

const scopedSchoolId = (req: Request) => resolveSchoolId(req, (req.body?.schoolId as string | undefined) ?? (req.query.schoolId as string | undefined));

export const listTeacherOnboardingApi = async (req: Request, res: Response) => {
  const query = listQuery.parse(req.query);
  const schoolId = resolveSchoolId(req, query.schoolId);
  const result = await listTeacherOnboarding(schoolId, actor(req));
  res.status(200).json(result);
};

export const getTeacherOnboardingApi = async (req: Request, res: Response) => {
  const { teacherId } = teacherParams.parse(req.params);
  const result = await getTeacherOnboarding(scopedSchoolId(req), teacherId, actor(req));
  res.status(200).json(result);
};

export const recalculateTeacherOnboardingApi = async (req: Request, res: Response) => {
  const { teacherId } = teacherParams.parse(req.params);
  const result = await recalculateTeacherOnboarding(scopedSchoolId(req), teacherId, actor(req));
  res.status(200).json(result);
};

export const updateTeacherOnboardingApi = async (req: Request, res: Response) => {
  const { teacherId } = teacherParams.parse(req.params);
  const payload = patchSchema.parse(req.body);
  const result = await updateTeacherOnboarding(scopedSchoolId(req), teacherId, payload, actor(req));
  res.status(200).json(result);
};

export const resendTeacherCredentialsApi = async (req: Request, res: Response) => {
  const { teacherId } = teacherParams.parse(req.params);
  const result = await resendTeacherCredentials(scopedSchoolId(req), teacherId, actor(req));
  res.status(200).json(result);
};

export const confirmTeacherCredentialManualShareApi = async (req: Request, res: Response) => {
  const { teacherId } = teacherParams.parse(req.params);
  const payload = manualShareSchema.parse(req.body);
  const result = await confirmTeacherCredentialManualShare(scopedSchoolId(req), teacherId, payload.note, actor(req));
  res.status(200).json(result);
};
