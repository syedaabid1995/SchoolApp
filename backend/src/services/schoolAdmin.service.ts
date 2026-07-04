import crypto from 'crypto';
import { Prisma, type SubscriptionPlan } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { hashPassword } from '../utils/password';
import { buildSchoolDomainUrl, normalizeSchoolSubdomain } from '../utils/schoolDomain';
import { upsertSubscription } from './subscription.service';

export type SchoolCreateInput = {
  name: string;
  code: string;
  subscriptionPlan: string;
  status?: 'ACTIVE' | 'SUSPENDED';
  adminEmail?: string;
  adminBankDetails?: {
    accountHolderName?: string | null;
    accountNumber?: string | null;
    ifscCode?: string | null;
    accountType?: string | null;
    bankName?: string | null;
    branchName?: string | null;
    panNumber?: string | null;
  };
};

export type SchoolUpdateInput = {
  name?: string;
  subscriptionPlan?: string;
  statusReason?: string | null;
  lastLoginAt?: Date | null;
  activeUsersCount?: number;
};

type BankDetailsInput = {
  accountHolderName?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  accountType?: string | null;
  bankName?: string | null;
  branchName?: string | null;
  panNumber?: string | null;
};

const hasBankDetails = (details?: BankDetailsInput) =>
  Boolean(
    details &&
      (details.accountHolderName ||
        details.accountNumber ||
        details.ifscCode ||
        details.accountType ||
        details.bankName ||
        details.branchName ||
        details.panNumber),
  );

const addDays = (date: Date, days: number) => {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
};

const legacyPlanDefaults = {
  STARTER: { studentLimit: 500, teacherLimit: 50, trialDays: 14 },
  STANDARD: { studentLimit: 2000, teacherLimit: 200, trialDays: 14 },
  PREMIUM: { studentLimit: 10000, teacherLimit: 1000, trialDays: 14 },
} as const;

const toLegacySchoolPlan = (planName: string): SubscriptionPlan => {
  const normalized = planName.toUpperCase();
  if (normalized === 'STARTER' || normalized === 'STANDARD' || normalized === 'PREMIUM') {
    return normalized;
  }
  return 'STANDARD';
};

const resolveSchoolSubscriptionPlan = async (client: Prisma.TransactionClient | typeof prisma, planName: string) => {
  const normalizedName = planName.trim();
  const plan = await client.subscriptionPlanDef.findUnique({
    where: { name: normalizedName },
  });

  if (plan) {
    if (plan.status !== 'ACTIVE') {
      throw new HttpError(400, 'Selected subscription plan is inactive');
    }
    return plan;
  }

  const legacyDefaults = legacyPlanDefaults[normalizedName as keyof typeof legacyPlanDefaults];
  if (!legacyDefaults) {
    throw new HttpError(400, 'Selected subscription plan does not exist');
  }

  return client.subscriptionPlanDef.create({
    data: {
      name: normalizedName,
      status: 'ACTIVE',
      priceCents: 0,
      features: [],
      studentLimit: legacyDefaults.studentLimit,
      teacherLimit: legacyDefaults.teacherLimit,
      trialDays: legacyDefaults.trialDays,
    },
  });
};

export const createSchoolAdmin = async (schoolId: string, adminEmail: string, bankDetails?: BankDetailsInput) => {
  return prisma.$transaction(async (tx) => {
    const school = await tx.school.findFirst({
      where: { id: schoolId, deletedAt: null },
      select: { id: true, name: true, code: true, domainUrl: true },
    });
    if (!school) {
      throw new HttpError(404, 'School not found');
    }

    const existingUser = await tx.user.findFirst({
      where: { email: adminEmail, schoolId },
      select: {
        id: true,
        roles: { select: { role: { select: { name: true } } } },
      },
    });

    if (existingUser?.roles.some((entry) => entry.role.name === 'SCHOOL_ADMIN')) {
      throw new HttpError(409, 'School admin already exists for this email');
    }
    if (existingUser) {
      throw new HttpError(409, 'User with this email already exists in this school');
    }

    const tempPassword = crypto.randomBytes(9).toString('base64url');
    const passwordHash = await hashPassword(tempPassword);

    const role = await tx.role.upsert({
      where: { name: 'SCHOOL_ADMIN' },
      update: {},
      create: { name: 'SCHOOL_ADMIN' },
    });

    const adminUser = await tx.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        status: 'ACTIVE',
        schoolId,
        mustChangePassword: true,
      },
      select: { id: true, email: true, schoolId: true, status: true, createdAt: true },
    });

    await tx.userRole.create({
      data: { userId: adminUser.id, roleId: role.id },
    });

    if (hasBankDetails(bankDetails)) {
      await tx.userBankDetails.create({
        data: {
          userId: adminUser.id,
          accountHolderName: bankDetails?.accountHolderName ?? null,
          accountNumber: bankDetails?.accountNumber ?? null,
          ifscCode: bankDetails?.ifscCode ?? null,
          accountType: bankDetails?.accountType ?? null,
          bankName: bankDetails?.bankName ?? null,
          branchName: bankDetails?.branchName ?? null,
          panNumber: bankDetails?.panNumber ?? null,
        },
      });
    }

    return { school, adminUser, tempPassword };
  });
};

export const listSchoolAdmins = async (schoolId: string) => {
  const school = await prisma.school.findFirst({
    where: { id: schoolId, deletedAt: null },
    select: { id: true, name: true, code: true },
  });
  if (!school) {
    throw new HttpError(404, 'School not found');
  }

  const admins = await prisma.user.findMany({
    where: {
      schoolId,
      roles: {
        some: { role: { name: 'SCHOOL_ADMIN' } },
      },
    },
    select: {
      id: true,
      email: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const adminIds = admins.map((admin) => admin.id);
  const createdLogs = adminIds.length
    ? await prisma.auditLog.findMany({
        where: {
          entityType: 'USER',
          action: 'SCHOOL_ADMIN_CREATED',
          entityId: { in: adminIds },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          entityId: true,
          actor: { select: { email: true } },
        },
      })
    : [];

  const createdByMap = new Map<string, string>();
  createdLogs.forEach((log) => {
    if (!createdByMap.has(log.entityId)) {
      createdByMap.set(log.entityId, log.actor.email);
    }
  });

  return {
    school,
    admins: admins.map((admin) => ({
      ...admin,
      createdBy: createdByMap.get(admin.id) ?? 'System',
    })),
  };
};

export const setSchoolAdminStatus = async (
  schoolId: string,
  adminUserId: string,
  status: 'ACTIVE' | 'INACTIVE',
) => {
  const school = await prisma.school.findFirst({
    where: { id: schoolId, deletedAt: null },
    select: { id: true },
  });
  if (!school) {
    throw new HttpError(404, 'School not found');
  }

  const admin = await prisma.user.findFirst({
    where: {
      id: adminUserId,
      schoolId,
      roles: {
        some: { role: { name: 'SCHOOL_ADMIN' } },
      },
    },
    select: { id: true, status: true, email: true },
  });
  if (!admin) {
    throw new HttpError(404, 'School admin not found');
  }

  return prisma.user.update({
    where: { id: adminUserId },
    data: { status },
    select: { id: true, email: true, status: true, createdAt: true },
  });
};

export const createSchool = async (payload: SchoolCreateInput) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const planRow = await resolveSchoolSubscriptionPlan(tx, payload.subscriptionPlan);
      const subdomain = normalizeSchoolSubdomain(payload.code);
      if (!subdomain) {
        throw new HttpError(400, 'School code cannot be used as a subdomain');
      }

      const school = await tx.school.create({
        data: {
          name: payload.name,
          code: payload.code,
          subdomain,
          domainUrl: buildSchoolDomainUrl(subdomain),
          subscriptionPlan: toLegacySchoolPlan(planRow.name),
          status: payload.status ?? 'ACTIVE',
        },
      });

      const attendanceEffectiveFrom = new Date('2000-01-01T00:00:00.000Z');
      await tx.attendanceConfiguration.create({
        data: {
          schoolId: school.id,
          scope: 'SCHOOL',
          mode: 'TWICE_DAILY',
          effectiveFrom: attendanceEffectiveFrom,
          isActive: true,
        },
      });
      await tx.staffAttendanceConfiguration.create({
        data: {
          schoolId: school.id,
          roleName: null,
          mode: 'TWICE_DAILY',
          effectiveFrom: attendanceEffectiveFrom,
          isActive: true,
        },
      });

    const startsAt = new Date();
    const trialDays = planRow.trialDays ?? 0;
    const endsAt = trialDays > 0 ? addDays(startsAt, trialDays) : startsAt;
    const status = trialDays > 0 ? 'TRIAL' : 'PENDING';

    await tx.subscription.create({
      data: {
        schoolId: school.id,
        planName: planRow.name,
        planId: planRow.id,
        status,
        startsAt,
        endsAt,
        nextDueAt: trialDays > 0 ? addDays(endsAt, 15) : startsAt,
        studentLimit: planRow.studentLimit,
        teacherLimit: planRow.teacherLimit,
      },
    });

    await tx.usageCounter.create({
      data: {
        schoolId: school.id,
        students: 0,
        teachers: 0,
      },
    });

    if (!payload.adminEmail) {
      return { school };
    }

    const existingAdmin = await tx.user.findFirst({
      where: { email: payload.adminEmail, schoolId: school.id },
      select: { id: true },
    });
    if (existingAdmin) {
      throw new HttpError(409, 'School admin already exists for this email');
    }

    const tempPassword = crypto.randomBytes(9).toString('base64url');
    const passwordHash = await hashPassword(tempPassword);

    const role = await tx.role.upsert({
      where: { name: 'SCHOOL_ADMIN' },
      update: {},
      create: { name: 'SCHOOL_ADMIN' },
    });

    const adminUser = await tx.user.create({
      data: {
        email: payload.adminEmail,
        passwordHash,
        status: 'ACTIVE',
        schoolId: school.id,
        mustChangePassword: true,
      },
      select: { id: true, email: true, schoolId: true, status: true, createdAt: true },
    });

    await tx.userRole.create({
      data: { userId: adminUser.id, roleId: role.id },
    });

    if (hasBankDetails(payload.adminBankDetails)) {
      await tx.userBankDetails.create({
        data: {
          userId: adminUser.id,
          accountHolderName: payload.adminBankDetails?.accountHolderName ?? null,
          accountNumber: payload.adminBankDetails?.accountNumber ?? null,
          ifscCode: payload.adminBankDetails?.ifscCode ?? null,
          accountType: payload.adminBankDetails?.accountType ?? null,
          bankName: payload.adminBankDetails?.bankName ?? null,
          branchName: payload.adminBankDetails?.branchName ?? null,
          panNumber: payload.adminBankDetails?.panNumber ?? null,
        },
      });
    }

      return { school, adminUser, tempPassword };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      Array.isArray(error.meta?.target) &&
      error.meta?.target.includes('code')
    ) {
      throw new HttpError(409, 'School code already exists');
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      Array.isArray(error.meta?.target) &&
      error.meta?.target.includes('subdomain')
    ) {
      throw new HttpError(409, 'School subdomain already exists');
    }
    throw error;
  }
};

export const listSchools = async (params: {
  page: number;
  limit: number;
  status?: 'ACTIVE' | 'SUSPENDED';
  query?: string;
  includeDeleted?: boolean;
}) => {
  const skip = (params.page - 1) * params.limit;
  const where: Prisma.SchoolWhereInput = {
    ...(params.includeDeleted ? {} : { deletedAt: null }),
    ...(params.status ? { status: params.status } : {}),
    ...(params.query
      ? {
          OR: [
            { name: { contains: params.query, mode: Prisma.QueryMode.insensitive } },
            { code: { contains: params.query, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {}),
  };

  const [itemsRaw, total] = await Promise.all([
    prisma.school.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: params.limit,
      include: {
        subscription: {
          include: { plan: true },
        },
        users: {
          where: {
            roles: {
              some: { role: { name: 'SCHOOL_ADMIN' } },
            },
          },
          select: { email: true },
        },
      },
    }),
    prisma.school.count({ where }),
  ]);

  const items = itemsRaw.map((school) => {
    const adminEmail = school.users[0]?.email ?? null;
    const adminEmails = school.users.map((user) => user.email);
    const planName =
      school.subscription?.plan?.name ??
      school.subscription?.planName ??
      school.subscriptionPlan;
    const { users, subscription, ...rest } = school;
    return { ...rest, subscriptionPlan: planName, adminEmail, adminEmails };
  });

  return {
    items,
    page: params.page,
    limit: params.limit,
    total,
    pages: Math.ceil(total / params.limit),
  };
};

export const updateSchool = async (id: string, payload: SchoolUpdateInput) => {
  const planRow = payload.subscriptionPlan
    ? await resolveSchoolSubscriptionPlan(prisma, payload.subscriptionPlan)
    : null;
  const updated = await prisma.school.update({
    where: { id },
    data: {
      name: payload.name ?? undefined,
      subscriptionPlan: planRow ? toLegacySchoolPlan(planRow.name) : undefined,
      statusReason: payload.statusReason === undefined ? undefined : payload.statusReason,
      lastLoginAt: payload.lastLoginAt === undefined ? undefined : payload.lastLoginAt,
      activeUsersCount: payload.activeUsersCount ?? undefined,
    },
  });
  if (planRow) {
    await upsertSubscription({
      schoolId: updated.id,
      planId: planRow.id,
      planName: planRow.name,
      status: 'ACTIVE',
      startsAt: new Date(),
      billingCycle: 'MONTHLY',
    });
  }
  return updated;
};

export const setSchoolStatus = async (id: string, status: 'ACTIVE' | 'SUSPENDED', reason?: string | null) => {
  return prisma.school.update({
    where: { id },
    data: {
      status,
      statusReason: reason ?? null,
    },
  });
};

export const softDeleteSchool = async (id: string) => {
  return prisma.school.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      status: 'SUSPENDED',
    },
  });
};

export const restoreSchool = async (id: string) => {
  return prisma.school.update({
    where: { id },
    data: {
      deletedAt: null,
      status: 'ACTIVE',
      statusReason: null,
    },
  });
};
