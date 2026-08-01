import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import type { Request, Response } from 'express';
import { Prisma, type AttendanceMode, type AttendanceUnitType, type RoleName, type StaffAttendanceStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { hashPassword } from '../utils/password';
import { logAudit } from '../utils/audit';
import { uploadBuffer } from '../services/s3.service';
import { enforceLimits, incrementUsage } from '../services/subscription.service';
import { attendanceReadService } from '../modules/attendance/services/attendance-read.service';
import { AuthorizationService } from '../services/authorization.service';
import { PermissionCodes as P } from '../permissions/permission-manifest';
import { sendAccountCreatedWhatsapp } from '../services/accountOnboardingWhatsapp.service';
import { resolveSchoolId } from '../utils/tenant';
import { isAllowedDocumentMimeType, validateUploadedDocumentFile } from '../utils/documentUploadValidation';

const staffRoles = ['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'] as const;
const attendanceStatuses = ['PRESENT', 'LATE', 'ABSENT', 'HOLIDAY', 'HALF_DAY', 'LEAVE', 'LOP', 'CASUAL_LEAVE'] as const;
const attendanceModes = ['DAILY', 'TWICE_DAILY', 'PERIOD_WISE'] as const;
const staffAttendanceUnitTypes = ['DAY', 'SLOT', 'PERIOD'] as const;
const defaultDepartments = ['Academics', 'Administration', 'Library', 'Accounts', 'Transport', 'Health & Safety', 'Operations', 'Support'];
const defaultDesignations = [
  'Principal',
  'Vice Principal',
  'Teacher',
  'Senior Teacher',
  'Academic Coordinator',
  'Librarian',
  'Assistant Librarian',
  'Accountant',
  'Fee Clerk',
  'Driver',
  'Transport Incharge',
  'Receptionist',
  'Nurse',
  'Security Guard',
  'Office Assistant',
  'Lab Assistant',
  'IT Support',
  'Hostel Warden',
];
const defaultLeaveTypes = [
  { name: 'Casual Leave', totalDays: 12 },
  { name: 'Sick Leave', totalDays: 10 },
  { name: 'Earned Leave', totalDays: 15 },
  { name: 'Emergency Leave', totalDays: 3 },
];
const defaultLeaveDays: Record<(typeof staffRoles)[number], Record<string, number>> = {
  SCHOOL_ADMIN: { 'Casual Leave': 15, 'Sick Leave': 10, 'Earned Leave': 18, 'Emergency Leave': 3 },
  TEACHER: { 'Casual Leave': 12, 'Sick Leave': 10, 'Earned Leave': 15, 'Emergency Leave': 3 },
  ACCOUNTANT: { 'Casual Leave': 12, 'Sick Leave': 10, 'Earned Leave': 15, 'Emergency Leave': 3 },
  LIBRARIAN: { 'Casual Leave': 12, 'Sick Leave': 10, 'Earned Leave': 15, 'Emergency Leave': 3 },
  STAFF: { 'Casual Leave': 10, 'Sick Leave': 8, 'Earned Leave': 12, 'Emergency Leave': 3 },
};
const staffTransactionOptions = { maxWait: 10000, timeout: 30000 } as const;

const rethrowStaffTransactionError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2028') {
    throw new HttpError(504, 'Employee save timed out while writing staff setup. Please try again.');
  }
  throw error;
};

const requireSchoolAdmin = (req: Request) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');
  if (!req.auth.schoolId) {
    throw new HttpError(403, 'School scope is required to manage staff');
  }
  return { schoolId: req.auth.schoolId, userId: req.auth.userId };
};

const dayStart = (value: string | Date) => {
  const date = value instanceof Date ? new Date(value) : new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Invalid date');
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const normalizeText = (value?: string | null) => {
  const trimmed = value?.trim().replace(/\s+/g, ' ');
  return trimmed || undefined;
};

const normalizeNullable = (value?: string | null) => normalizeText(value) ?? null;

const toDateKey = (value: Date) => value.toISOString().slice(0, 10);

const staffAttendanceUnitKey = (unitType: AttendanceUnitType, slotType?: 'MORNING' | 'AFTERNOON' | null, periodId?: string | null) => {
  if (unitType === 'SLOT') return `SLOT:${slotType ?? 'MORNING'}`;
  if (unitType === 'PERIOD') return `PERIOD:${periodId ?? 'UNKNOWN'}`;
  return 'DAY';
};

const isFutureDate = (date: Date) => date > dayStart(new Date());

const defaultStaffPeriods = [
  { name: '1ST PERIOD', startTime: '09:00', endTime: '09:45' },
  { name: '2ND PERIOD', startTime: '09:45', endTime: '10:30' },
  { name: '3RD PERIOD', startTime: '10:45', endTime: '11:30' },
  { name: '4TH PERIOD', startTime: '11:30', endTime: '12:15' },
  { name: '5TH PERIOD', startTime: '13:00', endTime: '13:45' },
  { name: '6TH PERIOD', startTime: '13:45', endTime: '14:30' },
  { name: '7TH PERIOD', startTime: '14:30', endTime: '15:15' },
];

const ensureStaffPeriods = async (schoolId: string) => {
  for (const period of defaultStaffPeriods) {
    await prisma.attendancePeriod.upsert({
      where: { schoolId_type_name: { schoolId, type: 'CLASS_TIME', name: period.name } },
      update: { startTime: period.startTime, endTime: period.endTime },
      create: { schoolId, type: 'CLASS_TIME', name: period.name, startTime: period.startTime, endTime: period.endTime },
    });
  }
  return prisma.attendancePeriod.findMany({ where: { schoolId, type: 'CLASS_TIME' }, orderBy: [{ startTime: 'asc' }] });
};

const resolveStaffAttendanceConfiguration = async (schoolId: string, roleName: RoleName | null, date: Date) => {
  const rows = await prisma.staffAttendanceConfiguration.findMany({
    where: {
      schoolId,
      isActive: true,
      effectiveFrom: { lte: date },
      AND: [
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }] },
        {
          OR: roleName
            ? [{ roleName }, { roleName: null }]
            : [{ roleName: null }],
        },
      ],
    },
    orderBy: [{ roleName: 'desc' }, { effectiveFrom: 'desc' }, { updatedAt: 'desc' }],
  });
  const selected = rows.find((row) => row.roleName === roleName) ?? rows.find((row) => row.roleName === null);
  return {
    id: selected?.id ?? null,
    mode: selected?.mode ?? 'TWICE_DAILY',
    source: selected ? (selected.roleName ? 'ROLE' : 'SCHOOL') : 'DEFAULT',
    configuration: selected ?? null,
  };
};

const resolveStaffAttendanceUnits = async (schoolId: string, mode: AttendanceMode) => {
  if (mode === 'TWICE_DAILY') {
    return [
      { unitType: 'SLOT', slotType: 'MORNING', label: 'Morning', unitKey: 'SLOT:MORNING' },
      { unitType: 'SLOT', slotType: 'AFTERNOON', label: 'Afternoon', unitKey: 'SLOT:AFTERNOON' },
    ];
  }
  if (mode === 'PERIOD_WISE') {
    const periods = await ensureStaffPeriods(schoolId);
    return periods.map((period) => ({
      unitType: 'PERIOD',
      periodId: period.id,
      label: period.name,
      startTime: period.startTime,
      endTime: period.endTime,
      unitKey: `PERIOD:${period.id}`,
    }));
  }
  return [{ unitType: 'DAY', label: 'Day', unitKey: 'DAY' }];
};

const parseSystemHolidays = (settings: { holidays: Prisma.JsonValue } | null, year: number, month?: number) => {
  const raw = Array.isArray(settings?.holidays) ? settings.holidays : [];
  const days: Array<{ day: number; title: string; details?: string | null; type?: string | null }> = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const from = typeof row.fromDate === 'string' ? dayStart(row.fromDate) : null;
    const to = typeof row.toDate === 'string' ? dayStart(row.toDate) : from;
    if (!from || !to) continue;
    for (let cursor = new Date(from); cursor <= to; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      if (cursor.getUTCFullYear() !== year) continue;
      if (month && cursor.getUTCMonth() + 1 !== month) continue;
      days.push({
        day: cursor.getUTCDate(),
        title: String(row.title ?? 'Holiday'),
        details: typeof row.details === 'string' ? row.details : null,
        type: typeof row.type === 'string' ? row.type : null,
      });
    }
  }
  return days;
};

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .nullable();

const moneySchema = z.coerce.number().min(0).max(999999999).optional().nullable();

const socialLinkSchema = z.object({
  platform: z.string().trim().min(1).max(50),
  url: z.string().trim().url().max(500),
});

const bankDetailsSchema = z
  .object({
    accountHolderName: z.string().trim().max(120).optional().nullable(),
    accountNumber: z.string().trim().max(40).optional().nullable(),
    ifscCode: z.string().trim().max(20).optional().nullable(),
    accountType: z.string().trim().max(40).optional().nullable(),
    bankName: z.string().trim().max(120).optional().nullable(),
    branchName: z.string().trim().max(120).optional().nullable(),
    panNumber: z.string().trim().max(20).optional().nullable(),
  })
  .optional();

const payrollInfoSchema = z
  .object({
    epfNo: z.string().trim().max(80).optional().nullable(),
    basicSalary: moneySchema,
    contractType: z.string().trim().max(80).optional().nullable(),
    paymentMode: z.string().trim().max(80).optional().nullable(),
  })
  .optional();

const leaveBalanceInputSchema = z.object({
  leaveTypeId: z.string().uuid(),
  totalDays: z.coerce.number().int().min(0).max(365),
});

const staffPayloadSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  roleName: z.enum(staffRoles).default('TEACHER'),
  employeeNo: z.preprocess(
    (value) => (typeof value === 'string' && !value.trim() ? null : value),
    z.string().trim().min(1).max(80).optional().nullable(),
  ),
  departmentId: z.string().uuid().optional().nullable(),
  designationId: z.string().uuid().optional().nullable(),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  fatherName: z.string().trim().max(120).optional().nullable(),
  motherName: z.string().trim().max(120).optional().nullable(),
  gender: z.string().trim().max(40).optional().nullable(),
  dateOfBirth: optionalDate,
  dateOfJoining: optionalDate,
  phone: z.string().trim().max(40).optional().nullable(),
  emergencyMobile: z.string().trim().max(40).optional().nullable(),
  photoUrl: z.string().trim().min(1).max(1000).optional().nullable(),
  drivingLicense: z.string().trim().max(120).optional().nullable(),
  currentAddress: z.string().trim().max(1000).optional().nullable(),
  permanentAddress: z.string().trim().max(1000).optional().nullable(),
  qualifications: z.string().trim().max(1000).optional().nullable(),
  experience: z.string().trim().max(1000).optional().nullable(),
  maritalStatus: z.string().trim().max(40).optional().nullable(),
  bankDetails: bankDetailsSchema,
  payrollInfo: payrollInfoSchema,
  leaveBalances: z.array(leaveBalanceInputSchema).max(20).optional(),
  socialLinks: z.array(socialLinkSchema).max(10).optional().default([]),
});

const staffUpdateSchema = staffPayloadSchema.partial().omit({ password: true });

const staffInclude = {
  user: { select: { id: true, email: true, status: true, roles: { select: { role: { select: { name: true } } } } } },
  department: true,
  designation: true,
  bankDetails: true,
  payrollInfo: true,
  socialLinks: true,
} satisfies Prisma.TeacherProfileInclude;

const canViewPayrollProjection = async (req: Request) => {
  if (!req.auth?.schoolId) return false;
  return AuthorizationService.hasAnyEffectivePermission(req.auth, [
    P.payrollView,
    P.payrollReport,
    P.payrollGenerate,
    P.payrollPay,
  ]);
};

const formatUserSummary = (user: any) =>
  user
    ? {
        id: user.id,
        email: user.email,
        status: user.status,
        roles: user.roles,
      }
    : user;

const formatLeaveBalances = (balances: any[] | undefined) =>
  balances?.map((balance: any) => ({
    ...balance,
    remainingDays: Math.max(0, Number(balance.totalDays ?? 0) - Number(balance.usedDays ?? 0)),
  }));

const formatStaff = (staff: any, options: { includeSensitive?: boolean } = {}) => {
  const safe = {
    id: staff.id,
    userId: staff.userId,
    schoolId: staff.schoolId,
    employeeNo: staff.employeeNo,
    staffNo: staff.employeeNo,
    firstName: staff.firstName,
    lastName: staff.lastName,
    fullName: `${staff.firstName ?? ''} ${staff.lastName ?? ''}`.trim(),
    roleName: staff.roleName,
    role: staff.user?.roles?.[0]?.role?.name ?? staff.roleName,
    phone: staff.phone,
    photoUrl: staff.photoUrl,
    department: staff.department ?? null,
    designation: staff.designation ?? null,
    user: formatUserSummary(staff.user),
    contact: {
      email: staff.user?.email ?? null,
      phone: staff.phone ?? null,
    },
    isActive: staff.isActive,
    createdAt: staff.createdAt,
    updatedAt: staff.updatedAt,
  };

  if (!options.includeSensitive) return safe;

  return {
    ...safe,
    fatherName: staff.fatherName ?? null,
    motherName: staff.motherName ?? null,
    gender: staff.gender ?? null,
    dateOfBirth: staff.dateOfBirth ?? null,
    dateOfJoining: staff.dateOfJoining ?? null,
    emergencyMobile: staff.emergencyMobile ?? null,
    drivingLicense: staff.drivingLicense ?? null,
    address: staff.address ?? null,
    currentAddress: staff.currentAddress ?? null,
    permanentAddress: staff.permanentAddress ?? null,
    qualifications: staff.qualifications ?? null,
    experience: staff.experience ?? null,
    maritalStatus: staff.maritalStatus ?? null,
    socialLinks: staff.socialLinks ?? [],
    documents: staff.documents,
    timelines: staff.timelines,
    leaveApplications: staff.leaveApplications,
    leaveBalances: formatLeaveBalances(staff.leaveBalances),
    payrolls: staff.payrolls,
    payrollInfo: staff.payrollInfo ?? null,
    bankDetails: staff.bankDetails ?? null,
    bankInfo: staff.bankDetails ?? null,
  };
};

const assertDepartmentScope = async (schoolId: string, departmentId?: string | null, designationId?: string | null) => {
  if (departmentId) {
    const department = await prisma.department.findFirst({ where: { id: departmentId, schoolId }, select: { id: true } });
    if (!department) throw new HttpError(404, 'Department not found');
  }
  if (designationId) {
    const designation = await prisma.designation.findFirst({ where: { id: designationId, schoolId }, select: { id: true } });
    if (!designation) throw new HttpError(404, 'Designation not found');
  }
};

const upsertBankDetails = async (tx: Prisma.TransactionClient, staffId: string, bankDetails?: z.infer<typeof bankDetailsSchema>) => {
  if (!bankDetails) return;
  const hasAny = Object.values(bankDetails).some((value) => Boolean(normalizeText(value ?? null)));
  if (!hasAny) return;
  await tx.teacherBankDetails.upsert({
    where: { teacherId: staffId },
    create: {
      teacherId: staffId,
      accountHolderName: normalizeNullable(bankDetails.accountHolderName),
      accountNumber: normalizeNullable(bankDetails.accountNumber),
      ifscCode: normalizeNullable(bankDetails.ifscCode),
      accountType: normalizeNullable(bankDetails.accountType),
      bankName: normalizeNullable(bankDetails.bankName),
      branchName: normalizeNullable(bankDetails.branchName),
      panNumber: normalizeNullable(bankDetails.panNumber),
    },
    update: {
      accountHolderName: normalizeNullable(bankDetails.accountHolderName),
      accountNumber: normalizeNullable(bankDetails.accountNumber),
      ifscCode: normalizeNullable(bankDetails.ifscCode),
      accountType: normalizeNullable(bankDetails.accountType),
      bankName: normalizeNullable(bankDetails.bankName),
      branchName: normalizeNullable(bankDetails.branchName),
      panNumber: normalizeNullable(bankDetails.panNumber),
    },
  });
};

const upsertPayrollInfo = async (tx: Prisma.TransactionClient, staffId: string, payrollInfo?: z.infer<typeof payrollInfoSchema>) => {
  if (!payrollInfo) return;
  await tx.staffPayrollInfo.upsert({
    where: { staffId },
    create: {
      staffId,
      epfNo: normalizeNullable(payrollInfo.epfNo),
      basicSalary: payrollInfo.basicSalary ?? null,
      contractType: normalizeNullable(payrollInfo.contractType),
      paymentMode: normalizeNullable(payrollInfo.paymentMode),
    },
    update: {
      epfNo: normalizeNullable(payrollInfo.epfNo),
      basicSalary: payrollInfo.basicSalary ?? null,
      contractType: normalizeNullable(payrollInfo.contractType),
      paymentMode: normalizeNullable(payrollInfo.paymentMode),
    },
  });
};

const replaceSocialLinks = async (tx: Prisma.TransactionClient, staffId: string, links?: Array<z.infer<typeof socialLinkSchema>>) => {
  if (!links) return;
  await tx.staffSocialLink.deleteMany({ where: { staffId } });
  if (links.length) {
    await tx.staffSocialLink.createMany({
      data: links.map((link) => ({ staffId, platform: link.platform, url: link.url })),
    });
  }
};

const syncStaffLeaveBalances = async (
  tx: Prisma.TransactionClient,
  schoolId: string,
  staffId: string,
  roleName: RoleName,
  balances?: Array<z.infer<typeof leaveBalanceInputSchema>>,
) => {
  const leaveTypes = await tx.leaveType.findMany({ where: { schoolId, isActive: true }, select: { id: true, name: true, totalDays: true } });
  if (!leaveTypes.length) return;

  const explicitBalances = Array.isArray(balances);
  const balanceByType = new Map((balances ?? []).map((balance) => [balance.leaveTypeId, balance.totalDays]));
  const defines = await tx.leaveDefine.findMany({ where: { schoolId, roleName }, select: { leaveTypeId: true, days: true } });
  const defineByType = new Map(defines.map((define) => [define.leaveTypeId, define.days]));

  for (const leaveType of leaveTypes) {
    if (explicitBalances && !balanceByType.has(leaveType.id)) continue;
    const totalDays = explicitBalances ? balanceByType.get(leaveType.id)! : defineByType.get(leaveType.id) ?? leaveType.totalDays;
    await tx.leaveBalance.upsert({
      where: { schoolId_staffId_leaveTypeId: { schoolId, staffId, leaveTypeId: leaveType.id } },
      create: { schoolId, staffId, leaveTypeId: leaveType.id, totalDays, usedDays: 0, extraTakenDays: 0 },
      update: { totalDays },
    });
  }
};

const employeeNoPrefix: Record<(typeof staffRoles)[number], string> = {
  SCHOOL_ADMIN: 'ADM',
  TEACHER: 'TCH',
  ACCOUNTANT: 'ACC',
  LIBRARIAN: 'LIB',
  STAFF: 'STF',
};

const cleanCodePart = (value?: string | null) => {
  const cleaned = String(value ?? 'SCH')
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()
    .slice(0, 10);
  return cleaned || 'SCH';
};

const generateEmployeeNo = async (tx: Prisma.TransactionClient, schoolId: string, roleName: RoleName) => {
  const school = await tx.school.findUnique({ where: { id: schoolId }, select: { code: true } });
  const codePart = cleanCodePart(school?.code);
  const prefix = employeeNoPrefix[roleName as (typeof staffRoles)[number]] ?? 'EMP';
  const existingCount = await tx.teacherProfile.count({ where: { schoolId } });

  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const candidate = `${codePart}-${prefix}-${String(existingCount + attempt).padStart(4, '0')}`;
    const exists = await tx.teacherProfile.findFirst({ where: { schoolId, employeeNo: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }

  return `${codePart}-${prefix}-${Date.now().toString().slice(-8)}`;
};

const createOfferLetterDocument = async (
  tx: Prisma.TransactionClient,
  params: { schoolId: string; staffId: string; employeeNo: string; uploadedById: string },
) => {
  const fileSafeEmployeeNo = params.employeeNo.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '') || 'employee';
  await tx.staffDocument.create({
    data: {
      schoolId: params.schoolId,
      staffId: params.staffId,
      title: 'Offer Letter',
      fileUrl: `/dashboard/staff/${params.staffId}/offer-letter`,
      fileName: `${fileSafeEmployeeNo}-offer-letter.html`,
      fileType: 'text/html',
      uploadedById: params.uploadedById,
    },
  });
};

export const seedStaffDefaults = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const [departments, designations] = await Promise.all([
    Promise.all(defaultDepartments.map((name) => prisma.department.upsert({ where: { schoolId_name: { schoolId, name } }, update: {}, create: { schoolId, name } }))),
    Promise.all(defaultDesignations.map((name) => prisma.designation.upsert({ where: { schoolId_name: { schoolId, name } }, update: {}, create: { schoolId, name } }))),
  ]);

  const leaveTypes = await Promise.all(
    defaultLeaveTypes.map((item) =>
      prisma.leaveType.upsert({
        where: { schoolId_name: { schoolId, name: item.name } },
        update: { totalDays: item.totalDays, isActive: true },
        create: { schoolId, name: item.name, totalDays: item.totalDays },
      }),
    ),
  );

  await Promise.all(
    staffRoles.flatMap((roleName) =>
      leaveTypes.map((leaveType) =>
        prisma.leaveDefine.upsert({
          where: { schoolId_roleName_leaveTypeId: { schoolId, roleName, leaveTypeId: leaveType.id } },
          update: { days: defaultLeaveDays[roleName][leaveType.name] ?? leaveType.totalDays },
          create: { schoolId, roleName, leaveTypeId: leaveType.id, days: defaultLeaveDays[roleName][leaveType.name] ?? leaveType.totalDays },
        }),
      ),
    ),
  );

  res.status(200).json({ departments, designations, leaveTypes });
};

export const listDepartments = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const items = await prisma.department.findMany({ where: { schoolId }, orderBy: { name: 'asc' } });
  res.status(200).json(items);
};

export const createDepartment = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const payload = z.object({ name: z.string().trim().min(1).max(120) }).parse(req.body);
  const item = await prisma.department.create({ data: { schoolId, name: payload.name } });
  res.status(201).json(item);
};

export const listDesignations = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const items = await prisma.designation.findMany({ where: { schoolId }, orderBy: { name: 'asc' } });
  res.status(200).json(items);
};

export const createDesignation = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const payload = z.object({ name: z.string().trim().min(1).max(120) }).parse(req.body);
  const item = await prisma.designation.create({ data: { schoolId, name: payload.name } });
  res.status(201).json(item);
};

export const listStaff = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const query = z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      role: z.enum(staffRoles).optional(),
      staffId: z.string().optional(),
      search: z.string().optional(),
    })
    .parse(req.query);
  const where: Prisma.TeacherProfileWhereInput = {
    schoolId,
    ...(query.role ? { roleName: query.role } : {}),
    ...(query.staffId ? { employeeNo: { contains: query.staffId, mode: 'insensitive' } } : {}),
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
            { employeeNo: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search, mode: 'insensitive' } },
            { department: { name: { contains: query.search, mode: 'insensitive' } } },
            { designation: { name: { contains: query.search, mode: 'insensitive' } } },
            { user: { email: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    prisma.teacherProfile.findMany({ where, include: staffInclude, orderBy: { createdAt: 'desc' }, skip, take: query.limit }),
    prisma.teacherProfile.count({ where }),
  ]);
  const includeSensitive = await canViewPayrollProjection(req);
  res.status(200).json({
    items: items.map((item) => formatStaff(item, { includeSensitive })),
    page: query.page,
    limit: query.limit,
    total,
    pages: Math.ceil(total / query.limit),
  });
};

export const createStaff = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  const payload = staffPayloadSchema.parse(req.body);
  await assertDepartmentScope(schoolId, payload.departmentId, payload.designationId);
  await enforceLimits(schoolId, 'teachers');

  const existing = await prisma.user.findFirst({ where: { schoolId, email: payload.email }, select: { id: true } });
  if (existing) throw new HttpError(409, 'Staff email already exists in this school');
  const requestedEmployeeNo = normalizeNullable(payload.employeeNo);
  if (requestedEmployeeNo) {
    const duplicateEmployeeNo = await prisma.teacherProfile.findFirst({ where: { schoolId, employeeNo: requestedEmployeeNo }, select: { id: true } });
    if (duplicateEmployeeNo) throw new HttpError(409, 'Employee number already exists in this school');
  }

  const role = await prisma.role.upsert({ where: { name: payload.roleName }, update: {}, create: { name: payload.roleName } });
  const tempPassword = payload.password ?? crypto.randomBytes(9).toString('base64url');
  const passwordHash = await hashPassword(tempPassword);

  const result = await prisma
    .$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          schoolId,
          email: payload.email,
          passwordHash,
          status: 'ACTIVE',
          mustChangePassword: !payload.password,
          roles: { create: { roleId: role.id } },
        },
        select: { id: true, email: true, schoolId: true, status: true },
      });

      const employeeNo = requestedEmployeeNo ?? (await generateEmployeeNo(tx, schoolId, payload.roleName));
      const staff = await tx.teacherProfile.create({
        data: {
          schoolId,
          userId: user.id,
          roleName: payload.roleName,
          employeeNo,
          firstName: payload.firstName,
          lastName: payload.lastName,
          departmentId: payload.departmentId ?? null,
          designationId: payload.designationId ?? null,
          fatherName: normalizeNullable(payload.fatherName),
          motherName: normalizeNullable(payload.motherName),
          gender: normalizeNullable(payload.gender),
          dateOfBirth: payload.dateOfBirth ? dayStart(payload.dateOfBirth) : null,
          dateOfJoining: payload.dateOfJoining ? dayStart(payload.dateOfJoining) : null,
          phone: normalizeNullable(payload.phone),
          emergencyMobile: normalizeNullable(payload.emergencyMobile),
          photoUrl: normalizeNullable(payload.photoUrl),
          drivingLicense: normalizeNullable(payload.drivingLicense),
          address: normalizeNullable(payload.currentAddress),
          currentAddress: normalizeNullable(payload.currentAddress),
          permanentAddress: normalizeNullable(payload.permanentAddress),
          qualifications: normalizeNullable(payload.qualifications),
          experience: normalizeNullable(payload.experience),
          maritalStatus: normalizeNullable(payload.maritalStatus),
          isActive: true,
        },
      });
      await createOfferLetterDocument(tx, { schoolId, staffId: staff.id, employeeNo, uploadedById: userId });
      await upsertBankDetails(tx, staff.id, payload.bankDetails);
      await upsertPayrollInfo(tx, staff.id, payload.payrollInfo);
      await syncStaffLeaveBalances(tx, schoolId, staff.id, payload.roleName, payload.leaveBalances);
      await replaceSocialLinks(tx, staff.id, payload.socialLinks);
      return { user, staff };
    }, staffTransactionOptions)
    .catch(rethrowStaffTransactionError);
  await incrementUsage(schoolId, 'teachers', 1);

  await logAudit(req, {
    schoolId,
    entityType: 'STAFF',
    entityId: result.staff.id,
    action: 'CREATE',
    afterState: { email: result.user.email, roleName: payload.roleName, actorId: userId },
  });

  const staff = await prisma.teacherProfile.findFirst({ where: { id: result.staff.id, schoolId }, include: staffInclude });
  const includeSensitive = await canViewPayrollProjection(req);
  const whatsapp = await sendAccountCreatedWhatsapp({
    role: payload.roleName,
    schoolId,
    email: result.user.email,
    mobile: result.staff.phone,
    tempPassword: payload.password ? null : tempPassword,
    fullName: `${result.staff.firstName} ${result.staff.lastName}`.trim(),
  });

  res.status(201).json({
    staff: formatStaff(staff, { includeSensitive }),
    tempPassword: payload.password ? null : tempPassword,
    whatsappSentTo: whatsapp.sentTo,
    manualShareRequired: whatsapp.manualShareRequired,
    manualShareText: whatsapp.manualShareText,
    manualShareUrl: whatsapp.manualShareUrl,
    notificationDeliveries: whatsapp.deliveries,
  });
};

export const getStaff = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const staff = await prisma.teacherProfile.findFirst({
    where: { schoolId, OR: [{ id: req.params.id }, { userId: req.params.id }] },
    include: {
      ...staffInclude,
      documents: { orderBy: { createdAt: 'desc' } },
      timelines: { orderBy: { timelineAt: 'desc' } },
      leaveBalances: { include: { leaveType: true }, orderBy: { updatedAt: 'desc' } },
      leaveApplications: { include: { leaveType: true }, orderBy: { appliedAt: 'desc' }, take: 10 },
      payrolls: { include: { earningRows: true, deductionRows: true, payments: true }, orderBy: [{ year: 'desc' }, { month: 'desc' }] },
    },
  });
  if (!staff) throw new HttpError(404, 'Staff not found');
  const includeSensitive = await canViewPayrollProjection(req);
  res.status(200).json(formatStaff(staff, { includeSensitive }));
};

export const updateStaff = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const payload = staffUpdateSchema.parse(req.body);
  await assertDepartmentScope(schoolId, payload.departmentId, payload.designationId);
  const existing = await prisma.teacherProfile.findFirst({ where: { id: req.params.id, schoolId }, include: { user: true } });
  if (!existing) throw new HttpError(404, 'Staff not found');

  const updated = await prisma
    .$transaction(async (tx) => {
      if (payload.email && payload.email !== existing.user.email) {
        await tx.user.update({ where: { id: existing.userId }, data: { email: payload.email } });
      }
      if (payload.roleName && payload.roleName !== existing.roleName) {
        const role = await tx.role.upsert({ where: { name: payload.roleName }, update: {}, create: { name: payload.roleName } });
        await tx.userRole.deleteMany({ where: { userId: existing.userId } });
        await tx.userRole.create({ data: { userId: existing.userId, roleId: role.id } });
      }
      const staff = await tx.teacherProfile.update({
        where: { id: existing.id },
        data: {
          roleName: payload.roleName ?? undefined,
          employeeNo: payload.employeeNo === undefined ? undefined : normalizeNullable(payload.employeeNo),
          firstName: payload.firstName ?? undefined,
          lastName: payload.lastName ?? undefined,
          departmentId: payload.departmentId === undefined ? undefined : payload.departmentId,
          designationId: payload.designationId === undefined ? undefined : payload.designationId,
          fatherName: payload.fatherName === undefined ? undefined : normalizeNullable(payload.fatherName),
          motherName: payload.motherName === undefined ? undefined : normalizeNullable(payload.motherName),
          gender: payload.gender === undefined ? undefined : normalizeNullable(payload.gender),
          dateOfBirth: payload.dateOfBirth === undefined ? undefined : payload.dateOfBirth ? dayStart(payload.dateOfBirth) : null,
          dateOfJoining: payload.dateOfJoining === undefined ? undefined : payload.dateOfJoining ? dayStart(payload.dateOfJoining) : null,
          phone: payload.phone === undefined ? undefined : normalizeNullable(payload.phone),
          emergencyMobile: payload.emergencyMobile === undefined ? undefined : normalizeNullable(payload.emergencyMobile),
          photoUrl: payload.photoUrl === undefined ? undefined : normalizeNullable(payload.photoUrl),
          drivingLicense: payload.drivingLicense === undefined ? undefined : normalizeNullable(payload.drivingLicense),
          address: payload.currentAddress === undefined ? undefined : normalizeNullable(payload.currentAddress),
          currentAddress: payload.currentAddress === undefined ? undefined : normalizeNullable(payload.currentAddress),
          permanentAddress: payload.permanentAddress === undefined ? undefined : normalizeNullable(payload.permanentAddress),
          qualifications: payload.qualifications === undefined ? undefined : normalizeNullable(payload.qualifications),
          experience: payload.experience === undefined ? undefined : normalizeNullable(payload.experience),
          maritalStatus: payload.maritalStatus === undefined ? undefined : normalizeNullable(payload.maritalStatus),
        },
      });
      await upsertBankDetails(tx, existing.id, payload.bankDetails);
      await upsertPayrollInfo(tx, existing.id, payload.payrollInfo);
      if (payload.leaveBalances !== undefined || payload.roleName) {
        await syncStaffLeaveBalances(tx, schoolId, existing.id, (payload.roleName ?? existing.roleName) as RoleName, payload.leaveBalances);
      }
      await replaceSocialLinks(tx, existing.id, payload.socialLinks);
      return staff;
    }, staffTransactionOptions)
    .catch(rethrowStaffTransactionError);

  res.status(200).json(updated);
};

export const deleteStaff = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const staff = await prisma.teacherProfile.findFirst({
    where: { id: req.params.id, schoolId },
    include: { payrolls: { select: { id: true }, take: 1 }, staffAttendances: { select: { id: true }, take: 1 } },
  });
  if (!staff) throw new HttpError(404, 'Staff not found');
  if (staff.payrolls.length || staff.staffAttendances.length) {
    throw new HttpError(409, 'Cannot delete staff with attendance or payroll history');
  }
  await prisma.teacherProfile.delete({ where: { id: staff.id } });
  res.status(200).json({ success: true });
};

const docUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (!isAllowedDocumentMimeType(file.mimetype)) {
      cb(new Error('Unsupported document type'));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const uploadStaffDocumentMiddleware = docUpload.single('file');

export const addStaffDocument = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  const staff = await prisma.teacherProfile.findFirst({ where: { id: req.params.id, schoolId }, select: { id: true } });
  if (!staff) throw new HttpError(404, 'Staff not found');
  const title = z.string().trim().min(1).max(160).parse(req.body.title ?? req.query.title);
  const documentNumber = z.string().trim().max(120).optional().nullable().parse(req.body.documentNumber ?? req.query.documentNumber);
  if (!req.file) throw new HttpError(400, 'No file uploaded');
  validateUploadedDocumentFile(req.file);
  const ext = path.extname(req.file.originalname);
  const name = `${crypto.randomUUID()}${ext || ''}`;
  const key = `schools/${schoolId}/staff/${staff.id}/documents/${name}`;
  const uploaded = await uploadBuffer({ key, body: req.file.buffer, contentType: req.file.mimetype });
  const doc = await prisma.staffDocument.create({
    data: { schoolId, staffId: staff.id, title, documentNumber: normalizeNullable(documentNumber), fileUrl: uploaded.url, fileName: req.file.originalname, fileType: req.file.mimetype, uploadedById: userId },
  });
  res.status(201).json(doc);
};

export const deleteStaffDocument = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const doc = await prisma.staffDocument.findFirst({ where: { id: req.params.documentId, staffId: req.params.id, schoolId } });
  if (!doc) throw new HttpError(404, 'Document not found');
  await prisma.staffDocument.delete({ where: { id: doc.id } });
  res.status(204).send();
};

export const addStaffTimeline = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  const payload = z.object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1000).optional().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional().default('00:00'),
  }).parse(req.body);
  const staff = await prisma.teacherProfile.findFirst({ where: { id: req.params.id, schoolId }, select: { id: true } });
  if (!staff) throw new HttpError(404, 'Staff not found');
  const item = await prisma.staffTimeline.create({
    data: {
      schoolId,
      staffId: staff.id,
      title: payload.title,
      description: normalizeNullable(payload.description),
      timelineAt: new Date(`${payload.date}T${payload.time}:00.000Z`),
      createdById: userId,
    },
  });
  res.status(201).json(item);
};

export const deleteStaffTimeline = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const item = await prisma.staffTimeline.findFirst({ where: { id: req.params.timelineId, staffId: req.params.id, schoolId } });
  if (!item) throw new HttpError(404, 'Timeline item not found');
  await prisma.staffTimeline.delete({ where: { id: item.id } });
  res.status(204).send();
};

const staffAttendanceQuery = z.object({
  role: z.enum(staffRoles).optional(),
  staffId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  unitType: z.enum(staffAttendanceUnitTypes).optional(),
  slotType: z.enum(['MORNING', 'AFTERNOON']).optional(),
  periodId: z.string().uuid().optional(),
});

const staffAttendanceConfigurationSchema = z.object({
  roleName: z.enum(staffRoles).optional().nullable(),
  mode: z.enum(attendanceModes),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

const staffAttendanceConfigurationListSchema = z.object({
  roleName: z.enum(staffRoles).optional(),
  active: z.coerce.boolean().optional(),
});

export const listStaffAttendanceConfigurations = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const query = staffAttendanceConfigurationListSchema.parse(req.query);
  const rows = await prisma.staffAttendanceConfiguration.findMany({
    where: {
      schoolId,
      ...(query.roleName ? { roleName: query.roleName } : {}),
      ...(typeof query.active === 'boolean' ? { isActive: query.active } : {}),
    },
    orderBy: [{ roleName: 'asc' }, { effectiveFrom: 'desc' }, { updatedAt: 'desc' }],
  });
  res.status(200).json(rows);
};

const assertStaffConfigurationRange = (effectiveFrom: Date, effectiveTo?: Date | null) => {
  if (effectiveTo && effectiveTo < effectiveFrom) throw new HttpError(400, 'effectiveTo cannot be earlier than effectiveFrom');
};

const assertNoStaffConfigurationOverlap = async (params: {
  schoolId: string;
  roleName?: RoleName | null;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  excludeId?: string;
}) => {
  const existing = await prisma.staffAttendanceConfiguration.findFirst({
    where: {
      schoolId: params.schoolId,
      roleName: params.roleName ?? null,
      isActive: true,
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
      effectiveFrom: { lte: params.effectiveTo ?? new Date('9999-12-31T00:00:00.000Z') },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: params.effectiveFrom } }],
    },
    select: { id: true },
  });
  if (existing) throw new HttpError(409, 'Staff attendance configuration overlaps with an existing active configuration');
};

export const createStaffAttendanceConfiguration = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  const payload = staffAttendanceConfigurationSchema.parse(req.body);
  const effectiveFrom = dayStart(payload.effectiveFrom);
  const effectiveTo = payload.effectiveTo ? dayStart(payload.effectiveTo) : null;
  assertStaffConfigurationRange(effectiveFrom, effectiveTo);
  await assertNoStaffConfigurationOverlap({ schoolId, roleName: payload.roleName ?? null, effectiveFrom, effectiveTo });
  const row = await prisma.staffAttendanceConfiguration.create({
    data: {
      schoolId,
      roleName: payload.roleName ?? null,
      mode: payload.mode,
      effectiveFrom,
      effectiveTo,
      isActive: payload.isActive,
      createdById: userId,
      updatedById: userId,
    },
  });
  res.status(201).json(row);
};

export const updateStaffAttendanceConfiguration = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  const payload = staffAttendanceConfigurationSchema.partial().parse(req.body);
  const existing = await prisma.staffAttendanceConfiguration.findFirst({ where: { id: req.params.id, schoolId } });
  if (!existing) throw new HttpError(404, 'Staff attendance configuration not found');
  const effectiveFrom = payload.effectiveFrom ? dayStart(payload.effectiveFrom) : existing.effectiveFrom;
  const effectiveTo = payload.effectiveTo === undefined ? existing.effectiveTo : payload.effectiveTo ? dayStart(payload.effectiveTo) : null;
  const roleName = payload.roleName === undefined ? existing.roleName : payload.roleName ?? null;
  assertStaffConfigurationRange(effectiveFrom, effectiveTo);
  if (payload.isActive !== false) {
    await assertNoStaffConfigurationOverlap({ schoolId, roleName, effectiveFrom, effectiveTo, excludeId: existing.id });
  }
  const row = await prisma.staffAttendanceConfiguration.update({
    where: { id: existing.id },
    data: {
      roleName,
      mode: payload.mode ?? existing.mode,
      effectiveFrom,
      effectiveTo,
      isActive: payload.isActive ?? existing.isActive,
      updatedById: userId,
    },
  });
  res.status(200).json(row);
};

export const deactivateStaffAttendanceConfiguration = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  const existing = await prisma.staffAttendanceConfiguration.findFirst({ where: { id: req.params.id, schoolId } });
  if (!existing) throw new HttpError(404, 'Staff attendance configuration not found');
  const row = await prisma.staffAttendanceConfiguration.update({
    where: { id: existing.id },
    data: { isActive: false, updatedById: userId },
  });
  res.status(200).json(row);
};

export const loadStaffAttendance = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const query = staffAttendanceQuery.parse(req.query);
  const date = dayStart(query.date);
  const configuration = await resolveStaffAttendanceConfiguration(schoolId, (query.role as RoleName | undefined) ?? null, date);
  const units = await resolveStaffAttendanceUnits(schoolId, configuration.mode);
  const requestedUnitKey = staffAttendanceUnitKey(
    (query.unitType as AttendanceUnitType | undefined) ?? (units[0]?.unitType as AttendanceUnitType | undefined) ?? 'DAY',
    query.slotType,
    query.periodId,
  );
  const selectedUnit = units.find((unit) => unit.unitKey === requestedUnitKey) ?? units[0];
  if (!selectedUnit) throw new HttpError(400, 'No staff attendance units are configured');
  const staffWhere: Prisma.TeacherProfileWhereInput = {
    schoolId,
    isActive: true,
    ...(query.staffId ? { id: query.staffId } : {}),
    ...(query.role ? { user: { roles: { some: { role: { name: query.role } } } } } : {}),
  };
  const [staff, attendanceSummary, holiday] = await Promise.all([
    prisma.teacherProfile.findMany({ where: staffWhere, include: staffInclude, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }] }),
    attendanceReadService.getTeacherAttendance({
      schoolId,
      teacherId: query.staffId,
      fromDate: date,
      toDate: date,
    }),
    attendanceReadService.getStaffAttendanceHoliday({ schoolId, holidayDate: date, roleName: query.role ?? null }),
  ]);
  const attendance = attendanceSummary.records.filter((item) => !item.unitKey || item.unitKey === selectedUnit.unitKey);
  const byStaff = new Map(attendance.map((item) => [item.teacherId, item]));
  res.status(200).json({
    date: query.date,
    configuration,
    units,
    selectedUnit,
    holiday,
    staff: staff.map((item) => {
      const row = byStaff.get(item.id);
      return { ...formatStaff(item), status: row?.status ?? 'PRESENT', note: row?.note ?? '', attendanceId: row?.sourceId ?? null };
    }),
  });
};

export const saveStaffAttendance = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  const payload = z.object({
    role: z.enum(staffRoles).optional().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    unitType: z.enum(staffAttendanceUnitTypes).optional().default('DAY'),
    slotType: z.enum(['MORNING', 'AFTERNOON']).optional().nullable(),
    periodId: z.string().uuid().optional().nullable(),
    markHoliday: z.boolean().optional().default(false),
    holidayReason: z.string().max(500).optional().nullable(),
    records: z.array(z.object({ staffId: z.string().uuid(), status: z.enum(attendanceStatuses), note: z.string().max(500).optional().nullable() })).default([]),
  }).parse(req.body);
  const date = dayStart(payload.date);
  const configuration = await resolveStaffAttendanceConfiguration(schoolId, (payload.role as RoleName | undefined) ?? null, date);
  const unitKey = staffAttendanceUnitKey(payload.unitType as AttendanceUnitType, payload.slotType, payload.periodId);
  const allowedUnits = await resolveStaffAttendanceUnits(schoolId, configuration.mode);
  const selectedUnit = allowedUnits.find((unit) => unit.unitKey === unitKey);
  if (!selectedUnit) throw new HttpError(400, 'Requested staff attendance unit is not valid for this role and date');
  if (isFutureDate(date) && payload.records.some((record) => record.status === 'PRESENT')) {
    throw new HttpError(400, 'Present attendance cannot be marked for future dates');
  }
  const staffIds = [...new Set(payload.records.map((item) => item.staffId))];
  if (staffIds.length) {
    const count = await prisma.teacherProfile.count({ where: { schoolId, id: { in: staffIds } } });
    if (count !== staffIds.length) throw new HttpError(400, 'One or more staff records are invalid');
  }
  const result = await prisma.$transaction(async (tx) => {
    if (payload.markHoliday) {
      const existingHoliday = await tx.staffAttendanceHoliday.findFirst({
        where: { schoolId, roleName: payload.role ?? null, holidayDate: date },
      });
      const holiday = existingHoliday
        ? await tx.staffAttendanceHoliday.update({
            where: { id: existingHoliday.id },
            data: { reason: normalizeNullable(payload.holidayReason), createdById: userId },
          })
        : await tx.staffAttendanceHoliday.create({
            data: { schoolId, roleName: payload.role ?? null, holidayDate: date, reason: normalizeNullable(payload.holidayReason), createdById: userId },
          });
      return { holiday, saved: 0 };
    }
    await tx.staffAttendanceHoliday.deleteMany({ where: { schoolId, holidayDate: date, roleName: payload.role ?? null } });
    for (const record of payload.records) {
      await tx.staffAttendance.upsert({
        where: { schoolId_staffId_attendanceDate_unitKey: { schoolId, staffId: record.staffId, attendanceDate: date, unitKey } },
        update: {
          mode: configuration.mode,
          unitType: payload.unitType as AttendanceUnitType,
          slotType: payload.unitType === 'SLOT' ? payload.slotType ?? null : null,
          periodId: payload.unitType === 'PERIOD' ? payload.periodId ?? null : null,
          status: record.status,
          note: normalizeNullable(record.note),
          markedById: userId,
        },
        create: {
          schoolId,
          staffId: record.staffId,
          attendanceDate: date,
          mode: configuration.mode,
          unitType: payload.unitType as AttendanceUnitType,
          slotType: payload.unitType === 'SLOT' ? payload.slotType ?? null : null,
          periodId: payload.unitType === 'PERIOD' ? payload.periodId ?? null : null,
          unitKey,
          status: record.status,
          note: normalizeNullable(record.note),
          markedById: userId,
        },
      });
    }
    return { holiday: null, saved: payload.records.length };
  });
  res.status(200).json(result);
};

const reportQuerySchema = z.object({
  role: z.enum(staffRoles).optional(),
  staffId: z.string().uuid().optional(),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

const buildAttendanceSummary = async (schoolId: string, query: z.infer<typeof reportQuerySchema>) => {
  const start = new Date(Date.UTC(query.year, query.month - 1, 1));
  const end = new Date(Date.UTC(query.year, query.month, 1));
  const daysInMonth = new Date(Date.UTC(query.year, query.month, 0)).getUTCDate();
  const staff = await prisma.teacherProfile.findMany({
    where: {
      schoolId,
      isActive: true,
      ...(query.staffId ? { id: query.staffId } : {}),
      ...(query.role ? { user: { roles: { some: { role: { name: query.role } } } } } : {}),
    },
    include: staffInclude,
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
  const [attendanceSummary, holidays, settings] = await Promise.all([
    attendanceReadService.getTeacherAttendance({
      schoolId,
      teacherId: query.staffId,
      fromDate: start,
      toDate: new Date(Date.UTC(query.year, query.month, 0)),
    }),
    attendanceReadService.getStaffAttendanceHolidays({ schoolId, fromDate: start, toDateExclusive: end, roleName: query.role ?? null }),
    prisma.schoolSystemSetting.findUnique({ where: { schoolId }, select: { holidays: true } }),
  ]);
  const attendance = attendanceSummary.records.map((record) => ({
    id: record.sourceId,
    staffId: record.teacherId,
    attendanceDate: dayStart(record.date),
    status: record.status,
    note: record.note,
    unitKey: record.unitKey ?? 'DAY',
    unitType: record.unitType ?? 'DAY',
    slotType: record.slotType ?? null,
    period: record.periodName ? { name: record.periodName } : null,
  }));
  const configuredHolidays = parseSystemHolidays(settings, query.year, query.month);
  const holidayByDay = new Map<number, { title: string; details?: string | null; type?: string | null }>();
  for (const holiday of configuredHolidays) {
    holidayByDay.set(holiday.day, { title: holiday.title, details: holiday.details, type: holiday.type });
  }
  for (const holiday of holidays) {
    holidayByDay.set(holiday.holidayDate.getUTCDate(), { title: holiday.reason ?? 'Staff Holiday', details: holiday.reason ?? null, type: 'Staff holiday' });
  }
  const holidayDays = new Set(holidayByDay.keys());
  const attendanceByStaff = new Map<string, typeof attendance>();
  for (const item of attendance) {
    const rows = attendanceByStaff.get(item.staffId) ?? [];
    rows.push(item);
    attendanceByStaff.set(item.staffId, rows);
  }
  const rows = staff.map((item) => {
    const counts = { present: 0, late: 0, absent: 0, holiday: holidayDays.size, halfDay: 0, leave: 0 };
    const recordsByDay = new Map<number, Array<(typeof attendance)[number]>>();
    for (const record of attendanceByStaff.get(item.id) ?? []) {
      const day = record.attendanceDate.getUTCDate();
      const bucket = recordsByDay.get(day) ?? [];
      bucket.push(record);
      recordsByDay.set(day, bucket);
    }
    const daily: Array<{ day: number; status: string; note?: string | null; units?: Array<{ unitKey: string; label: string; status: string; note?: string | null }>; holiday?: { title: string; details?: string | null; type?: string | null } | null }> = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      if (holidayDays.has(day)) {
        daily.push({ day, status: 'HOLIDAY', holiday: holidayByDay.get(day) ?? null });
        continue;
      }
      const dayRecords = recordsByDay.get(day) ?? [];
      const primary = dayRecords[0];
      const status = primary?.status ?? 'UNMARKED';
      for (const record of dayRecords) {
        if (record.status === 'PRESENT') counts.present += 1;
        if (record.status === 'LATE') counts.late += 1;
        if (record.status === 'ABSENT') counts.absent += 1;
        if (record.status === 'HOLIDAY') counts.holiday += 1;
        if (record.status === 'HALF_DAY') counts.halfDay += 1;
        if (record.status === 'LEAVE' || record.status === 'LOP' || record.status === 'CASUAL_LEAVE') counts.leave += 1;
      }
      daily.push({
        day,
        status,
        note: primary?.note ?? null,
        units: dayRecords.map((record) => ({
          unitKey: record.unitKey,
          label: record.period?.name ?? (record.slotType ? String(record.slotType).replace('_', ' ') : record.unitType),
          status: record.status,
          note: record.note,
        })),
      });
    }
    const unitDivisor = Math.max(1, Math.round((counts.present + counts.late + counts.absent + counts.halfDay + counts.leave) / Math.max(1, daysInMonth - holidayDays.size)));
    const workingDays = Math.max(0, daysInMonth - holidayDays.size) * unitDivisor;
    const attended = counts.present + counts.late + counts.halfDay * 0.5;
    return { staff: formatStaff(item), ...counts, percentage: workingDays ? Math.round((attended / workingDays) * 10000) / 100 : 0, daily };
  });
  return { daysInMonth, rows };
};

export const getStaffAttendanceReport = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const query = reportQuerySchema.parse(req.query);
  res.status(200).json(await buildAttendanceSummary(schoolId, query));
};

export const listPayroll = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const query = reportQuerySchema.parse(req.query);
  const staff = await prisma.teacherProfile.findMany({
    where: {
      schoolId,
      isActive: true,
      ...(query.staffId ? { id: query.staffId } : {}),
      ...(query.role ? { user: { roles: { some: { role: { name: query.role } } } } } : {}),
    },
    include: { ...staffInclude, payrolls: { where: { month: query.month, year: query.year }, include: { payments: true } } },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
  res.status(200).json(staff.map((item) => ({
    staff: formatStaff(item, { includeSensitive: true }),
    payroll: item.payrolls[0] ?? null,
    status: item.payrolls[0] ? item.payrolls[0].status : 'NOT_GENERATED',
  })));
};

const amountRowsSchema = z.array(z.object({ title: z.string().trim().min(1).max(120), amount: z.coerce.number().min(0) })).default([]);

export const generatePayroll = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  const payload = z.object({
    staffId: z.string().uuid(),
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2000).max(2100),
    basicSalary: z.coerce.number().min(0),
    earnings: amountRowsSchema,
    deductions: amountRowsSchema,
    tax: z.coerce.number().min(0).default(0),
    paymentMode: z.string().trim().max(80).optional().nullable(),
  }).parse(req.body);
  const staff = await prisma.teacherProfile.findFirst({ where: { id: payload.staffId, schoolId }, select: { id: true } });
  if (!staff) throw new HttpError(404, 'Staff not found');
  const earningTotal = payload.earnings.reduce((sum, item) => sum + item.amount, 0);
  const deductionTotal = payload.deductions.reduce((sum, item) => sum + item.amount, 0);
  const grossSalary = payload.basicSalary + earningTotal;
  const netSalary = Math.max(0, grossSalary - deductionTotal - payload.tax);
  const payslipNo = `PAY-${payload.year}${String(payload.month).padStart(2, '0')}-${payload.staffId.slice(0, 8).toUpperCase()}`;

  const payroll = await prisma.$transaction(async (tx) => {
    const row = await tx.payroll.upsert({
      where: { schoolId_staffId_month_year: { schoolId, staffId: payload.staffId, month: payload.month, year: payload.year } },
      update: {
        basicSalary: payload.basicSalary,
        earnings: earningTotal,
        deductions: deductionTotal,
        grossSalary,
        tax: payload.tax,
        netSalary,
        paymentMode: normalizeNullable(payload.paymentMode),
        status: 'GENERATED',
        generatedById: userId,
      },
      create: {
        schoolId,
        staffId: payload.staffId,
        month: payload.month,
        year: payload.year,
        payslipNo,
        basicSalary: payload.basicSalary,
        earnings: earningTotal,
        deductions: deductionTotal,
        grossSalary,
        tax: payload.tax,
        netSalary,
        paymentMode: normalizeNullable(payload.paymentMode),
        generatedById: userId,
      },
    });
    await tx.payrollEarning.deleteMany({ where: { payrollId: row.id } });
    await tx.payrollDeduction.deleteMany({ where: { payrollId: row.id } });
    if (payload.earnings.length) await tx.payrollEarning.createMany({ data: payload.earnings.map((item) => ({ payrollId: row.id, title: item.title, amount: item.amount })) });
    if (payload.deductions.length) await tx.payrollDeduction.createMany({ data: payload.deductions.map((item) => ({ payrollId: row.id, title: item.title, amount: item.amount })) });
    return row;
  });
  res.status(201).json(payroll);
};

export const payPayroll = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  const payload = z.object({
    method: z.string().trim().max(80).optional().nullable(),
    reference: z.string().trim().max(120).optional().nullable(),
    paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).parse(req.body);
  const payroll = await prisma.payroll.findFirst({ where: { id: req.params.id, schoolId } });
  if (!payroll) throw new HttpError(404, 'Payroll not found');
  const payment = await prisma.$transaction(async (tx) => {
    const row = await tx.payrollPayment.create({
      data: {
        schoolId,
        payrollId: payroll.id,
        amount: payroll.netSalary,
        method: normalizeNullable(payload.method),
        reference: normalizeNullable(payload.reference),
        paidAt: payload.paidAt ? dayStart(payload.paidAt) : new Date(),
        recordedById: userId,
      },
    });
    await tx.payroll.update({ where: { id: payroll.id }, data: { status: 'PAID', paidAt: row.paidAt, paymentMode: normalizeNullable(payload.method) } });
    return row;
  });
  res.status(201).json(payment);
};

export const getPayrollReport = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const query = reportQuerySchema.parse(req.query);
  const payrolls = await prisma.payroll.findMany({
    where: {
      schoolId,
      month: query.month,
      year: query.year,
      staff: {
        ...(query.staffId ? { id: query.staffId } : {}),
        ...(query.role ? { user: { roles: { some: { role: { name: query.role } } } } } : {}),
      },
    },
    include: { staff: { include: staffInclude }, earningRows: true, deductionRows: true, payments: true },
    orderBy: { payslipNo: 'asc' },
  });
  const totals = payrolls.reduce(
    (sum, item) => ({
      basicSalary: sum.basicSalary + Number(item.basicSalary),
      earnings: sum.earnings + Number(item.earnings),
      deductions: sum.deductions + Number(item.deductions),
      grossSalary: sum.grossSalary + Number(item.grossSalary),
      tax: sum.tax + Number(item.tax),
      netSalary: sum.netSalary + Number(item.netSalary),
    }),
    { basicSalary: 0, earnings: 0, deductions: 0, grossSalary: 0, tax: 0, netSalary: 0 },
  );
  res.status(200).json({
    items: payrolls.map((item) => ({ ...item, staff: formatStaff(item.staff, { includeSensitive: true }) })),
    totals,
  });
};
