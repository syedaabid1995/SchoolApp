import type { Request, Response } from 'express';
import { z } from 'zod';
import { upsertSubscription, getSubscription } from '../services/subscription.service';
import { resolveSchoolId } from '../utils/tenant';

const upsertSchema = z.object({
  planId: z.string().uuid().optional(),
  planName: z.string().min(1).optional(),
  status: z.string().min(1),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional().nullable(),
  billingCycle: z.enum(['MONTHLY', 'ANNUAL']).optional(),
  discountPercent: z.number().int().min(0).max(100).optional(),
  graceDays: z.number().int().min(0).optional(),
  paidAt: z.coerce.date().optional().nullable(),
  studentLimit: z.number().int().min(1).optional(),
  teacherLimit: z.number().int().min(1).optional(),
  schoolId: z.string().uuid().optional(),
});

export const upsertSubscriptionApi = async (req: Request, res: Response) => {
  const payload = upsertSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const subscription = await upsertSubscription({
    schoolId,
    planName: payload.planName,
    planId: payload.planId,
    status: payload.status,
    startsAt: payload.startsAt,
    endsAt: payload.endsAt ?? null,
    billingCycle: payload.billingCycle,
    discountPercent: payload.discountPercent,
    graceDays: payload.graceDays,
    paidAt: payload.paidAt ?? null,
    studentLimit: payload.studentLimit,
    teacherLimit: payload.teacherLimit,
  });

  res.status(200).json(subscription);
};

export const getSubscriptionApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const subscription = await getSubscription(schoolId);
  res.status(200).json(subscription);
};
