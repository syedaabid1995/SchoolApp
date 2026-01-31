import { prisma } from '../config/db';
import { hashPassword } from '../utils/password';
import { incrementUsage, enforceLimits } from './subscription.service';

export type TeacherCreateInput = {
  schoolId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  employeeNo?: string | null;
  phone?: string | null;
};

export type TeacherUpdateInput = {
  email?: string;
  firstName?: string;
  lastName?: string;
  employeeNo?: string | null;
  phone?: string | null;
  isActive?: boolean;
};

export const createTeacher = async (payload: TeacherCreateInput) => {
  await enforceLimits(payload.schoolId, 'teachers');

  const teacherRole = await prisma.role.findUnique({
    where: { name: 'TEACHER' },
  });

  if (!teacherRole) {
    throw new Error('Teacher role not configured');
  }

  const passwordHash = await hashPassword(payload.password);

  const teacher = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        schoolId: payload.schoolId,
        email: payload.email,
        passwordHash,
        status: 'ACTIVE',
        roles: {
          create: [{ roleId: teacherRole.id }],
        },
      },
    });

    const profile = await tx.teacherProfile.create({
      data: {
        schoolId: payload.schoolId,
        userId: user.id,
        firstName: payload.firstName,
        lastName: payload.lastName,
        employeeNo: payload.employeeNo ?? null,
        phone: payload.phone ?? null,
        isActive: true,
      },
    });

    return { user, profile };
  });

  await incrementUsage(payload.schoolId, 'teachers', 1);

  return teacher;
};

export const listTeachers = async (params: {
  schoolId: string;
  page: number;
  limit: number;
  query?: string;
  isActive?: boolean;
}) => {
  const skip = (params.page - 1) * params.limit;
  const where = {
    schoolId: params.schoolId,
    ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
    ...(params.query
      ? {
          OR: [
            { firstName: { contains: params.query, mode: 'insensitive' } },
            { lastName: { contains: params.query, mode: 'insensitive' } },
            { employeeNo: { contains: params.query, mode: 'insensitive' } },
            { user: { email: { contains: params.query, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.teacherProfile.findMany({
      where,
      include: {
        user: { select: { email: true, status: true } },
        classAssignments: { include: { class: true } },
        subjectAssignments: { include: { subject: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: params.limit,
    }),
    prisma.teacherProfile.count({ where }),
  ]);

  return {
    items,
    page: params.page,
    limit: params.limit,
    total,
    pages: Math.ceil(total / params.limit),
  };
};

export const updateTeacher = async (teacherId: string, schoolId: string, payload: TeacherUpdateInput) => {
  const existing = await prisma.teacherProfile.findFirst({
    where: { id: teacherId, schoolId },
    include: { user: true },
  });

  if (!existing) {
    throw new Error('Teacher not found');
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (payload.email && payload.email !== existing.user.email) {
      await tx.user.update({
        where: { id: existing.userId },
        data: { email: payload.email },
      });
    }

    const profile = await tx.teacherProfile.update({
      where: { id: existing.id },
      data: {
        firstName: payload.firstName ?? undefined,
        lastName: payload.lastName ?? undefined,
        employeeNo: payload.employeeNo === undefined ? undefined : payload.employeeNo,
        phone: payload.phone === undefined ? undefined : payload.phone,
        isActive: payload.isActive ?? undefined,
      },
    });

    return profile;
  });

  return updated;
};
