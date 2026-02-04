import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { invalidateSchoolCache, invalidateSubscriptionCache } from './cache/cache.invalidation';

export const getSubscription = async (schoolId: string) => {
  return prisma.subscription.findUnique({ where: { schoolId }, include: { plan: true } });
};

const defaultLimits = {
  STARTER: { students: 500, teachers: 50 },
  STANDARD: { students: 2000, teachers: 200 },
  PREMIUM: { students: 10000, teachers: 1000 },
};

const ensurePlanByName = async (name: string) => {
  const plan = await prisma.subscriptionPlanDef.findUnique({ where: { name } });
  if (plan) return plan;
  const limits = defaultLimits[name as keyof typeof defaultLimits] ?? defaultLimits.STANDARD;
  return prisma.subscriptionPlanDef.create({
    data: {
      name,
      status: 'ACTIVE',
      priceCents: 0,
      features: [],
      studentLimit: limits.students,
      teacherLimit: limits.teachers,
    },
  });
};

export const checkSubscriptionStatus = async (schoolId: string): Promise<'ACTIVE' | 'GRACE_PERIOD' | 'SUSPENDED'> => {
  const subscription = await prisma.subscription.findUnique({
    where: { schoolId },
    include: { school: true }
  });
  
  if (!subscription) return 'SUSPENDED';
  
  const now = new Date();
  
  // Check if school is manually suspended
  if (subscription.school.status === 'SUSPENDED') {
    return 'SUSPENDED';
  }
  
  // Check if subscription is expired
  if (subscription.status === 'EXPIRED' || (subscription.nextDueAt && subscription.nextDueAt < now)) {
    return 'SUSPENDED';
  }
  
  // Check if in grace period
  if (subscription.endsAt && subscription.endsAt < now && subscription.nextDueAt && subscription.nextDueAt >= now) {
    return 'GRACE_PERIOD';
  }
  
  return 'ACTIVE';
};

export const upsertSubscription = async (params: {
  schoolId: string;
  planName?: string;
  planId?: string;
  status: string;
  startsAt: Date;
  endsAt?: Date | null;
  billingCycle?: 'MONTHLY' | 'ANNUAL';
  discountPercent?: number;
  graceDays?: number;
  paidAt?: Date | null;
  studentLimit?: number;
  teacherLimit?: number;
}) => {
  let planId = params.planId ?? null;
  let planName = params.planName ?? null;
  if (!planId && planName) {
    const plan = await ensurePlanByName(planName);
    planId = plan.id;
  }
  if (!planName && planId) {
    const plan = await prisma.subscriptionPlanDef.findUnique({ where: { id: planId } });
    planName = plan?.name ?? null;
  }
  const plan = planId ? await prisma.subscriptionPlanDef.findUnique({ where: { id: planId } }) : null;
  const studentLimit = params.studentLimit ?? plan?.studentLimit ?? 0;
  const teacherLimit = params.teacherLimit ?? plan?.teacherLimit ?? 0;
  const billingCycle = params.billingCycle ?? 'MONTHLY';
  const discountPercent =
    params.discountPercent ?? (billingCycle === 'ANNUAL' ? 10 : 0);
  const graceDays = params.graceDays ?? 15;
  const startsAt = params.startsAt ?? new Date();
  const paidAt = params.paidAt ?? startsAt;
  const endsAt =
    params.endsAt ??
    (billingCycle === 'ANNUAL'
      ? new Date(startsAt.getFullYear() + 1, startsAt.getMonth(), startsAt.getDate())
      : new Date(startsAt.getFullYear(), startsAt.getMonth() + 1, startsAt.getDate()));
  const nextDueAt = new Date(endsAt.getTime());
  nextDueAt.setDate(nextDueAt.getDate() + graceDays);

  // Reactivate school if payment is made
  if (params.status === 'ACTIVE') {
    await prisma.school.update({
      where: { id: params.schoolId },
      data: { 
        status: 'ACTIVE',
        statusReason: null
      }
    });
  }

  const subscription = await prisma.subscription.upsert({
    where: { schoolId: params.schoolId },
    update: {
      planName: planName ?? '',
      planId: planId ?? undefined,
      status: params.status,
      startsAt,
      endsAt,
      billingCycle,
      discountPercent,
      graceDays,
      paidAt,
      nextDueAt,
      studentLimit,
      teacherLimit,
    },
    create: {
      schoolId: params.schoolId,
      planName: planName ?? '',
      planId: planId ?? undefined,
      status: params.status,
      startsAt,
      endsAt,
      billingCycle,
      discountPercent,
      graceDays,
      paidAt,
      nextDueAt,
      studentLimit,
      teacherLimit,
    },
  });
  await invalidateSubscriptionCache(params.schoolId);
  await invalidateSchoolCache(params.schoolId);
  return subscription;
};

export const incrementUsage = async (schoolId: string, type: 'students' | 'teachers', delta = 1) => {
  return prisma.usageCounter.upsert({
    where: { schoolId },
    update: { [type]: { increment: delta } },
    create: { schoolId, students: type === 'students' ? delta : 0, teachers: type === 'teachers' ? delta : 0 },
  });
};

export const enforceLimits = async (schoolId: string, type: 'students' | 'teachers') => {
  // Check subscription status first
  const status = await checkSubscriptionStatus(schoolId);
  
  if (status === 'SUSPENDED') {
    throw new HttpError(403, 'School suspended - payment required');
  }
  
  if (status === 'GRACE_PERIOD') {
    throw new HttpError(403, `Cannot add new ${type} - payment overdue. Please update your subscription.`);
  }

  let subscription = await prisma.subscription.findUnique({
    where: { schoolId },
    include: { plan: true },
  });
  
  if (!subscription) {
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (school) {
      const plan = await ensurePlanByName(school.subscriptionPlan);
      await upsertSubscription({
        schoolId,
        planName: plan.name,
        planId: plan.id,
        status: 'ACTIVE',
        startsAt: new Date(),
        billingCycle: 'MONTHLY',
        discountPercent: 0,
        graceDays: 15,
        studentLimit: plan.studentLimit,
        teacherLimit: plan.teacherLimit,
      });
      subscription = await prisma.subscription.findUnique({
        where: { schoolId },
        include: { plan: true },
      });
      await prisma.usageCounter.upsert({
        where: { schoolId },
        update: {},
        create: { schoolId, students: 0, teachers: 0 },
      });
    }
  }
  
  if (!subscription || subscription.status !== 'ACTIVE') {
    throw new HttpError(403, 'Subscription inactive');
  }

  const usage = await prisma.usageCounter.findUnique({ where: { schoolId } });
  const count = usage ? usage[type] : 0;
  const limit = type === 'students' ? subscription.studentLimit : subscription.teacherLimit;

  if (count >= limit) {
    throw new HttpError(403, `${type} limit exceeded`);
  }
};
