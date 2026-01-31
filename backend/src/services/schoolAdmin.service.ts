import { prisma } from '../config/db';

export type SchoolCreateInput = {
  name: string;
  code: string;
  subscriptionPlan: string;
  status?: 'ACTIVE' | 'SUSPENDED';
};

export type SchoolUpdateInput = {
  name?: string;
  subscriptionPlan?: string;
  statusReason?: string | null;
  lastLoginAt?: Date | null;
  activeUsersCount?: number;
};

export const createSchool = async (payload: SchoolCreateInput) => {
  return prisma.school.create({
    data: {
      name: payload.name,
      code: payload.code,
      subscriptionPlan: payload.subscriptionPlan,
      status: payload.status ?? 'ACTIVE',
    },
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

  const [items, total] = await Promise.all([
    prisma.school.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: params.limit,
    }),
    prisma.school.count({ where }),
  ]);

  return {
    items,
    page: params.page,
    limit: params.limit,
    total,
    pages: Math.ceil(total / params.limit),
  };
};

export const updateSchool = async (id: string, payload: SchoolUpdateInput) => {
  return prisma.school.update({
    where: { id },
    data: {
      name: payload.name ?? undefined,
      subscriptionPlan: payload.subscriptionPlan ?? undefined,
      statusReason: payload.statusReason === undefined ? undefined : payload.statusReason,
      lastLoginAt: payload.lastLoginAt === undefined ? undefined : payload.lastLoginAt,
      activeUsersCount: payload.activeUsersCount ?? undefined,
    },
  });
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
