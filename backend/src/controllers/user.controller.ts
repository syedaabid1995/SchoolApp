import type { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { hashPassword } from '../utils/password';
import { createTeacher } from '../services/teacher.service';
import { logAudit } from '../utils/audit';
import {
  EMPLOYEE_PERMISSION_CATALOG,
  MANAGED_EMPLOYEE_ROLES,
  getEffectivePermissionCodesForRole,
  type ManagedEmployeeRole,
} from '../utils/employeePermissions';
import { sendAccountCreatedWhatsapp } from '../services/accountOnboardingWhatsapp.service';

const createSchoolUserSchema = z.object({
  email: z.string().email(),
  roleName: z.enum(['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF']),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  employeeNo: z.string().min(1).optional().nullable(),
  phone: z.string().min(1).optional().nullable(),
  address: z.string().min(1).optional().nullable(),
  schoolId: z.string().uuid().optional(),
});

const managedRoleSchema = z.enum(MANAGED_EMPLOYEE_ROLES);

const updateEmployeePermissionsSchema = z.object({
  roleName: managedRoleSchema,
  enabledCodes: z.array(z.string()).default([]),
  schoolId: z.string().uuid().optional(),
});

export const getMe = async (req: Request, res: Response) => {
  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: {
      id: true,
      email: true,
      schoolId: true,
      teacherProfile: { select: { firstName: true, lastName: true } },
      parentProfiles: { select: { firstName: true, lastName: true }, take: 1 },
      roles: { select: { role: { select: { name: true } } } },
    },
  });

  if (!user) {
    throw new HttpError(401, 'Unauthorized');
  }

  const role = user.roles[0]?.role.name ?? null;
  const teacherName = user.teacherProfile
    ? `${user.teacherProfile.firstName} ${user.teacherProfile.lastName}`.trim()
    : null;
  const parentName = user.parentProfiles?.[0]
    ? `${user.parentProfiles[0].firstName} ${user.parentProfiles[0].lastName}`.trim()
    : null;
  const displayName = teacherName || parentName || user.email;
  const permissionCodes =
    user.schoolId && role
      ? await getEffectivePermissionCodesForRole(user.schoolId, role)
      : [];

  res.status(200).json({
    id: user.id,
    email: user.email,
    schoolId: user.schoolId,
    role,
    displayName,
    permissionCodes,
  });
};

export const getUserById = async (req: Request, res: Response) => {
  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const requester = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { id: true, schoolId: true },
  });

  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      email: true,
      schoolId: true,
      teacherProfile: { select: { firstName: true, lastName: true, phone: true, address: true } },
      parentProfiles: { select: { firstName: true, lastName: true, phone: true, email: true } },
      roles: { select: { role: { select: { name: true } } } },
      createdAt: true,
    },
  });

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  const requesterSchoolId = requester?.schoolId ?? null;
  const isSuperAdmin = requesterSchoolId === null;
  const sameSchoolUser = requesterSchoolId && user.schoolId === requesterSchoolId;
  const hasParentProfileInSchool = requesterSchoolId
    ? await prisma.studentParent.findFirst({
        where: {
          parent: { userId: user.id },
          student: { schoolId: requesterSchoolId },
        },
        select: { studentId: true },
      })
    : null;

  if (!isSuperAdmin && !sameSchoolUser && !hasParentProfileInSchool) {
    throw new HttpError(403, 'Forbidden');
  }

  const role = user.roles[0]?.role.name ?? null;
  const teacherName = user.teacherProfile
    ? `${user.teacherProfile.firstName} ${user.teacherProfile.lastName}`.trim()
    : null;
  const parentName = user.parentProfiles[0]
    ? `${user.parentProfiles[0].firstName} ${user.parentProfiles[0].lastName}`.trim()
    : null;

  res.status(200).json({
    id: user.id,
    email: user.email,
    schoolId: user.schoolId,
    role,
    teacherProfile: user.teacherProfile,
    parentProfiles: user.parentProfiles,
    displayName: teacherName || parentName || user.email,
    createdAt: user.createdAt,
  });
};

export const createSchoolUserApi = async (req: Request, res: Response) => {
  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const payload = createSchoolUserSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  if (payload.roleName === 'TEACHER') {
    if (!payload.firstName || !payload.lastName) {
      throw new HttpError(400, 'First name and last name are required for teachers');
    }

    const result = await createTeacher({
      schoolId,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      employeeNo: payload.employeeNo ?? null,
      phone: payload.phone ?? null,
      address: payload.address ?? null,
    });

    await logAudit(req, {
      schoolId,
      entityType: 'USER',
      entityId: result.user.id,
      action: 'CREATE',
      afterState: { email: result.user.email, roleName: 'TEACHER' },
    });

    const whatsapp = await sendAccountCreatedWhatsapp({
      role: 'TEACHER',
      schoolId,
      email: result.user.email,
      mobile: payload.phone ?? null,
      tempPassword: result.tempPassword,
      fullName: `${payload.firstName} ${payload.lastName}`.trim(),
    });

    res.status(201).json({
      user: {
        id: result.user.id,
        email: result.user.email,
        schoolId,
        roleName: 'TEACHER',
        status: result.user.status,
      },
      tempPassword: result.tempPassword,
      whatsappSentTo: whatsapp.sentTo,
    });
    return;
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: payload.email, schoolId },
    select: { id: true },
  });
  if (existingUser) {
    throw new HttpError(409, 'User with this email already exists in this school');
  }

  const tempPassword = crypto.randomBytes(9).toString('base64url');
  const passwordHash = await hashPassword(tempPassword);

  const role = await prisma.role.upsert({
    where: { name: payload.roleName },
    update: {},
    create: { name: payload.roleName },
  });

  const user = await prisma.user.create({
    data: {
      schoolId,
      email: payload.email,
      passwordHash,
      status: 'ACTIVE',
      mustChangePassword: true,
      roles: {
        create: {
          roleId: role.id,
        },
      },
    },
    select: {
      id: true,
      email: true,
      schoolId: true,
      status: true,
    },
  });

  await logAudit(req, {
    schoolId,
    entityType: 'USER',
    entityId: user.id,
    action: 'CREATE',
    afterState: { email: user.email, roleName: payload.roleName },
  });

  const whatsapp =
    payload.roleName === 'SCHOOL_ADMIN'
      ? await sendAccountCreatedWhatsapp({
          role: 'SCHOOL_ADMIN',
          schoolId,
          email: user.email,
          mobile: payload.phone ?? null,
          tempPassword,
          fullName: payload.email,
        })
      : null;

  res.status(201).json({
    user: {
      ...user,
      roleName: payload.roleName,
    },
    tempPassword,
    whatsappSentTo: whatsapp?.sentTo ?? null,
  });
};

export const listEmployeePermissionsApi = async (req: Request, res: Response) => {
  const roleName = managedRoleSchema.parse((req.query.roleName as string | undefined) ?? 'TEACHER');
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const enabledCodes = await getEffectivePermissionCodesForRole(schoolId, roleName);

  const users = await prisma.user.findMany({
    where: {
      schoolId,
      roles: {
        some: { role: { name: roleName } },
      },
    },
    select: {
      id: true,
      email: true,
      status: true,
      createdAt: true,
      teacherProfile: {
        select: { firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json({
    roleName,
    employees: users.map((user) => ({
      id: user.id,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
      displayName: user.teacherProfile
        ? `${user.teacherProfile.firstName} ${user.teacherProfile.lastName}`.trim()
        : user.email,
    })),
    permissions: EMPLOYEE_PERMISSION_CATALOG.map((permission) => ({
      ...permission,
      enabled: enabledCodes.includes(permission.code),
    })),
  });
};

export const updateEmployeePermissionsApi = async (req: Request, res: Response) => {
  const payload = updateEmployeePermissionsSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const validCodes = new Set(EMPLOYEE_PERMISSION_CATALOG.map((permission) => permission.code));
  const enabledCodes = payload.enabledCodes.filter((code) => validCodes.has(code));

  await prisma.$transaction(async (tx) => {
    await tx.employeeRolePermission.deleteMany({
      where: { schoolId, roleName: payload.roleName },
    });

    await tx.employeeRolePermission.createMany({
      data: EMPLOYEE_PERMISSION_CATALOG.map((permission) => ({
        schoolId,
        roleName: payload.roleName as ManagedEmployeeRole,
        permissionCode: permission.code,
        enabled: enabledCodes.includes(permission.code),
      })),
    });
  });

  await logAudit(req, {
    schoolId,
    entityType: 'USER',
    entityId: payload.roleName,
    action: 'UPDATE',
    afterState: { roleName: payload.roleName, enabledCodes },
  });

  res.status(200).json({ success: true });
};
