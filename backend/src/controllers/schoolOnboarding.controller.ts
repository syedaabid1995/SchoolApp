import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  activateSchoolOnboarding,
  blockSchoolOnboarding,
  getSchoolOnboarding,
  recalculateSchoolOnboarding,
  requestSchoolOnboardingReview,
  updateSchoolOnboardingChecklist,
} from '../services/schoolOnboarding.service';
import { HttpError } from '../middlewares/error.middleware';

const paramsSchema = z.object({ schoolId: z.string().uuid() });
const checklistParamsSchema = z.object({ schoolId: z.string().uuid(), key: z.string().min(1).max(100) });

const checklistSchema = z.object({
  status: z.enum(['PENDING', 'COMPLETED', 'SKIPPED', 'BLOCKED']),
  note: z.string().trim().max(1000).optional().nullable(),
}).required({ status: true });

const reasonSchema = z.object({
  reason: z.string().trim().max(1000).optional().nullable(),
  override: z.boolean().optional(),
});

const requireActor = (req: Request) => {
  if (!req.auth) throw new HttpError(401, 'Unauthorized');
  return { userId: req.auth.userId, role: req.auth.role, schoolId: req.auth.schoolId };
};

export const getSchoolOnboardingApi = async (req: Request, res: Response) => {
  const { schoolId } = paramsSchema.parse(req.params);
  const result = await getSchoolOnboarding(schoolId, requireActor(req));
  res.status(200).json(result);
};

export const updateSchoolOnboardingChecklistApi = async (req: Request, res: Response) => {
  const { schoolId, key } = checklistParamsSchema.parse(req.params);
  const payload = checklistSchema.parse(req.body);
  const result = await updateSchoolOnboardingChecklist(schoolId, key, { status: payload.status, note: payload.note ?? null }, requireActor(req));
  res.status(200).json(result);
};

export const recalculateSchoolOnboardingApi = async (req: Request, res: Response) => {
  const { schoolId } = paramsSchema.parse(req.params);
  const result = await recalculateSchoolOnboarding(schoolId, requireActor(req));
  res.status(200).json(result);
};

export const requestSchoolOnboardingReviewApi = async (req: Request, res: Response) => {
  const { schoolId } = paramsSchema.parse(req.params);
  const result = await requestSchoolOnboardingReview(schoolId, requireActor(req));
  res.status(200).json(result);
};

export const goLiveSchoolOnboardingApi = async (req: Request, res: Response) => {
  const { schoolId } = paramsSchema.parse(req.params);
  const payload = reasonSchema.parse(req.body ?? {});
  const result = await activateSchoolOnboarding(schoolId, requireActor(req), payload.reason ?? null, payload.override ?? false);
  res.status(200).json(result);
};

export const blockSchoolOnboardingApi = async (req: Request, res: Response) => {
  const { schoolId } = paramsSchema.parse(req.params);
  const payload = reasonSchema.extend({ reason: z.string().trim().min(1).max(1000) }).parse(req.body ?? {});
  const result = await blockSchoolOnboarding(schoolId, requireActor(req), payload.reason);
  res.status(200).json(result);
};
