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
  type ManagedEmployeeRole,
} from '../utils/employeePermissions';
import { sendAccountCreatedWhatsapp } from '../services/accountOnboardingWhatsapp.service';
import { AuthorizationService } from '../services/authorization.service';
import { PermissionCacheService } from '../services/permissionCache.service';
import { timetableReadService } from '../modules/timetable/services/timetable-read.service';
import { toLegacyClassRoutineRow } from '../modules/timetable/services/timetable-response-mapper';
import { PermissionCodes as P } from '../permissions/permission-manifest';
import { getSchoolProfilesByIds } from '../services/schoolProfile.service';

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

const updateMeProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(32).optional().nullable(),
});

const managedRoleSchema = z.enum(MANAGED_EMPLOYEE_ROLES);

const updateEmployeePermissionsSchema = z.object({
  roleName: managedRoleSchema,
  enabledCodes: z.array(z.string()).default([]),
  schoolId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  scopeCodes: z.array(z.string()).optional(),
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

const parseScopeCodes = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => parseScopeCodes(item));
  }
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

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
      mustChangePassword: true,
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
      ? await AuthorizationService.getEffectivePermissionCodesForUser(user.schoolId, user.id, role)
      : [];
  const schoolProfile = user.schoolId
    ? (await getSchoolProfilesByIds([user.schoolId]))[0] ?? null
    : null;

  res.status(200).json({
    id: user.id,
    email: user.email,
    mustChangePassword: user.mustChangePassword,
    schoolId: user.schoolId,
    school: user.school,
    role,
    displayName,
    permissionCodes,
    teacherProfile: user.teacherProfile,
    employeeProfile: user.teacherProfile,
    schoolProfile,
  });
};

export const updateMeProfile = async (req: Request, res: Response) => {
  const auth = requireCurrentSchool(req);
  const payload = updateMeProfileSchema.parse(req.body);

  const existing = await prisma.user.findFirst({
    where: { id: auth.userId, schoolId: auth.schoolId },
    select: {
      id: true,
      email: true,
      teacherProfile: { select: { id: true, isActive: true } },
    },
  });

  if (!existing?.teacherProfile?.isActive) {
    throw new HttpError(404, 'Employee profile not found');
  }

  const duplicate = await prisma.user.findFirst({
    where: {
      id: { not: auth.userId },
      schoolId: auth.schoolId,
      email: { equals: payload.email, mode: 'insensitive' },
    },
    select: { id: true },
  });
  if (duplicate) throw new HttpError(409, 'Email is already used by another account');

  await prisma.$transaction([
    prisma.user.update({
      where: { id: auth.userId },
      data: { email: payload.email },
    }),
    prisma.teacherProfile.update({
      where: { id: existing.teacherProfile.id },
      data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone?.trim() || null,
      },
    }),
  ]);

  await logAudit(req, {
    schoolId: auth.schoolId,
    entityType: 'USER_PROFILE',
    entityId: auth.userId,
    action: 'UPDATE',
    beforeState: { email: existing.email },
    afterState: { email: payload.email, firstName: payload.firstName, lastName: payload.lastName, phone: payload.phone ?? null },
  });

  return getMe(req, res);
};

export const getMyTimetableApi = async (req: Request, res: Response) => {
  const { userId, schoolId } = requireCurrentSchool(req);

  const teacher = await prisma.teacherProfile.findFirst({
    where: { schoolId, userId, isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!teacher) {
    return res.status(200).json({ teacher: null, periods: [], routines: [], weekends: [] });
  }

  const [periods, routines, settings, academicYear] = await Promise.all([
    timetableReadService.getLegacyTimePeriods({ schoolId, selectPublicFieldsOnly: true }),
    timetableReadService
      .getTeacherTimetable({ schoolId, teacherId: teacher.id, mode: 'modern' })
      .then((result) => result.slots.map((slot) => toLegacyClassRoutineRow(slot))),
    prisma.schoolSystemSetting.findUnique({
      where: { schoolId },
      select: { weekends: true },
    }),
    prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
      select: { id: true },
    }),
  ]);

  const defaultWeekends = [
    { id: 'saturday', name: 'Saturday', isWeekend: false },
    { id: 'sunday', name: 'Sunday', isWeekend: false },
    { id: 'monday', name: 'Monday', isWeekend: false },
    { id: 'tuesday', name: 'Tuesday', isWeekend: false },
    { id: 'wednesday', name: 'Wednesday', isWeekend: false },
    { id: 'thursday', name: 'Thursday', isWeekend: false },
    { id: 'friday', name: 'Friday', isWeekend: true },
  ];
  const weekends =
    settings && Array.isArray(settings.weekends) && settings.weekends.length
      ? (settings.weekends as Array<{ id: string; name: string; isWeekend: boolean }>)
      : defaultWeekends;

  return res.status(200).json({ teacher, periods, routines, weekends, activeAcademicYearId: academicYear?.id ?? null });
};

export const listMyAssignedClassesApi = async (req: Request, res: Response) => {
  const { userId, schoolId, role } = requireCurrentSchool(req);

  const fetchAllSchoolData = async () => {
    const [academicYears, classes, sections, subjects] = await Promise.all([
      prisma.academicYear.findMany({
        where: { schoolId },
        select: { id: true, name: true, isActive: true },
        orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
      }),
      prisma.class.findMany({
        where: { schoolId },
        select: { id: true, name: true, academicYearId: true },
        orderBy: { name: 'asc' },
      }),
      prisma.section.findMany({
        where: { schoolId },
        select: { id: true, name: true, classId: true, classSections: { select: { classId: true } } },
        orderBy: { name: 'asc' },
      }),
      prisma.assignSubject.findMany({
        where: { schoolId },
        include: {
          class: { select: { id: true, name: true, academicYearId: true } },
          section: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true, code: true, type: true, classId: true } },
          teacher: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
        },
        orderBy: [{ class: { name: 'asc' } }, { section: { name: 'asc' } }, { subject: { name: 'asc' } }],
      }),
    ]);
    return { academicYears, classes, sections, subjects };
  };

  // Admins and principals always see all school classes
  if (isSchoolAdminRole(role) || role === 'PRINCIPAL') {
    return res.status(200).json(await fetchAllSchoolData());
  }

  // For teachers: use the same class-section-subject assignments shown in
  // Academic Setup > Assign Multiple Subjects.
  const teacher = await prisma.teacherProfile.findFirst({
    where: { schoolId, userId, isActive: true },
    select: { id: true },
  });

  if (!teacher) {
    return res.status(200).json({ academicYears: [], classes: [], sections: [], subjects: [] });
  }

  const [subjectAssignments, classAssignments, classTeacherAssignments] = await Promise.all([
    prisma.assignSubject.findMany({
      where: { schoolId, teacherId: teacher.id },
      include: {
        class: { select: { id: true, name: true, academicYearId: true } },
        section: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true, type: true, classId: true } },
        teacher: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
      },
      orderBy: [{ class: { name: 'asc' } }, { section: { name: 'asc' } }, { subject: { name: 'asc' } }],
    }),
    prisma.teacherClassAssignment.findMany({
      where: { teacherId: teacher.id, class: { schoolId } },
      include: {
        class: { select: { id: true, name: true, academicYearId: true } },
        section: { select: { id: true, name: true } },
      },
      orderBy: [{ class: { name: 'asc' } }, { section: { name: 'asc' } }],
    }),
    prisma.classTeacher.findMany({
      where: { schoolId, teacherId: teacher.id },
      include: {
        class: { select: { id: true, name: true, academicYearId: true } },
        section: { select: { id: true, name: true } },
      },
      orderBy: [{ class: { name: 'asc' } }, { section: { name: 'asc' } }],
    }),
  ]);

  if (subjectAssignments.length === 0 && classAssignments.length === 0 && classTeacherAssignments.length === 0) {
    return res.status(200).json({ academicYears: [], classes: [], sections: [], subjects: [] });
  }

  const classMap = new Map<string, { id: string; name: string; academicYearId: string | null }>();
  const sectionMap = new Map<string, { id: string; name: string; classId: string }>();
  const classWideClassIds = new Set<string>();
  const addClass = (item: { id: string; name: string; academicYearId: string | null }) => {
    classMap.set(item.id, item);
  };
  const addSection = (classId: string, section?: { id: string; name: string } | null) => {
    if (section) sectionMap.set(`${classId}:${section.id}`, { ...section, classId });
  };

  for (const assignment of subjectAssignments) {
    addClass(assignment.class);
    addSection(assignment.classId, assignment.section);
  }
  for (const assignment of classAssignments) {
    addClass(assignment.class);
    if (assignment.section) addSection(assignment.classId, assignment.section);
    else classWideClassIds.add(assignment.classId);
  }
  for (const assignment of classTeacherAssignments) {
    addClass(assignment.class);
    addSection(assignment.classId, assignment.section);
  }

  if (classWideClassIds.size > 0) {
    const classIds = [...classWideClassIds];
    const classWideSections = await prisma.section.findMany({
      where: {
        schoolId,
        OR: [{ classId: { in: classIds } }, { classSections: { some: { classId: { in: classIds } } } }],
      },
      select: {
        id: true,
        name: true,
        classId: true,
        classSections: { where: { classId: { in: classIds } }, select: { classId: true } },
      },
      orderBy: { name: 'asc' },
    });

    for (const section of classWideSections) {
      const linkedClassIds = new Set<string>();
      if (section.classId && classWideClassIds.has(section.classId)) linkedClassIds.add(section.classId);
      for (const link of section.classSections) linkedClassIds.add(link.classId);
      for (const classId of linkedClassIds) addSection(classId, section);
    }
  }

  const academicYearIds = [...new Set([...classMap.values()].map((c) => c.academicYearId).filter(Boolean))] as string[];
  const academicYears = academicYearIds.length
    ? await prisma.academicYear.findMany({
        where: { schoolId, id: { in: academicYearIds } },
        select: { id: true, name: true, isActive: true },
        orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
      })
    : [];

  return res.status(200).json({
    academicYears,
    classes: [...classMap.values()],
    sections: [...sectionMap.values()].map((s) => ({
      id: s.id,
      name: s.name,
      classId: s.classId,
      classSections: [{ classId: s.classId }],
    })),
    subjects: subjectAssignments,
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
        const teacher = await prisma.teacherProfile.findFirst({
          where: { schoolId, userId, isActive: true },
          select: { id: true },
        });
        if (!teacher) return whereBase;

        const assignments = await prisma.teacherClassAssignment.findMany({
          where: { teacherId: teacher.id },
          select: { classId: true, sectionId: true },
        });

        // No explicit assignments: fall back to all school students (same as web admin)
        if (assignments.length === 0) return whereBase;

        ensureClassSectionInAssignments(assignments, query.classId, query.sectionId);

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

  const requesterRoles = await prisma.userRole.findMany({
    where: { userId: req.auth.userId },
    select: { role: { select: { name: true } } },
  });
  const requesterRoleNames = requesterRoles.map((entry) => entry.role.name);
  const requesterSchoolId = req.auth.schoolId ?? null;
  const isSelf = user.id === req.auth.userId;
  const isSuperAdmin = requesterRoleNames.includes('SUPER_ADMIN');
  const sameSchoolUser = Boolean(requesterSchoolId && user.schoolId === requesterSchoolId);
  const isSchoolAdmin = requesterRoleNames.includes('SCHOOL_ADMIN') && sameSchoolUser;
  const hasSettingsAccess = sameSchoolUser
    ? await AuthorizationService.hasAnyEffectivePermission(req.auth, P.settingsAccess)
    : false;

  if (!isSelf && !isSuperAdmin && !isSchoolAdmin && !hasSettingsAccess) {
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
  const validCodes = new Set(EMPLOYEE_PERMISSION_CATALOG.map((permission) => permission.code));
  const scopeCodes = parseScopeCodes(req.query.scopeCodes).filter((code) => validCodes.has(code));
  const scopedCodeSet = scopeCodes.length ? new Set(scopeCodes) : null;
  const planCodes = new Set(await AuthorizationService.getPlanPermissionCodesForSchool(schoolId));
  const enabledCodes = userId
    ? await AuthorizationService.getEffectivePermissionCodesForUser(schoolId, userId, roleName)
    : await AuthorizationService.getEffectivePermissionCodesForRole(schoolId, roleName);
  const allowedPermissions = planCodes.size
    ? EMPLOYEE_PERMISSION_CATALOG.filter((permission) => planCodes.has(permission.code) && (!scopedCodeSet || scopedCodeSet.has(permission.code)))
    : [];

  const subscription = await prisma.subscription.findUnique({
    where: { schoolId },
    select: { planName: true },
  });

  const [staffProfiles, roleUsers] = await Promise.all([
    prisma.teacherProfile.findMany({
      where: { schoolId, isActive: true, roleName },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        user: {
          select: { id: true, email: true, status: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({
      where: {
        schoolId,
        roles: { some: { role: { name: roleName } } },
        teacherProfile: null,
      },
      select: { id: true, email: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const employeeMap = new Map<
    string,
    {
      id: string;
      userId: string;
      staffProfileId: string | null;
      email: string;
      status: string;
      createdAt: Date;
      displayName: string;
    }
  >();

  for (const profile of staffProfiles) {
    employeeMap.set(profile.user.id, {
      id: profile.user.id,
      userId: profile.user.id,
      staffProfileId: profile.id,
      email: profile.user.email,
      status: profile.user.status,
      createdAt: profile.user.createdAt,
      displayName: `${profile.firstName} ${profile.lastName}`.trim() || profile.user.email,
    });
  }

  for (const user of roleUsers) {
    if (employeeMap.has(user.id)) continue;
    employeeMap.set(user.id, {
      id: user.id,
      userId: user.id,
      staffProfileId: null,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
      displayName: user.email,
    });
  }

  const employees = Array.from(employeeMap.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  res.status(200).json({
    roleName,
    planName: subscription?.planName ?? null,
    scopeCodes,
    employees,
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
  const planCodes = new Set(await AuthorizationService.getPlanPermissionCodesForSchool(schoolId));
  const scopeCodes = (payload.scopeCodes ?? []).filter((code) => validCodes.has(code) && planCodes.has(code));
  const targetCodes = scopeCodes.length ? scopeCodes : EMPLOYEE_PERMISSION_CATALOG.map((permission) => permission.code);
  const targetCodeSet = new Set(targetCodes);
  const enabledCodes = payload.enabledCodes.filter((code) => targetCodeSet.has(code) && validCodes.has(code) && planCodes.has(code));

  if (payload.userId) {
    const targetUser = await prisma.user.findFirst({
      where: {
        id: payload.userId,
        schoolId,
        OR: [
          { roles: { some: { role: { name: payload.roleName } } } },
          { teacherProfile: { isActive: true, roleName: payload.roleName } },
        ],
      },
      select: { id: true },
    });

    if (!targetUser) {
      throw new HttpError(404, 'Employee not found for selected role');
    }

    await prisma.$transaction(async (tx) => {
      await tx.employeeUserPermission.deleteMany({
        where: {
          schoolId,
          userId: payload.userId,
          ...(scopeCodes.length ? { permissionCode: { in: scopeCodes } } : {}),
        },
      });

      await tx.employeeUserPermission.createMany({
        data: targetCodes.map((permissionCode) => ({
          schoolId,
          userId: payload.userId!,
          permissionCode,
          enabled: enabledCodes.includes(permissionCode),
        })),
      });
    });

    await logAudit(req, {
      schoolId,
      entityType: 'USER',
      entityId: payload.userId,
      action: 'UPDATE',
      afterState: { roleName: payload.roleName, enabledCodes, scopeCodes },
    });

    await PermissionCacheService.invalidateUser(schoolId, payload.userId);

    res.status(200).json({ success: true });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.employeeRolePermission.deleteMany({
      where: {
        schoolId,
        roleName: payload.roleName,
        ...(scopeCodes.length ? { permissionCode: { in: scopeCodes } } : {}),
      },
    });

    await tx.employeeRolePermission.createMany({
      data: targetCodes.map((permissionCode) => ({
        schoolId,
        roleName: payload.roleName as ManagedEmployeeRole,
        permissionCode,
        enabled: enabledCodes.includes(permissionCode),
      })),
    });
  });

  await logAudit(req, {
    schoolId,
    entityType: 'USER',
    entityId: payload.roleName,
    action: 'UPDATE',
    afterState: { roleName: payload.roleName, enabledCodes, scopeCodes },
  });

  await PermissionCacheService.invalidateRole(schoolId, payload.roleName);

  res.status(200).json({ success: true });
};
