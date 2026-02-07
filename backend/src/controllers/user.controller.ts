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
  getEffectivePermissionCodesForUser,
  getPlanPermissionCodesForSchool,
  type ManagedEmployeeRole,
} from '../utils/employeePermissions';
import { sendAccountCreatedWhatsapp } from '../services/accountOnboardingWhatsapp.service';

const bankDetailsSchema = z
  .object({
    accountHolderName: z.string().min(1).optional().nullable(),
    accountNumber: z.string().min(1).optional().nullable(),
    ifscCode: z.string().min(1).optional().nullable(),
    accountType: z.string().min(1).optional().nullable(),
    bankName: z.string().min(1).optional().nullable(),
    branchName: z.string().min(1).optional().nullable(),
    panNumber: z.string().min(1).optional().nullable(),
  })
  .optional();

const createSchoolUserSchema = z.object({
  email: z.string().email(),
  roleName: z.enum(['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF']),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  employeeNo: z.string().min(1).optional().nullable(),
  phone: z.string().min(1).optional().nullable(),
  address: z.string().min(1).optional().nullable(),
  bankDetails: bankDetailsSchema,
  schoolId: z.string().uuid().optional(),
});

const managedRoleSchema = z.enum(MANAGED_EMPLOYEE_ROLES);

const updateEmployeePermissionsSchema = z.object({
  roleName: managedRoleSchema,
  enabledCodes: z.array(z.string()).default([]),
  schoolId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
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
      ? await getEffectivePermissionCodesForUser(user.schoolId, user.id, role)
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
      mappedSchoolId: schoolId,
      tempPassword: result.tempPassword,
      whatsappSentTo: whatsapp.sentTo,
      manualShareRequired: whatsapp.manualShareRequired,
      manualShareText: whatsapp.manualShareText,
      manualShareUrl: whatsapp.manualShareUrl,
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

  const profile = await prisma.teacherProfile.create({
    data: {
      schoolId,
      userId: user.id,
      firstName: payload.firstName,
      lastName: payload.lastName,
      employeeNo: payload.employeeNo ?? null,
      phone: payload.phone ?? null,
      address: payload.address ?? null,
      isActive: true,
    },
  });

  if (
    payload.bankDetails &&
    (payload.bankDetails.accountHolderName ||
      payload.bankDetails.accountNumber ||
      payload.bankDetails.ifscCode ||
      payload.bankDetails.accountType ||
      payload.bankDetails.bankName ||
      payload.bankDetails.branchName ||
      payload.bankDetails.panNumber)
  ) {
    await prisma.teacherBankDetails.create({
      data: {
        teacherId: profile.id,
        accountHolderName: payload.bankDetails.accountHolderName ?? null,
        accountNumber: payload.bankDetails.accountNumber ?? null,
        ifscCode: payload.bankDetails.ifscCode ?? null,
        accountType: payload.bankDetails.accountType ?? null,
        bankName: payload.bankDetails.bankName ?? null,
        branchName: payload.bankDetails.branchName ?? null,
        panNumber: payload.bankDetails.panNumber ?? null,
      },
    });
  }

  res.status(201).json({
    user: {
      ...user,
      roleName: payload.roleName,
    },
    mappedSchoolId: schoolId,
    tempPassword,
    whatsappSentTo: whatsapp?.sentTo ?? null,
    manualShareRequired: whatsapp?.manualShareRequired ?? false,
    manualShareText: whatsapp?.manualShareText ?? null,
    manualShareUrl: whatsapp?.manualShareUrl ?? null,
  });
};

export const listEmployeePermissionsApi = async (req: Request, res: Response) => {
  const roleName = managedRoleSchema.parse((req.query.roleName as string | undefined) ?? 'TEACHER');
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const userId = req.query.userId as string | undefined;
  const planCodes = new Set(await getPlanPermissionCodesForSchool(schoolId));
  const enabledCodes = userId
    ? await getEffectivePermissionCodesForUser(schoolId, userId, roleName)
    : await getEffectivePermissionCodesForRole(schoolId, roleName);
  const allowedPermissions = planCodes.size
    ? EMPLOYEE_PERMISSION_CATALOG.filter((permission) => planCodes.has(permission.code))
    : [];

  const subscription = await prisma.subscription.findUnique({
    where: { schoolId },
    select: { planName: true },
  });

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
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json({
    roleName,
    planName: subscription?.planName ?? null,
    employees: users.map((user) => ({
      id: user.teacherProfile?.id ?? user.id,
      userId: user.id,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
      displayName: user.teacherProfile
        ? `${user.teacherProfile.firstName} ${user.teacherProfile.lastName}`.trim()
        : user.email,
    })),
    permissions: allowedPermissions.map((permission) => ({
      ...permission,
      enabled: enabledCodes.includes(permission.code),
    })),
  });
};

export const updateEmployeePermissionsApi = async (req: Request, res: Response) => {
  const payload = updateEmployeePermissionsSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const validCodes = new Set(EMPLOYEE_PERMISSION_CATALOG.map((permission) => permission.code));
  const planCodes = new Set(await getPlanPermissionCodesForSchool(schoolId));
  const enabledCodes = payload.enabledCodes.filter((code) => validCodes.has(code) && planCodes.has(code));

  if (payload.userId) {
    const targetUser = await prisma.user.findFirst({
      where: {
        id: payload.userId,
        schoolId,
        roles: { some: { role: { name: payload.roleName } } },
      },
      select: { id: true },
    });

    if (!targetUser) {
      throw new HttpError(404, 'Employee not found for selected role');
    }

    await prisma.$transaction(async (tx) => {
      await tx.employeeUserPermission.deleteMany({
        where: { schoolId, userId: payload.userId },
      });

      await tx.employeeUserPermission.createMany({
        data: EMPLOYEE_PERMISSION_CATALOG.map((permission) => ({
          schoolId,
          userId: payload.userId!,
          permissionCode: permission.code,
          enabled: enabledCodes.includes(permission.code),
        })),
      });
    });

    await logAudit(req, {
      schoolId,
      entityType: 'USER',
      entityId: payload.userId,
      action: 'UPDATE',
      afterState: { roleName: payload.roleName, enabledCodes },
    });

    res.status(200).json({ success: true });
    return;
  }

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
