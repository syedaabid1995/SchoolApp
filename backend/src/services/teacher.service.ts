import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { hashPassword } from '../utils/password';
import { incrementUsage, enforceLimits } from './subscription.service';

export type TeacherCreateInput = {
  schoolId: string;
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  employeeNo?: string | null;
  phone?: string | null;
  address?: string | null;
  bankDetails?: {
    accountHolderName?: string | null;
    accountNumber?: string | null;
    ifscCode?: string | null;
    accountType?: string | null;
    bankName?: string | null;
    branchName?: string | null;
    panNumber?: string | null;
  };
};

export type TeacherUpdateInput = {
  email?: string;
  firstName?: string;
  lastName?: string;
  employeeNo?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive?: boolean;
  bankDetails?: {
    accountHolderName?: string | null;
    accountNumber?: string | null;
    ifscCode?: string | null;
    accountType?: string | null;
    bankName?: string | null;
    branchName?: string | null;
    panNumber?: string | null;
  };
};

export const createTeacher = async (payload: TeacherCreateInput) => {
  await enforceLimits(payload.schoolId, 'teachers');

  const teacherRole = await prisma.role.upsert({
    where: { name: 'TEACHER' },
    update: {},
    create: { name: 'TEACHER' },
  });

  const tempPassword = payload.password ?? crypto.randomBytes(9).toString('base64url');
  const passwordHash = await hashPassword(tempPassword);
  const mustChangePassword = !payload.password;

  try {
    const teacher = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          schoolId: payload.schoolId,
          email: payload.email,
          passwordHash,
          status: 'ACTIVE',
          mustChangePassword,
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
          address: payload.address ?? null,
          isActive: true,
        },
      });

      if (payload.bankDetails) {
        const details = payload.bankDetails;
        const hasAny =
          details.accountHolderName ||
          details.accountNumber ||
          details.ifscCode ||
          details.accountType ||
          details.bankName ||
          details.branchName ||
          details.panNumber;
        if (hasAny) {
          await tx.teacherBankDetails.create({
            data: {
              teacherId: profile.id,
              accountHolderName: details.accountHolderName ?? null,
              accountNumber: details.accountNumber ?? null,
              ifscCode: details.ifscCode ?? null,
              accountType: details.accountType ?? null,
              bankName: details.bankName ?? null,
              branchName: details.branchName ?? null,
              panNumber: details.panNumber ?? null,
            },
          });
        }
      }

      return { user, profile };
    });

    await incrementUsage(payload.schoolId, 'teachers', 1);

    return { ...teacher, tempPassword: mustChangePassword ? tempPassword : null };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && Array.isArray(error.meta?.target)) {
      const target = error.meta.target as string[];
      if (target.includes('school_id') && target.includes('email')) {
        throw new HttpError(409, 'Teacher email already exists in this school');
      }
      if (target.includes('school_id') && target.includes('employee_no')) {
        throw new HttpError(409, 'Employee number already exists in this school');
      }
    }
    throw error;
  }
};

export const listTeachers = async (params: {
  schoolId: string;
  page: number;
  limit: number;
  query?: string;
  isActive?: boolean;
}) => {
  const skip = (params.page - 1) * params.limit;
  const where: Prisma.TeacherProfileWhereInput = {
    schoolId: params.schoolId,
    ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
    ...(params.query
      ? {
          OR: [
            { firstName: { contains: params.query, mode: Prisma.QueryMode.insensitive } },
            { lastName: { contains: params.query, mode: Prisma.QueryMode.insensitive } },
            { employeeNo: { contains: params.query, mode: Prisma.QueryMode.insensitive } },
            { user: { email: { contains: params.query, mode: Prisma.QueryMode.insensitive } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.teacherProfile.findMany({
      where,
      include: {
        user: { select: { email: true, status: true } },
        bankDetails: true,
        classAssignments: { include: { class: true, section: true } },
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

export const getTeacher = async (teacherId: string, schoolId: string) => {
  return prisma.teacherProfile.findFirst({
    where: { id: teacherId, schoolId },
    include: {
      user: { select: { email: true, status: true } },
      bankDetails: true,
      classAssignments: { include: { class: true, section: true } },
      subjectAssignments: { include: { subject: true } },
    },
  });
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
        address: payload.address === undefined ? undefined : payload.address,
        isActive: payload.isActive ?? undefined,
      },
    });

    if (payload.bankDetails) {
      const details = payload.bankDetails;
      const hasAny =
        details.accountHolderName ||
        details.accountNumber ||
        details.ifscCode ||
        details.accountType ||
        details.bankName ||
        details.branchName ||
        details.panNumber;

      if (hasAny) {
        await tx.teacherBankDetails.upsert({
          where: { teacherId: existing.id },
          create: {
            teacherId: existing.id,
            accountHolderName: details.accountHolderName ?? null,
            accountNumber: details.accountNumber ?? null,
            ifscCode: details.ifscCode ?? null,
            accountType: details.accountType ?? null,
            bankName: details.bankName ?? null,
            branchName: details.branchName ?? null,
            panNumber: details.panNumber ?? null,
          },
          update: {
            accountHolderName: details.accountHolderName ?? null,
            accountNumber: details.accountNumber ?? null,
            ifscCode: details.ifscCode ?? null,
            accountType: details.accountType ?? null,
            bankName: details.bankName ?? null,
            branchName: details.branchName ?? null,
            panNumber: details.panNumber ?? null,
          },
        });
      }
    }

    return profile;
  });

  return updated;
};
