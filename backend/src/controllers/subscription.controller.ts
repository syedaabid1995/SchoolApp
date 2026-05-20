import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  assignSchoolSubscriptionPlan,
  cancelSchoolSubscription,
  downgradeSchoolSubscription,
  extendSchoolSubscriptionTrial,
  getAdminSchoolSubscriptionDetail,
  getAdminSubscriptionHistory,
  getAdminSubscriptionInvoices,
  getAdminSubscriptionSummary,
  getAdminSubscriptionUsage,
  getSubscription,
  listAdminSchoolSubscriptions,
  overrideSchoolSubscriptionLimits,
  pauseSchoolSubscription,
  recordSchoolSubscriptionManualPayment,
  renewSchoolSubscription,
  resumeSchoolSubscription,
  startSchoolSubscriptionTrial,
  upgradeSchoolSubscription,
  upsertSubscription,
} from '../services/subscription.service';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { cacheKeys } from '../services/cache/cache.keys';
import { rememberCache, setCacheHeader } from '../services/cache/cache.service';
import { cacheTTL } from '../services/cache/cache.ttl';
import { invalidateSubscriptionCache, invalidateSchoolCache } from '../services/cache/cache.invalidation';

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

const schoolIdParamsSchema = z.object({
  schoolId: z.string().uuid(),
});

const adminListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  status: z.string().trim().min(1).max(40).optional(),
  planId: z.string().uuid().optional(),
  schoolId: z.string().uuid().optional(),
  billingCycle: z.string().trim().min(1).max(40).optional(),
  trial: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((value) => (typeof value === 'string' ? value === 'true' : value)),
  overdue: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((value) => (typeof value === 'string' ? value === 'true' : value)),
  sortBy: z.enum(['schoolName', 'planName', 'status', 'currentPeriodEnd', 'updatedAt']).default('schoolName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

const reasonSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional().nullable(),
});

const assignPlanSchema = reasonSchema.extend({
  planId: z.string().uuid(),
  billingCycle: z.enum(['MONTHLY', 'ANNUAL', 'QUARTERLY', 'YEARLY']).default('MONTHLY'),
  startDate: z.coerce.date().optional(),
  trialDays: z.number().int().min(0).max(365).default(0),
});

const startTrialSchema = reasonSchema.extend({
  planId: z.string().uuid(),
  trialDays: z.number().int().min(1).max(365),
});

const extendTrialSchema = reasonSchema.extend({
  extraDays: z.number().int().min(1).max(365),
});

const changePlanSchema = reasonSchema.extend({
  newPlanId: z.string().uuid(),
  effectiveDate: z.enum(['IMMEDIATE', 'NEXT_BILLING_CYCLE']).default('IMMEDIATE'),
  force: z.boolean().optional(),
});

const cancelSchema = reasonSchema.extend({
  cancelAt: z.enum(['IMMEDIATE', 'PERIOD_END']).default('IMMEDIATE'),
});

const renewSchema = reasonSchema.extend({
  periodMonths: z.number().int().min(1).max(60).default(1),
});

const limitsSchema = reasonSchema.extend({
  studentLimit: z.number().int().min(1).optional(),
  teacherLimit: z.number().int().min(1).optional(),
  storageLimitMb: z.number().int().min(1).optional(),
});

const manualPaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().trim().min(3).max(3).default('INR'),
  method: z.string().trim().min(1).max(60),
  reference: z.string().trim().max(120).optional().nullable(),
  paidAt: z.coerce.date(),
  notes: z.string().trim().max(500).optional().nullable(),
});

const actorFromRequest = (req: Request) => {
  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }
  return {
    userId: req.auth.userId,
    role: req.auth.role ?? 'SUPER_ADMIN',
  };
};

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
  await invalidateSubscriptionCache(schoolId);
  await invalidateSchoolCache(schoolId);

  res.status(200).json(subscription);
};

export const getSubscriptionApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { value: subscription, status } = await rememberCache(
    cacheKeys.subscriptionBySchool(schoolId),
    cacheTTL.SUBSCRIPTION,
    () => getSubscription(schoolId),
  );
  setCacheHeader(res, status);
  res.status(200).json(subscription);
};

export const getSubscriptionUsageApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const data = await getAdminSubscriptionUsage(schoolId);
  res.status(200).json({ success: true, data });
};

export const getSubscriptionInvoicesApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const data = await getAdminSubscriptionInvoices(schoolId);
  res.status(200).json({ success: true, data });
};

export const getAdminSubscriptionSummaryApi = async (_req: Request, res: Response) => {
  const data = await getAdminSubscriptionSummary();
  res.status(200).json({ success: true, data });
};

export const listAdminSchoolSubscriptionsApi = async (req: Request, res: Response) => {
  const payload = adminListSchema.parse(req.query);
  const data = await listAdminSchoolSubscriptions({
    page: payload.page,
    limit: payload.limit,
    search: payload.search,
    status: payload.status,
    planId: payload.planId,
    schoolId: payload.schoolId,
    billingCycle: payload.billingCycle,
    trial: payload.trial,
    overdue: payload.overdue,
    sortBy: payload.sortBy,
    sortOrder: payload.sortOrder,
  });
  res.status(200).json({ success: true, data });
};

export const getAdminSchoolSubscriptionDetailApi = async (req: Request, res: Response) => {
  const { schoolId } = schoolIdParamsSchema.parse(req.params);
  const data = await getAdminSchoolSubscriptionDetail(schoolId);
  res.status(200).json({ success: true, data });
};

export const assignSchoolSubscriptionPlanApi = async (req: Request, res: Response) => {
  const { schoolId } = schoolIdParamsSchema.parse(req.params);
  const payload = assignPlanSchema.parse(req.body);
  const data = await assignSchoolSubscriptionPlan({
    schoolId,
    planId: payload.planId,
    billingCycle: payload.billingCycle,
    startDate: payload.startDate,
    trialDays: payload.trialDays,
    reason: payload.reason ?? null,
    actor: actorFromRequest(req),
  });
  res.status(200).json({ success: true, data });
};

export const startSchoolSubscriptionTrialApi = async (req: Request, res: Response) => {
  const { schoolId } = schoolIdParamsSchema.parse(req.params);
  const payload = startTrialSchema.parse(req.body);
  const data = await startSchoolSubscriptionTrial({
    schoolId,
    planId: payload.planId,
    trialDays: payload.trialDays,
    reason: payload.reason ?? null,
    actor: actorFromRequest(req),
  });
  res.status(200).json({ success: true, data });
};

export const extendSchoolSubscriptionTrialApi = async (req: Request, res: Response) => {
  const { schoolId } = schoolIdParamsSchema.parse(req.params);
  const payload = extendTrialSchema.parse(req.body);
  const data = await extendSchoolSubscriptionTrial({
    schoolId,
    extraDays: payload.extraDays,
    reason: payload.reason ?? null,
    actor: actorFromRequest(req),
  });
  res.status(200).json({ success: true, data });
};

export const upgradeSchoolSubscriptionApi = async (req: Request, res: Response) => {
  const { schoolId } = schoolIdParamsSchema.parse(req.params);
  const payload = changePlanSchema.parse(req.body);
  const data = await upgradeSchoolSubscription({
    schoolId,
    newPlanId: payload.newPlanId,
    effectiveDate: payload.effectiveDate,
    reason: payload.reason ?? null,
    actor: actorFromRequest(req),
  });
  res.status(200).json({ success: true, data });
};

export const downgradeSchoolSubscriptionApi = async (req: Request, res: Response) => {
  const { schoolId } = schoolIdParamsSchema.parse(req.params);
  const payload = changePlanSchema.parse(req.body);
  const data = await downgradeSchoolSubscription({
    schoolId,
    newPlanId: payload.newPlanId,
    effectiveDate: payload.effectiveDate,
    force: payload.force ?? false,
    reason: payload.reason ?? null,
    actor: actorFromRequest(req),
  });
  res.status(200).json({ success: true, data });
};

export const pauseSchoolSubscriptionApi = async (req: Request, res: Response) => {
  const { schoolId } = schoolIdParamsSchema.parse(req.params);
  const payload = reasonSchema.parse(req.body);
  const data = await pauseSchoolSubscription({ schoolId, reason: payload.reason ?? null, actor: actorFromRequest(req) });
  res.status(200).json({ success: true, data });
};

export const resumeSchoolSubscriptionApi = async (req: Request, res: Response) => {
  const { schoolId } = schoolIdParamsSchema.parse(req.params);
  const payload = reasonSchema.parse(req.body);
  const data = await resumeSchoolSubscription({ schoolId, reason: payload.reason ?? null, actor: actorFromRequest(req) });
  res.status(200).json({ success: true, data });
};

export const cancelSchoolSubscriptionApi = async (req: Request, res: Response) => {
  const { schoolId } = schoolIdParamsSchema.parse(req.params);
  const payload = cancelSchema.parse(req.body);
  const data = await cancelSchoolSubscription({
    schoolId,
    cancelAt: payload.cancelAt,
    reason: payload.reason ?? null,
    actor: actorFromRequest(req),
  });
  res.status(200).json({ success: true, data });
};

export const renewSchoolSubscriptionApi = async (req: Request, res: Response) => {
  const { schoolId } = schoolIdParamsSchema.parse(req.params);
  const payload = renewSchema.parse(req.body);
  const data = await renewSchoolSubscription({
    schoolId,
    periodMonths: payload.periodMonths,
    reason: payload.reason ?? null,
    actor: actorFromRequest(req),
  });
  res.status(200).json({ success: true, data });
};

export const overrideSchoolSubscriptionLimitsApi = async (req: Request, res: Response) => {
  const { schoolId } = schoolIdParamsSchema.parse(req.params);
  const payload = limitsSchema.parse(req.body);
  const data = await overrideSchoolSubscriptionLimits({
    schoolId,
    studentLimit: payload.studentLimit,
    teacherLimit: payload.teacherLimit,
    storageLimitMb: payload.storageLimitMb,
    reason: payload.reason ?? null,
    actor: actorFromRequest(req),
  });
  res.status(200).json({ success: true, data });
};

export const getAdminSubscriptionUsageApi = async (req: Request, res: Response) => {
  const { schoolId } = schoolIdParamsSchema.parse(req.params);
  const data = await getAdminSubscriptionUsage(schoolId);
  res.status(200).json({ success: true, data });
};

export const getAdminSubscriptionHistoryApi = async (req: Request, res: Response) => {
  const { schoolId } = schoolIdParamsSchema.parse(req.params);
  const data = await getAdminSubscriptionHistory(schoolId);
  res.status(200).json({ success: true, data });
};

export const getAdminSubscriptionInvoicesApi = async (req: Request, res: Response) => {
  const { schoolId } = schoolIdParamsSchema.parse(req.params);
  const data = await getAdminSubscriptionInvoices(schoolId);
  res.status(200).json({ success: true, data });
};

export const recordSchoolSubscriptionManualPaymentApi = async (req: Request, res: Response) => {
  const { schoolId } = schoolIdParamsSchema.parse(req.params);
  const payload = manualPaymentSchema.parse(req.body);
  const data = await recordSchoolSubscriptionManualPayment({
    schoolId,
    amount: payload.amount,
    currency: payload.currency,
    method: payload.method,
    reference: payload.reference ?? null,
    paidAt: payload.paidAt,
    notes: payload.notes ?? null,
    actor: actorFromRequest(req),
  });
  res.status(200).json({ success: true, data });
};
