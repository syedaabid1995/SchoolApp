import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';

const createSchema = z.object({
  name: z.string().min(1),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  priceCents: z.number().int().min(0).default(0),
  features: z.array(z.string().min(1)).default([]),
  studentLimit: z.number().int().min(1),
  teacherLimit: z.number().int().min(1),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  priceCents: z.number().int().min(0).optional(),
  features: z.array(z.string().min(1)).optional(),
  studentLimit: z.number().int().min(1).optional(),
  teacherLimit: z.number().int().min(1).optional(),
});

export const listSubscriptionPlansApi = async (_req: Request, res: Response) => {
  const plans = await prisma.subscriptionPlanDef.findMany({
    orderBy: { studentLimit: 'asc' },
  });
  res.status(200).json(plans);
};

export const listActivePlansApi = async (_req: Request, res: Response) => {
  const plans = await prisma.subscriptionPlanDef.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { studentLimit: 'asc' },
  });
  res.status(200).json(plans);
};

export const createSubscriptionPlanApi = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const existing = await prisma.subscriptionPlanDef.findUnique({ where: { name: payload.name } });
  if (existing) {
    throw new HttpError(409, 'Plan name already exists');
  }
  const plan = await prisma.subscriptionPlanDef.create({ data: payload });
  res.status(201).json(plan);
};

export const updateSubscriptionPlanApi = async (req: Request, res: Response) => {
  const payload = updateSchema.parse(req.body);
  const { id } = req.params;
  const existing = await prisma.subscriptionPlanDef.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, 'Plan not found');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const plan = await tx.subscriptionPlanDef.update({
      where: { id },
      data: payload,
    });

    if (payload.name && payload.name !== existing.name) {
      await tx.subscription.updateMany({
        where: { planId: id },
        data: { planName: payload.name },
      });
      await tx.school.updateMany({
        where: { subscriptionPlan: existing.name },
        data: { subscriptionPlan: payload.name },
      });
    }

    if (payload.studentLimit || payload.teacherLimit) {
      await tx.subscription.updateMany({
        where: { planId: id },
        data: {
          studentLimit: payload.studentLimit ?? plan.studentLimit,
          teacherLimit: payload.teacherLimit ?? plan.teacherLimit,
        },
      });
    }

    return plan;
  });

  res.status(200).json(updated);
};

export const deleteSubscriptionPlanApi = async (req: Request, res: Response) => {
  const { id } = req.params;
  const usage = await prisma.subscription.count({ where: { planId: id } });
  if (usage > 0) {
    throw new HttpError(409, 'Plan is in use by existing subscriptions');
  }
  const plan = await prisma.subscriptionPlanDef.delete({ where: { id } });
  res.status(200).json(plan);
};

export const listPlanSchoolsApi = async (req: Request, res: Response) => {
  const { id } = req.params;
  const subscriptions = await prisma.subscription.findMany({
    where: { planId: id },
    include: {
      school: true,
    },
  });
  const schools = subscriptions
    .filter((item) => item.school.deletedAt === null)
    .map((item) => ({
      id: item.school.id,
      name: item.school.name,
      code: item.school.code,
      status: item.school.status,
      subscriptionPlan: item.planName,
    }));
  res.status(200).json({ items: schools });
};
