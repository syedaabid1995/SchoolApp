import crypto from 'crypto';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { hashPassword } from '../utils/password';
import { upsertSubscription } from './subscription.service';

export type SchoolCreateInput = {
  name: string;
  code: string;
  subscriptionPlan: 'STARTER' | 'STANDARD' | 'PREMIUM';
  status?: 'ACTIVE' | 'SUSPENDED';
  adminEmail?: string;
};

export type SchoolUpdateInput = {
  name?: string;
  subscriptionPlan?: 'STARTER' | 'STANDARD' | 'PREMIUM';
  statusReason?: string | null;
  lastLoginAt?: Date | null;
  activeUsersCount?: number;
};

export const createSchool = async (payload: SchoolCreateInput) => {
  return prisma.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: {
        name: payload.name,
        code: payload.code,
        subscriptionPlan: payload.subscriptionPlan,
        status: payload.status ?? 'ACTIVE',
      },
    });

    const plan = await tx.subscriptionPlanDef.findUnique({
      where: { name: payload.subscriptionPlan },
    });
    const planRow =
      plan ??
      (await tx.subscriptionPlanDef.create({
        data: {
          name: payload.subscriptionPlan,
          status: 'ACTIVE',
          priceCents: 0,
          features: [],
          studentLimit:
            payload.subscriptionPlan === 'STARTER'
              ? 500
              : payload.subscriptionPlan === 'STANDARD'
                ? 2000
                : 10000,
          teacherLimit:
            payload.subscriptionPlan === 'STARTER'
              ? 50
              : payload.subscriptionPlan === 'STANDARD'
                ? 200
                : 1000,
        },
      }));

    await tx.subscription.create({
      data: {
        schoolId: school.id,
        planName: planRow.name,
        planId: planRow.id,
        status: 'ACTIVE',
        startsAt: new Date(),
        endsAt: null,
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

    return { school, adminUser, tempPassword };
  });
};

export const listSchools = async (params: {
  page: number;
  limit: number;
  status?: 'ACTIVE' | 'SUSPENDED';
  query?: string;
}) => {
  const skip = (params.page - 1) * params.limit;
  const where = {
    deletedAt: null,
    ...(params.status ? { status: params.status } : {}),
    ...(params.query
      ? {
          OR: [
            { name: { contains: params.query, mode: 'insensitive' } },
            { code: { contains: params.query, mode: 'insensitive' } },
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
    const planName =
      school.subscription?.plan?.name ??
      school.subscription?.planName ??
      school.subscriptionPlan;
    const { users, subscription, ...rest } = school;
    return { ...rest, subscriptionPlan: planName, adminEmail };
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
  const updated = await prisma.school.update({
    where: { id },
    data: {
      name: payload.name ?? undefined,
      subscriptionPlan: payload.subscriptionPlan ?? undefined,
      statusReason: payload.statusReason === undefined ? undefined : payload.statusReason,
      lastLoginAt: payload.lastLoginAt === undefined ? undefined : payload.lastLoginAt,
      activeUsersCount: payload.activeUsersCount ?? undefined,
    },
  });
  if (payload.subscriptionPlan) {
    await upsertSubscription({
      schoolId: updated.id,
      planName: payload.subscriptionPlan,
      status: 'ACTIVE',
      startsAt: new Date(),
      endsAt: null,
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
