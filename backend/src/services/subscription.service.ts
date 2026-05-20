import { prisma } from '../config/db';
import type { Prisma } from '@prisma/client';
import { HttpError } from '../middlewares/error.middleware';
import { invalidateSchoolCache, invalidateSubscriptionCache } from './cache/cache.invalidation';
import { createAuditLog } from './auditLog.service';

type BillingCycleInput = 'MONTHLY' | 'ANNUAL' | 'QUARTERLY' | 'YEARLY';
type EffectiveDateInput = 'IMMEDIATE' | 'NEXT_BILLING_CYCLE';
type CancelMode = 'IMMEDIATE' | 'PERIOD_END';

type SubscriptionActor = {
  userId: string;
  role?: string | null;
};

type SubscriptionListParams = {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  planId?: string;
  schoolId?: string;
  billingCycle?: string;
  trial?: boolean;
  overdue?: boolean;
  sortBy?: 'schoolName' | 'planName' | 'status' | 'currentPeriodEnd' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
};

export const getSubscription = async (schoolId: string) => {
  return prisma.subscription.findUnique({ where: { schoolId }, include: { plan: true } });
};

const defaultLimits = {
  STARTER: { students: 500, teachers: 50 },
  STANDARD: { students: 2000, teachers: 200 },
  PREMIUM: { students: 10000, teachers: 1000 },
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
};

const addMonths = (date: Date, months: number) => {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
};

const periodMonths = (billingCycle?: string) => {
  if (billingCycle === 'ANNUAL' || billingCycle === 'YEARLY') return 12;
  if (billingCycle === 'QUARTERLY') return 3;
  return 1;
};

const calculatePeriodEnd = (start: Date, billingCycle?: string) => addMonths(start, periodMonths(billingCycle));

const safeCurrency = 'INR';

const priceFromPlan = (plan?: { priceCents: number } | null) => (plan?.priceCents ?? 0) / 100;

const requireSchool = async (schoolId: string) => {
  const school = await prisma.school.findFirst({
    where: { id: schoolId, deletedAt: null },
    select: { id: true, name: true, code: true, status: true },
  });
  if (!school) {
    throw new HttpError(404, 'School not found');
  }
  return school;
};

const requirePlan = async (planId: string, options?: { allowInactive?: boolean }) => {
  const plan = await prisma.subscriptionPlanDef.findUnique({ where: { id: planId } });
  if (!plan) {
    throw new HttpError(404, 'Subscription plan not found');
  }
  if (!options?.allowInactive && plan.status !== 'ACTIVE') {
    throw new HttpError(400, 'Subscription plan is not active');
  }
  return plan;
};

const auditSubscriptionAction = async (params: {
  schoolId: string;
  subscriptionId?: string | null;
  actor: SubscriptionActor;
  action: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
}) => {
  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actor.userId,
    actorRole: params.actor.role ?? 'SUPER_ADMIN',
    entityType: 'SUBSCRIPTION',
    entityId: params.subscriptionId ?? params.schoolId,
    action: params.action,
    beforeState: (params.beforeState as Prisma.InputJsonObject | null) ?? null,
    afterState: (params.afterState as Prisma.InputJsonObject | null) ?? null,
  });
};

type SchoolSubscriptionRecord = Prisma.SchoolGetPayload<{
  include: {
    subscription: { include: { plan: true } };
    usageCounter: true;
  };
}>;

const mapSubscriptionListItem = (school: SchoolSubscriptionRecord) => {
  const subscription = school.subscription;
  const plan = subscription?.plan ?? null;
  const usage = school.usageCounter;
  return {
    schoolId: school.id,
    schoolName: school.name,
    schoolCode: school.code,
    schoolStatus: school.status,
    subscriptionId: subscription?.id ?? null,
    planId: subscription?.planId ?? null,
    planName: subscription?.planName ?? null,
    status: subscription?.status ?? 'PENDING',
    billingCycle: subscription?.billingCycle ?? 'MONTHLY',
    trialEndsAt: subscription?.status === 'TRIAL' ? subscription.endsAt : null,
    currentPeriodStart: subscription?.startsAt ?? null,
    currentPeriodEnd: subscription?.endsAt ?? null,
    cancelAt: null,
    cancelledAt: null,
    pausedAt: null,
    price: priceFromPlan(plan),
    currency: safeCurrency,
    studentLimit: subscription?.studentLimit ?? plan?.studentLimit ?? null,
    teacherLimit: subscription?.teacherLimit ?? plan?.teacherLimit ?? null,
    storageLimitMb: null,
    usage: {
      students: usage?.students ?? 0,
      teachers: usage?.teachers ?? 0,
      storageMb: 0,
    },
    createdAt: subscription?.createdAt ?? school.createdAt,
    updatedAt: subscription?.updatedAt ?? school.updatedAt,
  };
};

const getSchoolsForSubscriptionList = (params?: {
  where?: Parameters<typeof prisma.school.findMany>[0]['where'];
  orderBy?: Parameters<typeof prisma.school.findMany>[0]['orderBy'];
  skip?: number;
  take?: number;
}) =>
  prisma.school.findMany({
    where: params?.where,
    orderBy: params?.orderBy,
    skip: params?.skip,
    take: params?.take,
    include: {
      subscription: { include: { plan: true } },
      usageCounter: true,
    },
  });

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

export const getAdminSubscriptionSummary = async () => {
  const now = new Date();
  const [
    totalSchools,
    activeSubscriptions,
    trialSubscriptions,
    pausedSubscriptions,
    cancelledSubscriptions,
    expiredSubscriptions,
    overdueSubscriptions,
    revenueRows,
  ] = await Promise.all([
    prisma.school.count({ where: { deletedAt: null } }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { status: 'TRIAL' } }),
    prisma.subscription.count({ where: { status: 'PAUSED' } }),
    prisma.subscription.count({ where: { status: 'CANCELLED' } }),
    prisma.subscription.count({ where: { OR: [{ status: 'EXPIRED' }, { endsAt: { lt: now } }] } }),
    prisma.subscription.count({
      where: {
        nextDueAt: { lt: now },
        status: { notIn: ['CANCELLED', 'PAUSED'] },
      },
    }),
    prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      select: { plan: { select: { priceCents: true } } },
    }),
  ]);

  const estimatedMonthlyRevenue = revenueRows.reduce((total, item) => total + priceFromPlan(item.plan), 0);

  return {
    totalSchools,
    activeSubscriptions,
    trialSubscriptions,
    pausedSubscriptions,
    cancelledSubscriptions,
    expiredSubscriptions,
    overdueSubscriptions,
    estimatedMonthlyRevenue,
    pendingManualPayments: 0,
    currency: safeCurrency,
  };
};

export const listAdminSchoolSubscriptions = async (params: SubscriptionListParams) => {
  const now = new Date();
  const page = Math.max(1, params.page);
  const limit = Math.min(Math.max(1, params.limit), 100);
  const skip = (page - 1) * limit;
  const search = params.search?.trim();
  const subscriptionWhere: Prisma.SubscriptionWhereInput = {};
  if (params.status) subscriptionWhere.status = params.status;
  if (params.planId) subscriptionWhere.planId = params.planId;
  if (params.billingCycle) subscriptionWhere.billingCycle = params.billingCycle;
  if (typeof params.trial === 'boolean') {
    subscriptionWhere.status = params.trial ? 'TRIAL' : { not: 'TRIAL' };
  }
  if (typeof params.overdue === 'boolean') {
    if (params.overdue) {
      subscriptionWhere.nextDueAt = { lt: now };
      subscriptionWhere.status = { notIn: ['CANCELLED', 'PAUSED'] };
    } else {
      subscriptionWhere.OR = [
        { nextDueAt: null },
        { nextDueAt: { gte: now } },
        { status: { in: ['CANCELLED', 'PAUSED'] } },
      ];
    }
  }
  const hasSubscriptionFilters = Object.keys(subscriptionWhere).length > 0;

  const where: Prisma.SchoolWhereInput = {
    deletedAt: null,
    ...(params.schoolId ? { id: params.schoolId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { subscription: { is: { planName: { contains: search, mode: 'insensitive' } } } },
          ],
        }
      : {}),
    ...(hasSubscriptionFilters ? { subscription: { is: subscriptionWhere } } : {}),
  };

  const orderBy: Prisma.SchoolOrderByWithRelationInput =
    params.sortBy === 'schoolName'
      ? { name: params.sortOrder ?? 'asc' }
      : params.sortBy === 'updatedAt'
        ? { updatedAt: params.sortOrder ?? 'desc' }
        : { name: 'asc' };

  const [schools, total] = await Promise.all([
    getSchoolsForSubscriptionList({ where, orderBy, skip, take: limit }),
    prisma.school.count({ where }),
  ]);

  return {
    items: schools.map(mapSubscriptionListItem),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

export const getAdminSubscriptionUsage = async (schoolId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { schoolId },
    include: { plan: true },
  });
  const [students, teachers, modules] = await Promise.all([
    prisma.student.count({ where: { schoolId, status: 'ENROLLED' } }),
    prisma.teacherProfile.count({ where: { schoolId, isActive: true } }),
    subscription?.planId
      ? prisma.subscriptionPlanPermission.findMany({
          where: { planId: subscription.planId },
          select: { permissionCode: true, enabled: true },
          orderBy: { permissionCode: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  const studentLimit = subscription?.studentLimit ?? subscription?.plan?.studentLimit ?? 0;
  const teacherLimit = subscription?.teacherLimit ?? subscription?.plan?.teacherLimit ?? 0;

  await prisma.usageCounter.upsert({
    where: { schoolId },
    update: { students, teachers },
    create: { schoolId, students, teachers },
  });

  const percentage = (used: number, limit: number) => (limit > 0 ? Number(((used / limit) * 100).toFixed(2)) : 0);

  return {
    students: {
      used: students,
      limit: studentLimit,
      percentage: percentage(students, studentLimit),
    },
    teachers: {
      used: teachers,
      limit: teacherLimit,
      percentage: percentage(teachers, teacherLimit),
    },
    storage: {
      usedMb: 0,
      limitMb: null,
      percentage: null,
    },
    modules: modules.map((module) => ({
      key: module.permissionCode,
      enabled: module.enabled,
    })),
  };
};

export const getAdminSubscriptionHistory = async (schoolId: string) => {
  await requireSchool(schoolId);
  const logs = await prisma.auditLog.findMany({
    where: { schoolId, entityType: 'SUBSCRIPTION' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      action: true,
      beforeState: true,
      afterState: true,
      createdAt: true,
      actor: { select: { email: true } },
    },
  });

  return {
    items: logs.map((log) => ({
      id: log.id,
      action: log.action,
      oldValue: log.beforeState,
      newValue: log.afterState,
      reason:
        log.afterState && typeof log.afterState === 'object' && !Array.isArray(log.afterState)
          ? (log.afterState as Record<string, unknown>).reason ?? null
          : null,
      actorName: log.actor.email,
      createdAt: log.createdAt,
    })),
  };
};

export const getAdminSubscriptionInvoices = async (schoolId: string) => {
  await requireSchool(schoolId);
  return {
    items: [],
    total: 0,
    message: 'Billing records are not implemented yet. Manual payment notes are stored in audit history only.',
  };
};

export const getAdminSchoolSubscriptionDetail = async (schoolId: string) => {
  const school = await requireSchool(schoolId);
  const subscription = await prisma.subscription.findUnique({
    where: { schoolId },
    include: { plan: true },
  });
  const [usage, history, invoices] = await Promise.all([
    getAdminSubscriptionUsage(schoolId),
    getAdminSubscriptionHistory(schoolId),
    getAdminSubscriptionInvoices(schoolId),
  ]);

  return {
    school,
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          plan: subscription.plan
            ? {
                id: subscription.plan.id,
                name: subscription.plan.name,
                price: priceFromPlan(subscription.plan),
                currency: safeCurrency,
                billingCycle: subscription.billingCycle,
                features: subscription.plan.features,
              }
            : null,
          trialStartedAt: subscription.status === 'TRIAL' ? subscription.startsAt : null,
          trialEndsAt: subscription.status === 'TRIAL' ? subscription.endsAt : null,
          currentPeriodStart: subscription.startsAt,
          currentPeriodEnd: subscription.endsAt,
          pausedAt: null,
          cancelledAt: null,
          cancelAt: null,
          limits: {
            students: subscription.studentLimit,
            teachers: subscription.teacherLimit,
            storageMb: null,
          },
          usage: {
            students: usage.students.used,
            teachers: usage.teachers.used,
            storageMb: usage.storage.usedMb,
          },
        }
      : null,
    history: history.items,
    invoices: invoices.items,
    manualPayments: [],
    billingMessage: invoices.message,
  };
};

const writeSubscription = async (params: {
  schoolId: string;
  planId?: string;
  status: string;
  billingCycle?: BillingCycleInput;
  startsAt?: Date;
  endsAt?: Date | null;
  paidAt?: Date | null;
  studentLimit?: number;
  teacherLimit?: number;
}) => {
  const plan = params.planId ? await requirePlan(params.planId, { allowInactive: true }) : null;
  const startsAt = params.startsAt ?? new Date();
  const endsAt = params.endsAt === undefined ? calculatePeriodEnd(startsAt, params.billingCycle) : params.endsAt;
  const graceDays = 15;
  const nextDueAt = endsAt ? addDays(endsAt, graceDays) : null;

  return prisma.subscription.upsert({
    where: { schoolId: params.schoolId },
    update: {
      planId: params.planId ?? undefined,
      planName: plan?.name ?? undefined,
      status: params.status,
      startsAt,
      endsAt,
      billingCycle: params.billingCycle ?? 'MONTHLY',
      graceDays,
      paidAt: params.paidAt ?? undefined,
      nextDueAt,
      studentLimit: params.studentLimit ?? plan?.studentLimit ?? undefined,
      teacherLimit: params.teacherLimit ?? plan?.teacherLimit ?? undefined,
    },
    create: {
      schoolId: params.schoolId,
      planId: params.planId,
      planName: plan?.name ?? 'Unassigned',
      status: params.status,
      startsAt,
      endsAt,
      billingCycle: params.billingCycle ?? 'MONTHLY',
      discountPercent: params.billingCycle === 'ANNUAL' || params.billingCycle === 'YEARLY' ? 10 : 0,
      graceDays,
      paidAt: params.paidAt ?? null,
      nextDueAt,
      studentLimit: params.studentLimit ?? plan?.studentLimit ?? 0,
      teacherLimit: params.teacherLimit ?? plan?.teacherLimit ?? 0,
    },
  });
};

export const assignSchoolSubscriptionPlan = async (params: {
  schoolId: string;
  planId: string;
  billingCycle?: BillingCycleInput;
  startDate?: Date;
  trialDays?: number;
  reason?: string | null;
  actor: SubscriptionActor;
}) => {
  await requireSchool(params.schoolId);
  const plan = await requirePlan(params.planId);
  const existing = await prisma.subscription.findUnique({ where: { schoolId: params.schoolId } });
  const startsAt = params.startDate ?? new Date();
  const trialDays = params.trialDays ?? 0;
  const status = trialDays > 0 ? 'TRIAL' : 'ACTIVE';
  const endsAt = trialDays > 0 ? addDays(startsAt, trialDays) : calculatePeriodEnd(startsAt, params.billingCycle);
  const subscription = await writeSubscription({
    schoolId: params.schoolId,
    planId: plan.id,
    status,
    billingCycle: params.billingCycle,
    startsAt,
    endsAt,
    studentLimit: plan.studentLimit,
    teacherLimit: plan.teacherLimit,
  });
  await auditSubscriptionAction({
    schoolId: params.schoolId,
    subscriptionId: subscription.id,
    actor: params.actor,
    action: 'SUBSCRIPTION_PLAN_ASSIGNED',
    beforeState: existing
      ? { planId: existing.planId, planName: existing.planName, status: existing.status }
      : null,
    afterState: { planId: plan.id, planName: plan.name, status, trialDays, reason: params.reason ?? null },
  });
  await invalidateSubscriptionCache(params.schoolId);
  await invalidateSchoolCache(params.schoolId);
  return getAdminSchoolSubscriptionDetail(params.schoolId);
};

export const startSchoolSubscriptionTrial = async (params: {
  schoolId: string;
  planId: string;
  trialDays: number;
  reason?: string | null;
  actor: SubscriptionActor;
}) => {
  if (params.trialDays < 1 || params.trialDays > 365) {
    throw new HttpError(400, 'Trial days must be between 1 and 365');
  }
  await requireSchool(params.schoolId);
  const plan = await requirePlan(params.planId);
  const existing = await prisma.subscription.findUnique({ where: { schoolId: params.schoolId } });
  const startsAt = new Date();
  const subscription = await writeSubscription({
    schoolId: params.schoolId,
    planId: plan.id,
    status: 'TRIAL',
    startsAt,
    endsAt: addDays(startsAt, params.trialDays),
    studentLimit: plan.studentLimit,
    teacherLimit: plan.teacherLimit,
  });
  await auditSubscriptionAction({
    schoolId: params.schoolId,
    subscriptionId: subscription.id,
    actor: params.actor,
    action: 'SUBSCRIPTION_TRIAL_STARTED',
    beforeState: existing ? { status: existing.status, endsAt: existing.endsAt } : null,
    afterState: { planId: plan.id, trialDays: params.trialDays, reason: params.reason ?? null },
  });
  await invalidateSubscriptionCache(params.schoolId);
  return getAdminSchoolSubscriptionDetail(params.schoolId);
};

export const extendSchoolSubscriptionTrial = async (params: {
  schoolId: string;
  extraDays: number;
  reason?: string | null;
  actor: SubscriptionActor;
}) => {
  if (params.extraDays < 1 || params.extraDays > 365) {
    throw new HttpError(400, 'Extra days must be between 1 and 365');
  }
  const existing = await prisma.subscription.findUnique({ where: { schoolId: params.schoolId } });
  if (!existing) {
    throw new HttpError(404, 'Subscription not found');
  }
  const base = existing.endsAt && existing.endsAt > new Date() ? existing.endsAt : new Date();
  const subscription = await prisma.subscription.update({
    where: { schoolId: params.schoolId },
    data: { status: 'TRIAL', endsAt: addDays(base, params.extraDays), nextDueAt: addDays(base, params.extraDays + existing.graceDays) },
  });
  await auditSubscriptionAction({
    schoolId: params.schoolId,
    subscriptionId: subscription.id,
    actor: params.actor,
    action: 'SUBSCRIPTION_TRIAL_EXTENDED',
    beforeState: { status: existing.status, endsAt: existing.endsAt },
    afterState: { status: 'TRIAL', endsAt: subscription.endsAt, extraDays: params.extraDays, reason: params.reason ?? null },
  });
  await invalidateSubscriptionCache(params.schoolId);
  return getAdminSchoolSubscriptionDetail(params.schoolId);
};

const changeSchoolSubscriptionPlan = async (params: {
  schoolId: string;
  newPlanId: string;
  action: 'SUBSCRIPTION_UPGRADED' | 'SUBSCRIPTION_DOWNGRADED';
  effectiveDate?: EffectiveDateInput;
  force?: boolean;
  reason?: string | null;
  actor: SubscriptionActor;
}) => {
  await requireSchool(params.schoolId);
  const existing = await prisma.subscription.findUnique({ where: { schoolId: params.schoolId }, include: { plan: true } });
  if (!existing) {
    throw new HttpError(404, 'Subscription not found');
  }
  const newPlan = await requirePlan(params.newPlanId);
  if (params.action === 'SUBSCRIPTION_DOWNGRADED') {
    const usage = await getAdminSubscriptionUsage(params.schoolId);
    if (!params.force && (usage.students.used > newPlan.studentLimit || usage.teachers.used > newPlan.teacherLimit)) {
      throw new HttpError(409, 'Current usage exceeds the selected plan limits. Use force to confirm downgrade.');
    }
  }
  const startsAt =
    params.effectiveDate === 'NEXT_BILLING_CYCLE' && existing.endsAt ? existing.endsAt : new Date();
  const subscription = await writeSubscription({
    schoolId: params.schoolId,
    planId: newPlan.id,
    status: existing.status === 'CANCELLED' || existing.status === 'EXPIRED' ? 'ACTIVE' : existing.status,
    billingCycle: existing.billingCycle as BillingCycleInput,
    startsAt,
    endsAt: calculatePeriodEnd(startsAt, existing.billingCycle),
    studentLimit: newPlan.studentLimit,
    teacherLimit: newPlan.teacherLimit,
  });
  await auditSubscriptionAction({
    schoolId: params.schoolId,
    subscriptionId: subscription.id,
    actor: params.actor,
    action: params.action,
    beforeState: { planId: existing.planId, planName: existing.planName, status: existing.status },
    afterState: {
      planId: newPlan.id,
      planName: newPlan.name,
      status: subscription.status,
      effectiveDate: params.effectiveDate ?? 'IMMEDIATE',
      force: params.force ?? false,
      reason: params.reason ?? null,
    },
  });
  await invalidateSubscriptionCache(params.schoolId);
  return getAdminSchoolSubscriptionDetail(params.schoolId);
};

export const upgradeSchoolSubscription = (params: {
  schoolId: string;
  newPlanId: string;
  effectiveDate?: EffectiveDateInput;
  reason?: string | null;
  actor: SubscriptionActor;
}) => changeSchoolSubscriptionPlan({ ...params, action: 'SUBSCRIPTION_UPGRADED' });

export const downgradeSchoolSubscription = (params: {
  schoolId: string;
  newPlanId: string;
  effectiveDate?: EffectiveDateInput;
  force?: boolean;
  reason?: string | null;
  actor: SubscriptionActor;
}) => changeSchoolSubscriptionPlan({ ...params, action: 'SUBSCRIPTION_DOWNGRADED' });

const updateSubscriptionStatus = async (params: {
  schoolId: string;
  status: string;
  action: string;
  reason?: string | null;
  actor: SubscriptionActor;
}) => {
  const existing = await prisma.subscription.findUnique({ where: { schoolId: params.schoolId } });
  if (!existing) {
    throw new HttpError(404, 'Subscription not found');
  }
  const subscription = await prisma.subscription.update({
    where: { schoolId: params.schoolId },
    data: { status: params.status },
  });
  await auditSubscriptionAction({
    schoolId: params.schoolId,
    subscriptionId: subscription.id,
    actor: params.actor,
    action: params.action,
    beforeState: { status: existing.status },
    afterState: { status: params.status, reason: params.reason ?? null },
  });
  await invalidateSubscriptionCache(params.schoolId);
  return getAdminSchoolSubscriptionDetail(params.schoolId);
};

export const pauseSchoolSubscription = (params: { schoolId: string; reason?: string | null; actor: SubscriptionActor }) =>
  updateSubscriptionStatus({ ...params, status: 'PAUSED', action: 'SUBSCRIPTION_PAUSED' });

export const resumeSchoolSubscription = (params: { schoolId: string; reason?: string | null; actor: SubscriptionActor }) =>
  updateSubscriptionStatus({ ...params, status: 'ACTIVE', action: 'SUBSCRIPTION_RESUMED' });

export const cancelSchoolSubscription = async (params: {
  schoolId: string;
  cancelAt?: CancelMode;
  reason?: string | null;
  actor: SubscriptionActor;
}) => {
  const existing = await prisma.subscription.findUnique({ where: { schoolId: params.schoolId } });
  if (!existing) {
    throw new HttpError(404, 'Subscription not found');
  }
  const status = params.cancelAt === 'PERIOD_END' ? 'PENDING_CANCEL' : 'CANCELLED';
  const subscription = await prisma.subscription.update({
    where: { schoolId: params.schoolId },
    data: { status },
  });
  await auditSubscriptionAction({
    schoolId: params.schoolId,
    subscriptionId: subscription.id,
    actor: params.actor,
    action: 'SUBSCRIPTION_CANCELLED',
    beforeState: { status: existing.status },
    afterState: { status, cancelAt: params.cancelAt ?? 'IMMEDIATE', reason: params.reason ?? null },
  });
  await invalidateSubscriptionCache(params.schoolId);
  return getAdminSchoolSubscriptionDetail(params.schoolId);
};

export const renewSchoolSubscription = async (params: {
  schoolId: string;
  periodMonths: number;
  reason?: string | null;
  actor: SubscriptionActor;
}) => {
  if (params.periodMonths < 1 || params.periodMonths > 60) {
    throw new HttpError(400, 'Period months must be between 1 and 60');
  }
  const existing = await prisma.subscription.findUnique({ where: { schoolId: params.schoolId } });
  if (!existing) {
    throw new HttpError(404, 'Subscription not found');
  }
  const start = existing.endsAt && existing.endsAt > new Date() ? existing.endsAt : new Date();
  const endsAt = addMonths(start, params.periodMonths);
  const subscription = await prisma.subscription.update({
    where: { schoolId: params.schoolId },
    data: { status: 'ACTIVE', startsAt: start, endsAt, nextDueAt: addDays(endsAt, existing.graceDays), paidAt: new Date() },
  });
  await auditSubscriptionAction({
    schoolId: params.schoolId,
    subscriptionId: subscription.id,
    actor: params.actor,
    action: 'SUBSCRIPTION_RENEWED',
    beforeState: { status: existing.status, endsAt: existing.endsAt },
    afterState: { status: 'ACTIVE', endsAt, periodMonths: params.periodMonths, reason: params.reason ?? null },
  });
  await invalidateSubscriptionCache(params.schoolId);
  return getAdminSchoolSubscriptionDetail(params.schoolId);
};

export const overrideSchoolSubscriptionLimits = async (params: {
  schoolId: string;
  studentLimit?: number;
  teacherLimit?: number;
  storageLimitMb?: number;
  reason?: string | null;
  actor: SubscriptionActor;
}) => {
  const existing = await prisma.subscription.findUnique({ where: { schoolId: params.schoolId } });
  if (!existing) {
    throw new HttpError(404, 'Subscription not found');
  }
  const subscription = await prisma.subscription.update({
    where: { schoolId: params.schoolId },
    data: {
      studentLimit: params.studentLimit ?? existing.studentLimit,
      teacherLimit: params.teacherLimit ?? existing.teacherLimit,
    },
  });
  await auditSubscriptionAction({
    schoolId: params.schoolId,
    subscriptionId: subscription.id,
    actor: params.actor,
    action: 'SUBSCRIPTION_LIMITS_OVERRIDDEN',
    beforeState: { studentLimit: existing.studentLimit, teacherLimit: existing.teacherLimit, storageLimitMb: null },
    afterState: {
      studentLimit: subscription.studentLimit,
      teacherLimit: subscription.teacherLimit,
      storageLimitMb: params.storageLimitMb ?? null,
      storageLimitNote: 'Storage limit is not persisted in the current schema',
      reason: params.reason ?? null,
    },
  });
  await invalidateSubscriptionCache(params.schoolId);
  return getAdminSchoolSubscriptionDetail(params.schoolId);
};

export const recordSchoolSubscriptionManualPayment = async (params: {
  schoolId: string;
  amount: number;
  currency: string;
  method: string;
  reference?: string | null;
  paidAt: Date;
  notes?: string | null;
  actor: SubscriptionActor;
}) => {
  const existing = await prisma.subscription.findUnique({ where: { schoolId: params.schoolId } });
  if (!existing) {
    throw new HttpError(404, 'Subscription not found');
  }
  const subscription = await prisma.subscription.update({
    where: { schoolId: params.schoolId },
    data: { paidAt: params.paidAt, status: existing.status === 'PAUSED' ? 'ACTIVE' : existing.status },
  });
  await auditSubscriptionAction({
    schoolId: params.schoolId,
    subscriptionId: subscription.id,
    actor: params.actor,
    action: 'SUBSCRIPTION_MANUAL_PAYMENT_RECORDED',
    afterState: {
      amount: params.amount,
      currency: params.currency,
      method: params.method,
      reference: params.reference ?? null,
      paidAt: params.paidAt,
      notes: params.notes ?? null,
      gatewayCharged: false,
      reason: 'Manual payment note only. No billing gateway is connected.',
    },
  });
  await invalidateSubscriptionCache(params.schoolId);
  return {
    detail: await getAdminSchoolSubscriptionDetail(params.schoolId),
    gatewayCharged: false,
    message: 'Manual payment recorded in audit history. No payment gateway was charged.',
  };
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
