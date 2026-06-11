import type { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { hashPassword } from '../utils/password';
import { createTeacher } from '../services/teacher.service';
import { enforceLimits, incrementUsage } from '../services/subscription.service';
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

const assignedStudentsQuerySchema = z.object({
  classId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
});

const assignedExamPapersQuerySchema = z.object({
  examId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
});

const requireCurrentSchool = (req: Request) => {
  const schoolId = req.auth?.schoolId;
  if (!req.auth?.userId || !schoolId) {
    throw new HttpError(401, 'Authenticated school context is required');
  }
  return { userId: req.auth.userId, schoolId, role: req.auth.role };
};

const isSchoolAdminRole = (role?: string | null) => role === 'SCHOOL_ADMIN';

const getActiveTeacherForUser = async (schoolId: string, userId: string) => {
  const teacher = await prisma.teacherProfile.findFirst({
    where: { schoolId, userId, isActive: true },
    select: { id: true },
  });
  if (!teacher) throw new HttpError(403, 'Employee profile is not assigned to this workflow');
  return teacher;
};

const ensureClassSectionInAssignments = (
  assignments: Array<{ classId: string; sectionId: string | null }>,
  classId?: string,
  sectionId?: string,
) => {
  if (!classId) return;
  const allowed = assignments.some((assignment) => {
    if (assignment.classId !== classId) return false;
    return !sectionId || assignment.sectionId === null || assignment.sectionId === sectionId;
  });
  if (!allowed) throw new HttpError(403, 'Requested class/section is outside your assignment scope');
};

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
      school: { select: { id: true, name: true, code: true, status: true, domainUrl: true, subdomain: true } },
      teacherProfile: {
        select: {
          id: true,
          employeeNo: true,
          firstName: true,
          lastName: true,
          phone: true,
          address: true,
          roleName: true,
          photoUrl: true,
          isActive: true,
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, name: true } },
          classAssignments: {
            select: {
              id: true,
              class: { select: { id: true, name: true } },
              section: { select: { id: true, name: true } },
            },
          },
          subjectAssignments: {
            select: {
              id: true,
              subject: { select: { id: true, name: true, classId: true } },
            },
          },
        },
      },
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
    school: user.school,
    role,
    displayName,
    permissionCodes,
    teacherProfile: user.teacherProfile,
    employeeProfile: user.teacherProfile,
  });
};

export const listMyAssignedStudentsApi = async (req: Request, res: Response) => {
  const { userId, schoolId, role } = requireCurrentSchool(req);
  const query = assignedStudentsQuerySchema.parse(req.query);

  const whereBase = {
    schoolId,
    ...(query.classId ? { classId: query.classId } : {}),
    ...(query.sectionId ? { sectionId: query.sectionId } : {}),
    status: { not: 'DISABLED' as const },
  };

  const where = isSchoolAdminRole(role)
    ? whereBase
    : await (async () => {
        const teacher = await getActiveTeacherForUser(schoolId, userId);
        const assignments = await prisma.teacherClassAssignment.findMany({
          where: { teacherId: teacher.id },
          select: { classId: true, sectionId: true },
        });

        ensureClassSectionInAssignments(assignments, query.classId, query.sectionId);
        if (assignments.length === 0) {
          return { ...whereBase, id: { in: [] as string[] } };
        }

        return {
          ...whereBase,
          OR: assignments.map((assignment) => ({
            classId: assignment.classId,
            ...(assignment.sectionId ? { sectionId: assignment.sectionId } : {}),
          })),
        };
      })();

  const students = await prisma.student.findMany({
    where,
    orderBy: [{ classId: 'asc' }, { sectionId: 'asc' }, { rollNo: 'asc' }, { fullName: 'asc' }],
    select: {
      id: true,
      admissionNo: true,
      rollNo: true,
      fullName: true,
      photoUrl: true,
      status: true,
      classId: true,
      sectionId: true,
      academicSessionId: true,
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      academicSession: { select: { id: true, name: true, isActive: true } },
    },
  });

  res.status(200).json(students);
};

export const listMyExamPapersApi = async (req: Request, res: Response) => {
  const { userId, schoolId, role } = requireCurrentSchool(req);
  const query = assignedExamPapersQuerySchema.parse(req.query);

  const whereBase = {
    exam: {
      schoolId,
      ...(query.examId ? { id: query.examId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
    },
    ...(query.classId ? { classId: query.classId } : {}),
    ...(query.subjectId ? { subjectId: query.subjectId } : {}),
  };

  const where = isSchoolAdminRole(role)
    ? whereBase
    : await (async () => {
        const teacher = await getActiveTeacherForUser(schoolId, userId);
        const assignments = await prisma.assignSubject.findMany({
          where: { schoolId, teacherId: teacher.id },
          select: { classId: true, sectionId: true, subjectId: true },
        });

        ensureClassSectionInAssignments(assignments, query.classId, query.sectionId);
        if (query.subjectId && !assignments.some((item) => item.subjectId === query.subjectId)) {
          throw new HttpError(403, 'Requested subject is outside your assignment scope');
        }
        if (assignments.length === 0) {
          return { ...whereBase, id: { in: [] as string[] } };
        }

        return {
          ...whereBase,
          OR: assignments.map((assignment) => ({
            classId: assignment.classId,
            subjectId: assignment.subjectId,
            exam: { sectionId: assignment.sectionId },
          })),
        };
      })();

  const papers = await prisma.examPaper.findMany({
    where,
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      maxMarks: true,
      passMarks: true,
      weightage: true,
      scheduledAt: true,
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      exam: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          scheduledAt: true,
          resultPublishAt: true,
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      },
      _count: { select: { marks: true } },
    },
  });

  res.status(200).json(papers);
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
      notificationDeliveries: whatsapp.deliveries,
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
  await enforceLimits(schoolId, 'teachers');

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

  const whatsapp = await sendAccountCreatedWhatsapp({
    role: payload.roleName,
    schoolId,
    email: user.email,
    mobile: payload.phone ?? null,
    tempPassword,
    fullName: `${payload.firstName} ${payload.lastName}`.trim() || payload.email,
  });

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
  await incrementUsage(schoolId, 'teachers', 1);

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
    notificationDeliveries: whatsapp?.deliveries ?? null,
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
