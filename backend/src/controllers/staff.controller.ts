import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import type { Request, Response } from 'express';
import { Prisma, type RoleName, type StaffAttendanceStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { hashPassword } from '../utils/password';
import { logAudit } from '../utils/audit';
import { uploadBuffer } from '../services/s3.service';

const staffRoles = ['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'] as const;
const attendanceStatuses = ['PRESENT', 'LATE', 'ABSENT', 'HOLIDAY', 'HALF_DAY', 'LEAVE'] as const;

const requireSchoolAdmin = (req: Request) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');
  if (req.auth.role !== 'SCHOOL_ADMIN' || !req.auth.schoolId) {
    throw new HttpError(403, 'Only School Admin can manage staff');
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

const staffPayloadSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  roleName: z.enum(staffRoles).default('TEACHER'),
  employeeNo: z.string().trim().min(1).max(80).optional().nullable(),
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
  photoUrl: z.string().trim().url().optional().nullable(),
  drivingLicense: z.string().trim().max(120).optional().nullable(),
  currentAddress: z.string().trim().max(1000).optional().nullable(),
  permanentAddress: z.string().trim().max(1000).optional().nullable(),
  qualifications: z.string().trim().max(1000).optional().nullable(),
  experience: z.string().trim().max(1000).optional().nullable(),
  maritalStatus: z.string().trim().max(40).optional().nullable(),
  bankDetails: bankDetailsSchema,
  payrollInfo: payrollInfoSchema,
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

const formatStaff = (staff: any) => ({
  ...staff,
  role: staff.user?.roles?.[0]?.role?.name ?? staff.roleName,
  staffNo: staff.employeeNo,
  fullName: `${staff.firstName ?? ''} ${staff.lastName ?? ''}`.trim(),
  bankInfo: staff.bankDetails ?? null,
});

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

export const listDepartments = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
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
    ...(query.role ? { user: { roles: { some: { role: { name: query.role } } } } } : {}),
    ...(query.staffId ? { employeeNo: { contains: query.staffId, mode: 'insensitive' } } : {}),
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
            { employeeNo: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search, mode: 'insensitive' } },
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
  res.status(200).json({ items: items.map(formatStaff), page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) });
};

export const createStaff = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  const payload = staffPayloadSchema.parse(req.body);
  await assertDepartmentScope(schoolId, payload.departmentId, payload.designationId);

  const existing = await prisma.user.findFirst({ where: { schoolId, email: payload.email }, select: { id: true } });
  if (existing) throw new HttpError(409, 'Staff email already exists in this school');

  const role = await prisma.role.upsert({ where: { name: payload.roleName }, update: {}, create: { name: payload.roleName } });
  const tempPassword = payload.password ?? crypto.randomBytes(9).toString('base64url');
  const passwordHash = await hashPassword(tempPassword);

  const result = await prisma.$transaction(async (tx) => {
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

    const staff = await tx.teacherProfile.create({
      data: {
        schoolId,
        userId: user.id,
        roleName: payload.roleName,
        employeeNo: normalizeNullable(payload.employeeNo),
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
    await upsertBankDetails(tx, staff.id, payload.bankDetails);
    await upsertPayrollInfo(tx, staff.id, payload.payrollInfo);
    await replaceSocialLinks(tx, staff.id, payload.socialLinks);
    return { user, staff };
  });

  await logAudit(req, {
    schoolId,
    entityType: 'STAFF',
    entityId: result.staff.id,
    action: 'CREATE',
    afterState: { email: result.user.email, roleName: payload.roleName, actorId: userId },
  });

  const staff = await prisma.teacherProfile.findFirst({ where: { id: result.staff.id, schoolId }, include: staffInclude });
  res.status(201).json({ staff: formatStaff(staff), tempPassword: payload.password ? null : tempPassword });
};

export const getStaff = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const staff = await prisma.teacherProfile.findFirst({
    where: { schoolId, OR: [{ id: req.params.id }, { userId: req.params.id }] },
    include: {
      ...staffInclude,
      documents: { orderBy: { createdAt: 'desc' } },
      timelines: { orderBy: { timelineAt: 'desc' } },
      payrolls: { include: { earningRows: true, deductionRows: true, payments: true }, orderBy: [{ year: 'desc' }, { month: 'desc' }] },
    },
  });
  if (!staff) throw new HttpError(404, 'Staff not found');
  res.status(200).json(formatStaff(staff));
};

export const updateStaff = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const payload = staffUpdateSchema.parse(req.body);
  await assertDepartmentScope(schoolId, payload.departmentId, payload.designationId);
  const existing = await prisma.teacherProfile.findFirst({ where: { id: req.params.id, schoolId }, include: { user: true } });
  if (!existing) throw new HttpError(404, 'Staff not found');

  const updated = await prisma.$transaction(async (tx) => {
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
    await replaceSocialLinks(tx, existing.id, payload.socialLinks);
    return staff;
  });

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
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
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
  if (!req.file) throw new HttpError(400, 'No file uploaded');
  const ext = path.extname(req.file.originalname);
  const name = `${crypto.randomUUID()}${ext || ''}`;
  const key = `schools/${schoolId}/staff/${staff.id}/documents/${name}`;
  const uploaded = await uploadBuffer({ key, body: req.file.buffer, contentType: req.file.mimetype });
  const doc = await prisma.staffDocument.create({
    data: { schoolId, staffId: staff.id, title, fileUrl: uploaded.url, fileName: req.file.originalname, fileType: req.file.mimetype, uploadedById: userId },
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
});

export const loadStaffAttendance = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const query = staffAttendanceQuery.parse(req.query);
  const date = dayStart(query.date);
  const staffWhere: Prisma.TeacherProfileWhereInput = {
    schoolId,
    isActive: true,
    ...(query.staffId ? { id: query.staffId } : {}),
    ...(query.role ? { user: { roles: { some: { role: { name: query.role } } } } } : {}),
  };
  const [staff, attendance, holiday] = await Promise.all([
    prisma.teacherProfile.findMany({ where: staffWhere, include: staffInclude, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }] }),
    prisma.staffAttendance.findMany({ where: { schoolId, attendanceDate: date } }),
    prisma.staffAttendanceHoliday.findFirst({ where: { schoolId, holidayDate: date, roleName: query.role ?? null } }),
  ]);
  const byStaff = new Map(attendance.map((item) => [item.staffId, item]));
  res.status(200).json({
    date: query.date,
    holiday,
    staff: staff.map((item) => {
      const row = byStaff.get(item.id);
      return { ...formatStaff(item), status: row?.status ?? 'PRESENT', note: row?.note ?? '', attendanceId: row?.id ?? null };
    }),
  });
};

export const saveStaffAttendance = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  const payload = z.object({
    role: z.enum(staffRoles).optional().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    markHoliday: z.boolean().optional().default(false),
    holidayReason: z.string().max(500).optional().nullable(),
    records: z.array(z.object({ staffId: z.string().uuid(), status: z.enum(attendanceStatuses), note: z.string().max(500).optional().nullable() })).default([]),
  }).parse(req.body);
  const date = dayStart(payload.date);
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
        where: { schoolId_staffId_attendanceDate: { schoolId, staffId: record.staffId, attendanceDate: date } },
        update: { status: record.status, note: normalizeNullable(record.note), markedById: userId },
        create: { schoolId, staffId: record.staffId, attendanceDate: date, status: record.status, note: normalizeNullable(record.note), markedById: userId },
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
  const [attendance, holidays] = await Promise.all([
    prisma.staffAttendance.findMany({ where: { schoolId, attendanceDate: { gte: start, lt: end }, staffId: { in: staff.map((item) => item.id) } } }),
    prisma.staffAttendanceHoliday.findMany({ where: { schoolId, holidayDate: { gte: start, lt: end }, roleName: query.role ?? null } }),
  ]);
  const holidayDays = new Set(holidays.map((holiday) => holiday.holidayDate.getUTCDate()));
  const attendanceByStaff = new Map<string, typeof attendance>();
  for (const item of attendance) {
    const rows = attendanceByStaff.get(item.staffId) ?? [];
    rows.push(item);
    attendanceByStaff.set(item.staffId, rows);
  }
  const rows = staff.map((item) => {
    const counts = { present: 0, late: 0, absent: 0, holiday: holidayDays.size, halfDay: 0, leave: 0 };
    const records = new Map((attendanceByStaff.get(item.id) ?? []).map((record) => [record.attendanceDate.getUTCDate(), record]));
    const daily: Array<{ day: number; status: string; note?: string | null }> = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      if (holidayDays.has(day)) {
        daily.push({ day, status: 'HOLIDAY' });
        continue;
      }
      const status = records.get(day)?.status ?? 'UNMARKED';
      if (status === 'PRESENT') counts.present += 1;
      if (status === 'LATE') counts.late += 1;
      if (status === 'ABSENT') counts.absent += 1;
      if (status === 'HOLIDAY') counts.holiday += 1;
      if (status === 'HALF_DAY') counts.halfDay += 1;
      if (status === 'LEAVE') counts.leave += 1;
      daily.push({ day, status, note: records.get(day)?.note ?? null });
    }
    const workingDays = Math.max(0, daysInMonth - holidayDays.size);
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
  res.status(200).json(staff.map((item) => ({ staff: formatStaff(item), payroll: item.payrolls[0] ?? null, status: item.payrolls[0] ? item.payrolls[0].status : 'NOT_GENERATED' })));
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
  res.status(200).json({ items: payrolls.map((item) => ({ ...item, staff: formatStaff(item.staff) })), totals });
};
