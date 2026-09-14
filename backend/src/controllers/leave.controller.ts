import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import type { Request, Response } from 'express';
import { Prisma, type LeaveApplicationStatus, type LeaveRequestStatus, type RoleName } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { HttpError } from '../middlewares/error.middleware';
import { sendNotification } from '../services/notification.service';
import { uploadBuffer } from '../services/s3.service';
import { logAudit } from '../utils/audit';
import {
  parseOffsetPagination,
  setOffsetPaginationHeaders,
  toOffsetPageInfo,
} from '../utils/pagination';

const staffRoles = ['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'] as const;
const leaveStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
const studentLeaveStatuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;

const requireSchoolMember = (req: Request) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');
  if (!req.auth.schoolId || req.auth.role === 'SUPER_ADMIN' || !req.auth.role || !(staffRoles as readonly string[]).includes(req.auth.role)) {
    throw new HttpError(403, 'Only school staff can access leave management');
  }
  return { schoolId: req.auth.schoolId, userId: req.auth.userId, role: req.auth.role as RoleName };
};

const requireSchoolAdmin = (req: Request) => {
  const auth = requireSchoolMember(req);
  return auth;
};

const assertRequestedSchool = (req: Request, requested?: string | null) => {
  const auth = requireSchoolMember(req);
  if (requested && requested !== auth.schoolId) throw new HttpError(403, 'Tenant scope violation');
  return auth;
};

const normalizeText = (value?: string | null) => {
  const trimmed = value?.trim().replace(/\s+/g, ' ');
  return trimmed || undefined;
};

const normalizeNullable = (value?: string | null) => normalizeText(value) ?? null;

const dayStart = (value: string | Date) => {
  const date = value instanceof Date ? new Date(value) : new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Invalid date');
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const today = () => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const durationDays = (fromDate: Date, toDate: Date) => {
  if (toDate < fromDate) throw new HttpError(400, 'Leave to must be after or equal leave from');
  return Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
};

const enumerateDays = (fromDate: Date, toDate: Date) => {
  const dates: Date[] = [];
  const cursor = new Date(fromDate);
  while (cursor <= toDate) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
};

const leaveTypeSchema = z.object({
  schoolId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  totalDays: z.coerce.number().int().min(0).max(365),
});

const leaveDefineSchema = z.object({
  schoolId: z.string().uuid().optional(),
  roleName: z.enum(staffRoles),
  leaveTypeId: z.string().uuid(),
  days: z.coerce.number().int().min(0).max(365),
});

const applicationSchema = z.object({
  schoolId: z.string().uuid().optional(),
  leaveTypeId: z.string().uuid(),
  appliedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(3).max(1000),
});

const applicationUpdateSchema = applicationSchema.partial().extend({
  schoolId: z.string().uuid().optional(),
});

const listQuerySchema = z.object({
  schoolId: z.string().uuid().optional(),
  status: z.enum(leaveStatuses).optional(),
  roleName: z.enum(staffRoles).optional(),
  staffId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
  mine: z.coerce.boolean().optional(),
});

const statusSchema = z.object({
  schoolId: z.string().uuid().optional(),
  status: z.enum(leaveStatuses),
  note: z.string().trim().max(1000).optional().nullable(),
  reason: z.string().trim().max(1000).optional().nullable(),
});

const studentLeaveListSchema = z.object({
  schoolId: z.string().uuid().optional(),
  status: z.enum(studentLeaveStatuses).optional(),
  classId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
});

const studentLeaveStatusSchema = z.object({
  schoolId: z.string().uuid().optional(),
  status: z.enum(studentLeaveStatuses),
  note: z.string().trim().max(1000).optional().nullable(),
  reason: z.string().trim().max(1000).optional().nullable(),
});

const staffSelect = {
  id: true,
  schoolId: true,
  userId: true,
  employeeNo: true,
  firstName: true,
  lastName: true,
  roleName: true,
  phone: true,
  department: true,
  designation: true,
  user: { select: { id: true, email: true, status: true } },
} satisfies Prisma.TeacherProfileSelect;

const appInclude = {
  leaveType: true,
  staff: { select: staffSelect },
  attachments: { orderBy: { createdAt: 'desc' } },
  histories: { include: { changedBy: { select: { id: true, email: true } } }, orderBy: { createdAt: 'desc' } },
  reviewedBy: { select: { id: true, email: true } },
} satisfies Prisma.LeaveApplicationInclude;

const studentLeaveInclude = {
  student: {
    select: {
      id: true,
      admissionNo: true,
      rollNo: true,
      firstName: true,
      lastName: true,
      fullName: true,
      classId: true,
      sectionId: true,
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  },
  parent: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      user: { select: { id: true, email: true, status: true } },
    },
  },
  reviewedBy: { select: { id: true, email: true } },
} satisfies Prisma.StudentLeaveRequestInclude;

const formatStaff = (staff: any) => ({
  ...staff,
  user: staff.user
    ? {
        id: staff.user.id,
        email: staff.user.email,
        status: staff.user.status,
      }
    : staff.user,
  staffNo: staff.employeeNo,
  fullName: `${staff.firstName ?? ''} ${staff.lastName ?? ''}`.trim(),
});

const formatApplication = (application: any) => ({
  ...application,
  staff: application.staff ? formatStaff(application.staff) : undefined,
  duration: application.durationDays,
});

const skippedDaysArray = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      date: String(item.date ?? ''),
      reason: String(item.reason ?? 'Holiday'),
      type: String(item.type ?? 'HOLIDAY'),
    }))
    .filter((item) => item.date);
};

const formatStudentLeaveRequest = (request: Prisma.StudentLeaveRequestGetPayload<{ include: typeof studentLeaveInclude }>) => {
  const studentName = request.student.fullName || `${request.student.firstName ?? ''} ${request.student.lastName ?? ''}`.trim() || 'Student';
  const parentName = `${request.parent.firstName ?? ''} ${request.parent.lastName ?? ''}`.trim() || 'Parent';
  const classLabel = [request.student.class?.name, request.student.section?.name].filter(Boolean).join(' ');
  return {
    id: request.id,
    schoolId: request.schoolId,
    studentId: request.studentId,
    childId: request.studentId,
    studentName,
    childName: studentName,
    admissionNo: request.student.admissionNo,
    rollNo: request.student.rollNo,
    classId: request.student.classId,
    sectionId: request.student.sectionId,
    className: request.student.class?.name ?? null,
    sectionName: request.student.section?.name ?? null,
    classLabel,
    parentId: request.parentId,
    parentName,
    parentPhone: request.parent.phone,
    parentEmail: request.parent.email,
    parentUser: request.parent.user,
    leaveType: request.leaveType,
    fromDate: request.fromDate,
    toDate: request.toDate,
    requestedDays: request.requestedDays,
    workingDays: request.workingDays,
    skippedDays: skippedDaysArray(request.skippedDays),
    reason: request.reason,
    status: request.status,
    reviewedBy: request.reviewedBy,
    reviewedAt: request.reviewedAt,
    reviewNote: request.reviewNote,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
};

const getOwnStaffProfile = async (schoolId: string, userId: string) => {
  const staff = await prisma.teacherProfile.findFirst({
    where: { schoolId, userId, isActive: true },
    select: staffSelect,
  });
  if (!staff) throw new HttpError(404, 'Staff profile not found');
  return staff;
};

const assertLeaveType = async (schoolId: string, leaveTypeId: string) => {
  const leaveType = await prisma.leaveType.findFirst({ where: { id: leaveTypeId, schoolId, isActive: true } });
  if (!leaveType) throw new HttpError(404, 'Leave type not found');
  return leaveType;
};

const hasApprovedOverlap = async (params: {
  schoolId: string;
  staffId: string;
  fromDate: Date;
  toDate: Date;
  excludeId?: string;
}) => {
  const overlap = await prisma.leaveApplication.findFirst({
    where: {
      schoolId: params.schoolId,
      staffId: params.staffId,
      status: 'APPROVED',
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
      fromDate: { lte: params.toDate },
      toDate: { gte: params.fromDate },
    },
    select: { id: true },
  });
  return Boolean(overlap);
};

const buildLeaveAttachment = async (params: {
  file: Express.Multer.File;
  schoolId: string;
  applicationId: string;
  userId: string;
}): Promise<Prisma.LeaveAttachmentCreateWithoutLeaveApplicationInput> => {
  const ext = path.extname(params.file.originalname);
  const key = `schools/${params.schoolId}/leave/${params.applicationId}/${crypto.randomUUID()}${ext || ''}`;
  const uploaded = await uploadBuffer({ key, body: params.file.buffer, contentType: params.file.mimetype });
  return {
    fileUrl: uploaded.url,
    fileName: params.file.originalname,
    fileType: params.file.mimetype,
    sizeBytes: params.file.size,
    uploadedBy: { connect: { id: params.userId } },
  };
};

const getAllocatedDays = async (schoolId: string, roleName: RoleName, leaveType: { id: string; totalDays: number }) => {
  const define = await prisma.leaveDefine.findFirst({ where: { schoolId, roleName, leaveTypeId: leaveType.id } });
  return define?.days ?? leaveType.totalDays;
};

const computeBalances = async (schoolId: string, staff: { id: string; roleName: RoleName }) => {
  const [leaveTypes, defines, usedRows] = await Promise.all([
    prisma.leaveType.findMany({ where: { schoolId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.leaveDefine.findMany({ where: { schoolId, roleName: staff.roleName } }),
    prisma.leaveApplication.groupBy({
      by: ['leaveTypeId'],
      where: { schoolId, staffId: staff.id, status: 'APPROVED' },
      _sum: { durationDays: true },
    }),
  ]);
  const defineByType = new Map(defines.map((item) => [item.leaveTypeId, item.days]));
  const usedByType = new Map(usedRows.map((item) => [item.leaveTypeId, item._sum.durationDays ?? 0]));
  return leaveTypes.map((leaveType) => {
    const totalDays = defineByType.get(leaveType.id) ?? leaveType.totalDays;
    const usedDays = usedByType.get(leaveType.id) ?? 0;
    const extraTakenDays = Math.max(0, usedDays - totalDays);
    return {
      leaveType,
      totalDays,
      usedDays,
      remainingDays: Math.max(0, totalDays - usedDays),
      extraTakenDays,
    };
  });
};

const syncBalance = async (schoolId: string, staffId: string, leaveTypeId: string) => {
  const staff = await prisma.teacherProfile.findFirst({ where: { id: staffId, schoolId }, select: { id: true, roleName: true } });
  const leaveType = await prisma.leaveType.findFirst({ where: { id: leaveTypeId, schoolId } });
  if (!staff || !leaveType) return;
  const totalDays = await getAllocatedDays(schoolId, staff.roleName, leaveType);
  const used = await prisma.leaveApplication.aggregate({
    where: { schoolId, staffId, leaveTypeId, status: 'APPROVED' },
    _sum: { durationDays: true },
  });
  const usedDays = used._sum.durationDays ?? 0;
  await prisma.leaveBalance.upsert({
    where: { schoolId_staffId_leaveTypeId: { schoolId, staffId, leaveTypeId } },
    create: { schoolId, staffId, leaveTypeId, totalDays, usedDays, extraTakenDays: Math.max(0, usedDays - totalDays) },
    update: { totalDays, usedDays, extraTakenDays: Math.max(0, usedDays - totalDays) },
  });
};

const syncLeaveAttendance = async (application: { id: string; schoolId: string; staffId: string; fromDate: Date; toDate: Date }, status: LeaveApplicationStatus, actorId: string) => {
  const dates = enumerateDays(application.fromDate, application.toDate);
  const note = `Approved leave ${application.id}`;
  if (status !== 'APPROVED') {
    await prisma.staffAttendance.deleteMany({
      where: { schoolId: application.schoolId, staffId: application.staffId, attendanceDate: { in: dates }, status: 'LEAVE', note },
    });
    return;
  }
  await prisma.$transaction(
    dates.map((attendanceDate) =>
      prisma.staffAttendance.upsert({
        where: { schoolId_staffId_attendanceDate_unitKey: { schoolId: application.schoolId, staffId: application.staffId, attendanceDate, unitKey: 'DAY' } },
        create: { schoolId: application.schoolId, staffId: application.staffId, attendanceDate, unitKey: 'DAY', unitType: 'DAY', mode: 'DAILY', status: 'LEAVE', note, markedById: actorId },
        update: { status: 'LEAVE', note, markedById: actorId },
      }),
    ),
  );
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error('Unsupported attachment type'));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const leaveAttachmentUploadMiddleware = upload.single('file');

export const listLeaveTypes = async (req: Request, res: Response) => {
  const { schoolId } = assertRequestedSchool(req, z.string().uuid().optional().parse(req.query.schoolId));
  const items = await prisma.leaveType.findMany({ where: { schoolId }, orderBy: { name: 'asc' } });
  res.status(200).json(items);
};

export const createLeaveType = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const payload = leaveTypeSchema.parse(req.body);
  assertRequestedSchool(req, payload.schoolId);
  const item = await prisma.leaveType.create({ data: { schoolId, name: payload.name, totalDays: payload.totalDays } });
  await logAudit(req, { schoolId, entityType: 'LEAVE_TYPE', entityId: item.id, action: 'CREATE', afterState: { name: item.name, totalDays: item.totalDays } });
  res.status(201).json(item);
};

export const updateLeaveType = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const payload = leaveTypeSchema.partial().parse(req.body);
  assertRequestedSchool(req, payload.schoolId);
  const existing = await prisma.leaveType.findFirst({ where: { id: req.params.id, schoolId } });
  if (!existing) throw new HttpError(404, 'Leave type not found');
  const item = await prisma.leaveType.update({
    where: { id: existing.id },
    data: { name: payload.name ?? undefined, totalDays: payload.totalDays ?? undefined },
  });
  await logAudit(req, { schoolId, entityType: 'LEAVE_TYPE', entityId: item.id, action: 'UPDATE', beforeState: { name: existing.name, totalDays: existing.totalDays }, afterState: { name: item.name, totalDays: item.totalDays } });
  res.status(200).json(item);
};

export const deleteLeaveType = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const existing = await prisma.leaveType.findFirst({ where: { id: req.params.id, schoolId } });
  if (!existing) throw new HttpError(404, 'Leave type not found');
  const linked = await prisma.leaveApplication.count({ where: { schoolId, leaveTypeId: existing.id } });
  const defined = await prisma.leaveDefine.count({ where: { schoolId, leaveTypeId: existing.id } });
  if (linked || defined) throw new HttpError(409, 'Cannot delete leave type linked to leave definitions or applications');
  await prisma.leaveType.delete({ where: { id: existing.id } });
  await logAudit(req, { schoolId, entityType: 'LEAVE_TYPE', entityId: existing.id, action: 'DELETE', beforeState: { name: existing.name } });
  res.status(204).send();
};

export const listLeaveDefines = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const items = await prisma.leaveDefine.findMany({ where: { schoolId }, include: { leaveType: true }, orderBy: [{ roleName: 'asc' }, { createdAt: 'desc' }] });
  res.status(200).json(items);
};

export const createLeaveDefine = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const payload = leaveDefineSchema.parse(req.body);
  assertRequestedSchool(req, payload.schoolId);
  await assertLeaveType(schoolId, payload.leaveTypeId);
  const existing = await prisma.leaveDefine.findFirst({ where: { schoolId, roleName: payload.roleName, leaveTypeId: payload.leaveTypeId } });
  if (existing) throw new HttpError(409, 'Leave define already exists for this role and leave type');
  const item = await prisma.leaveDefine.create({ data: { schoolId, roleName: payload.roleName, leaveTypeId: payload.leaveTypeId, days: payload.days }, include: { leaveType: true } });
  res.status(201).json(item);
};

export const updateLeaveDefine = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const payload = leaveDefineSchema.partial().parse(req.body);
  assertRequestedSchool(req, payload.schoolId);
  const existing = await prisma.leaveDefine.findFirst({ where: { id: req.params.id, schoolId } });
  if (!existing) throw new HttpError(404, 'Leave define not found');
  if (payload.leaveTypeId) await assertLeaveType(schoolId, payload.leaveTypeId);
  if (payload.roleName || payload.leaveTypeId) {
    const duplicate = await prisma.leaveDefine.findFirst({
      where: { schoolId, roleName: payload.roleName ?? existing.roleName, leaveTypeId: payload.leaveTypeId ?? existing.leaveTypeId, id: { not: existing.id } },
    });
    if (duplicate) throw new HttpError(409, 'Leave define already exists for this role and leave type');
  }
  const item = await prisma.leaveDefine.update({
    where: { id: existing.id },
    data: { roleName: payload.roleName ?? undefined, leaveTypeId: payload.leaveTypeId ?? undefined, days: payload.days ?? undefined },
    include: { leaveType: true },
  });
  res.status(200).json(item);
};

export const deleteLeaveDefine = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const existing = await prisma.leaveDefine.findFirst({ where: { id: req.params.id, schoolId } });
  if (!existing) throw new HttpError(404, 'Leave define not found');
  await prisma.leaveDefine.delete({ where: { id: existing.id } });
  res.status(204).send();
};

export const listMyLeaveBalances = async (req: Request, res: Response) => {
  const { schoolId, userId } = assertRequestedSchool(req, z.string().uuid().optional().parse(req.query.schoolId));
  const staff = await getOwnStaffProfile(schoolId, userId);
  const balances = await computeBalances(schoolId, staff);
  res.status(200).json({ staff: formatStaff(staff), items: balances });
};

export const listLeaveApplications = async (req: Request, res: Response) => {
  const auth = assertRequestedSchool(req, z.string().uuid().optional().parse(req.query.schoolId));
  const query = listQuerySchema.parse(req.query);
  const pagination = parseOffsetPagination(req.query, { defaultLimit: 50, maxLimit: 100 });
  const isAdmin = !query.mine;
  const where: Prisma.LeaveApplicationWhereInput = {
    schoolId: auth.schoolId,
    ...(query.status ? { status: query.status } : {}),
    ...(isAdmin && query.staffId ? { staffId: query.staffId } : {}),
    ...(isAdmin && query.roleName ? { staff: { roleName: query.roleName } } : {}),
    ...(isAdmin && query.search
      ? {
          OR: [
            { staff: { firstName: { contains: query.search, mode: 'insensitive' } } },
            { staff: { lastName: { contains: query.search, mode: 'insensitive' } } },
            { staff: { employeeNo: { contains: query.search, mode: 'insensitive' } } },
            { staff: { user: { email: { contains: query.search, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };
  if (!isAdmin) {
    const staff = await getOwnStaffProfile(auth.schoolId, auth.userId);
    where.staffId = staff.id;
  }
  const [items, total] = await Promise.all([
    prisma.leaveApplication.findMany({
      where,
      include: appInclude,
      orderBy: [{ appliedAt: 'desc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.leaveApplication.count({ where }),
  ]);
  setOffsetPaginationHeaders(res, toOffsetPageInfo(pagination, total));
  res.status(200).json(items.map(formatApplication));
};

export const getLeaveApplication = async (req: Request, res: Response) => {
  const auth = assertRequestedSchool(req, z.string().uuid().optional().parse(req.query.schoolId));
  const application = await prisma.leaveApplication.findFirst({ where: { id: req.params.id, schoolId: auth.schoolId }, include: appInclude });
  if (!application) throw new HttpError(404, 'Leave application not found');
  if (String(req.query.mine) === 'true') {
    const staff = await getOwnStaffProfile(auth.schoolId, auth.userId);
    if (application.staffId !== staff.id) throw new HttpError(403, 'Forbidden');
  }
  const balances = await computeBalances(auth.schoolId, { id: application.staffId, roleName: application.staff.roleName });
  res.status(200).json({ ...formatApplication(application), balances });
};

export const createLeaveApplication = async (req: Request, res: Response) => {
  const auth = assertRequestedSchool(req, req.body.schoolId);
  const payload = applicationSchema.parse(req.body);
  const staff = await getOwnStaffProfile(auth.schoolId, auth.userId);
  const leaveType = await assertLeaveType(auth.schoolId, payload.leaveTypeId);
  const fromDate = dayStart(payload.fromDate);
  const toDate = dayStart(payload.toDate);
  const duration = durationDays(fromDate, toDate);
  if (await hasApprovedOverlap({ schoolId: auth.schoolId, staffId: staff.id, fromDate, toDate })) {
    throw new HttpError(409, 'Approved leave already overlaps this date range');
  }
  const appId = crypto.randomUUID();
  const attachment = req.file
    ? await buildLeaveAttachment({ file: req.file, schoolId: auth.schoolId, applicationId: appId, userId: auth.userId })
    : undefined;
  const application = await prisma.leaveApplication.create({
    data: {
      id: appId,
      schoolId: auth.schoolId,
      staffId: staff.id,
      leaveTypeId: leaveType.id,
      appliedAt: payload.appliedAt ? dayStart(payload.appliedAt) : today(),
      fromDate,
      toDate,
      durationDays: duration,
      reason: payload.reason.trim(),
      status: 'PENDING',
      ...(attachment ? { attachments: { create: attachment } } : {}),
      histories: { create: { schoolId: auth.schoolId, toStatus: 'PENDING', changedById: auth.userId, note: 'Leave applied' } },
    },
    include: appInclude,
  });
  await logAudit(req, { schoolId: auth.schoolId, entityType: 'LEAVE_APPLICATION', entityId: application.id, action: 'CREATE', afterState: { leaveTypeId: leaveType.id, durationDays: duration } });
  res.status(201).json(formatApplication(application));
};

export const updateLeaveApplication = async (req: Request, res: Response) => {
  const auth = assertRequestedSchool(req, req.body.schoolId);
  const payload = applicationUpdateSchema.parse(req.body);
  const existing = await prisma.leaveApplication.findFirst({ where: { id: req.params.id, schoolId: auth.schoolId }, include: { staff: true } });
  if (!existing) throw new HttpError(404, 'Leave application not found');
  if (String(req.query.mine) === 'true') {
    const staff = await getOwnStaffProfile(auth.schoolId, auth.userId);
    if (existing.staffId !== staff.id) throw new HttpError(403, 'Forbidden');
    if (existing.status !== 'PENDING') throw new HttpError(409, 'Only pending leave can be edited');
  }
  const leaveTypeId = payload.leaveTypeId ?? existing.leaveTypeId;
  await assertLeaveType(auth.schoolId, leaveTypeId);
  const fromDate = payload.fromDate ? dayStart(payload.fromDate) : existing.fromDate;
  const toDate = payload.toDate ? dayStart(payload.toDate) : existing.toDate;
  const duration = durationDays(fromDate, toDate);
  if (existing.status === 'APPROVED' && (await hasApprovedOverlap({ schoolId: auth.schoolId, staffId: existing.staffId, fromDate, toDate, excludeId: existing.id }))) {
    throw new HttpError(409, 'Approved leave already overlaps this date range');
  }
  const attachment = req.file
    ? await buildLeaveAttachment({ file: req.file, schoolId: auth.schoolId, applicationId: existing.id, userId: auth.userId })
    : undefined;
  const updated = await prisma.leaveApplication.update({
    where: { id: existing.id },
    data: {
      leaveTypeId,
      appliedAt: payload.appliedAt ? dayStart(payload.appliedAt) : undefined,
      fromDate,
      toDate,
      durationDays: duration,
      reason: payload.reason?.trim() ?? undefined,
      ...(attachment ? { attachments: { create: attachment } } : {}),
    },
    include: appInclude,
  });
  if (updated.status === 'APPROVED') {
    await syncLeaveAttendance(updated, updated.status, auth.userId);
    await syncBalance(auth.schoolId, updated.staffId, updated.leaveTypeId);
  }
  res.status(200).json(formatApplication(updated));
};

export const deleteLeaveApplication = async (req: Request, res: Response) => {
  const auth = assertRequestedSchool(req, z.string().uuid().optional().parse(req.query.schoolId));
  const existing = await prisma.leaveApplication.findFirst({ where: { id: req.params.id, schoolId: auth.schoolId } });
  if (!existing) throw new HttpError(404, 'Leave application not found');
  if (String(req.query.mine) === 'true') {
    const staff = await getOwnStaffProfile(auth.schoolId, auth.userId);
    if (existing.staffId !== staff.id) throw new HttpError(403, 'Forbidden');
    if (existing.status !== 'PENDING') throw new HttpError(409, 'Only pending leave can be deleted');
  }
  await prisma.leaveApplication.delete({ where: { id: existing.id } });
  await syncLeaveAttendance(existing, 'REJECTED', auth.userId);
  await syncBalance(auth.schoolId, existing.staffId, existing.leaveTypeId);
  res.status(204).send();
};

export const updateLeaveStatus = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  const payload = statusSchema.parse(req.body);
  assertRequestedSchool(req, payload.schoolId);
  const existing = await prisma.leaveApplication.findFirst({ where: { id: req.params.id, schoolId } });
  if (!existing) throw new HttpError(404, 'Leave application not found');
  if (payload.status === 'APPROVED' && (await hasApprovedOverlap({ schoolId, staffId: existing.staffId, fromDate: existing.fromDate, toDate: existing.toDate, excludeId: existing.id }))) {
    throw new HttpError(409, 'Approved leave already overlaps this date range');
  }
  const note = normalizeNullable(payload.note ?? payload.reason);
  const updated = await prisma.$transaction(async (tx) => {
    const app = await tx.leaveApplication.update({
      where: { id: existing.id },
      data: {
        status: payload.status,
        reviewedById: payload.status === 'PENDING' ? null : userId,
        reviewedAt: payload.status === 'PENDING' ? null : new Date(),
        reviewNote: note,
      },
      include: appInclude,
    });
    await tx.leaveStatusHistory.create({
      data: { schoolId, leaveApplicationId: existing.id, fromStatus: existing.status, toStatus: payload.status, note, changedById: userId },
    });
    return app;
  });
  await syncLeaveAttendance(updated, payload.status, userId);
  await syncBalance(schoolId, updated.staffId, updated.leaveTypeId);
  await logAudit(req, { schoolId, entityType: 'LEAVE_APPLICATION', entityId: updated.id, action: 'STATUS_CHANGE', beforeState: { status: existing.status }, afterState: { status: updated.status, note } });
  res.status(200).json(formatApplication(updated));
};

const hasApprovedStudentLeaveOverlap = async (params: {
  schoolId: string;
  studentId: string;
  fromDate: Date;
  toDate: Date;
  excludeId?: string;
}) => {
  const overlap = await prisma.studentLeaveRequest.findFirst({
    where: {
      schoolId: params.schoolId,
      studentId: params.studentId,
      status: 'APPROVED',
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
      fromDate: { lte: params.toDate },
      toDate: { gte: params.fromDate },
    },
    select: { id: true },
  });
  return Boolean(overlap);
};

const notifyParentAboutStudentLeaveReview = async (
  request: Prisma.StudentLeaveRequestGetPayload<{ include: typeof studentLeaveInclude }>,
) => {
  const parentUserId = request.parent.user?.id;
  if (!parentUserId || request.status === 'PENDING') return;

  const studentName = request.student.fullName || `${request.student.firstName ?? ''} ${request.student.lastName ?? ''}`.trim() || 'Student';
  const statusText = request.status === 'APPROVED' ? 'approved' : 'rejected';
  const from = request.fromDate.toISOString().slice(0, 10);
  const to = request.toDate.toISOString().slice(0, 10);
  const body = `${studentName}'s ${request.leaveType} request from ${from} to ${to} was ${statusText}.`;

  try {
    await sendNotification({
      schoolId: request.schoolId,
      userId: request.reviewedById ?? null,
      channel: 'PUSH',
      data: {
        to: parentUserId,
        subject: 'Student leave request updated',
        body,
        recipientName: `${request.parent.firstName ?? ''} ${request.parent.lastName ?? ''}`.trim() || 'Parent',
        recipientType: 'PARENT',
        route: '/leave',
        module: 'leave',
        category: 'leave',
        priority: 'high',
        alertType: 'STUDENT_LEAVE_REVIEW',
        leaveRequestId: request.id,
        childId: request.studentId,
        childName: studentName,
        leaveType: request.leaveType,
        status: request.status,
        fromDate: from,
        toDate: to,
        reviewNote: request.reviewNote ?? '',
      },
    });
  } catch (error) {
    logger.warn({ err: error, leaveRequestId: request.id, parentUserId }, 'student leave review push failed');
  }
};

export const listStudentLeaveRequests = async (req: Request, res: Response) => {
  const auth = assertRequestedSchool(req, z.string().uuid().optional().parse(req.query.schoolId));
  const query = studentLeaveListSchema.parse(req.query);
  const pagination = parseOffsetPagination(req.query, { defaultLimit: 50, maxLimit: 100 });
  const where: Prisma.StudentLeaveRequestWhereInput = {
    schoolId: auth.schoolId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.classId || query.sectionId
      ? {
          student: {
            ...(query.classId ? { classId: query.classId } : {}),
            ...(query.sectionId ? { sectionId: query.sectionId } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { student: { firstName: { contains: query.search, mode: 'insensitive' } } },
            { student: { lastName: { contains: query.search, mode: 'insensitive' } } },
            { student: { fullName: { contains: query.search, mode: 'insensitive' } } },
            { student: { admissionNo: { contains: query.search, mode: 'insensitive' } } },
            { student: { rollNo: { contains: query.search, mode: 'insensitive' } } },
            { parent: { firstName: { contains: query.search, mode: 'insensitive' } } },
            { parent: { lastName: { contains: query.search, mode: 'insensitive' } } },
            { parent: { email: { contains: query.search, mode: 'insensitive' } } },
            { leaveType: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.studentLeaveRequest.findMany({
      where,
      include: studentLeaveInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.studentLeaveRequest.count({ where }),
  ]);
  setOffsetPaginationHeaders(res, toOffsetPageInfo(pagination, total));
  res.status(200).json(items.map(formatStudentLeaveRequest));
};

export const getStudentLeaveRequest = async (req: Request, res: Response) => {
  const auth = assertRequestedSchool(req, z.string().uuid().optional().parse(req.query.schoolId));
  const request = await prisma.studentLeaveRequest.findFirst({
    where: { id: req.params.id, schoolId: auth.schoolId },
    include: studentLeaveInclude,
  });
  if (!request) throw new HttpError(404, 'Student leave request not found');
  res.status(200).json(formatStudentLeaveRequest(request));
};

export const updateStudentLeaveStatus = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  const payload = studentLeaveStatusSchema.parse(req.body);
  assertRequestedSchool(req, payload.schoolId);
  const existing = await prisma.studentLeaveRequest.findFirst({ where: { id: req.params.id, schoolId } });
  if (!existing) throw new HttpError(404, 'Student leave request not found');
  if (payload.status === 'APPROVED' && (await hasApprovedStudentLeaveOverlap({ schoolId, studentId: existing.studentId, fromDate: existing.fromDate, toDate: existing.toDate, excludeId: existing.id }))) {
    throw new HttpError(409, 'An approved leave request already overlaps this date range');
  }

  const note = normalizeNullable(payload.note ?? payload.reason);
  const updated = await prisma.studentLeaveRequest.update({
    where: { id: existing.id },
    data: {
      status: payload.status as LeaveRequestStatus,
      reviewedById: payload.status === 'PENDING' ? null : userId,
      reviewedAt: payload.status === 'PENDING' ? null : new Date(),
      reviewNote: note,
    },
    include: studentLeaveInclude,
  });
  await logAudit(req, { schoolId, entityType: 'STUDENT_LEAVE_REQUEST', entityId: updated.id, action: 'STATUS_CHANGE', beforeState: { status: existing.status }, afterState: { status: updated.status, note } });
  await notifyParentAboutStudentLeaveReview(updated);
  res.status(200).json(formatStudentLeaveRequest(updated));
};

export const deleteStudentLeaveRequest = async (req: Request, res: Response) => {
  const auth = assertRequestedSchool(req, z.string().uuid().optional().parse(req.query.schoolId));
  const existing = await prisma.studentLeaveRequest.findFirst({ where: { id: req.params.id, schoolId: auth.schoolId } });
  if (!existing) throw new HttpError(404, 'Student leave request not found');
  await prisma.studentLeaveRequest.delete({ where: { id: existing.id } });
  await logAudit(req, { schoolId: auth.schoolId, entityType: 'STUDENT_LEAVE_REQUEST', entityId: existing.id, action: 'DELETE', beforeState: { status: existing.status, studentId: existing.studentId } });
  res.status(204).send();
};

export const approveStudentLeaveRequest = async (req: Request, res: Response) => {
  req.body = { ...req.body, status: 'APPROVED' };
  return updateStudentLeaveStatus(req, res);
};

export const rejectStudentLeaveRequest = async (req: Request, res: Response) => {
  req.body = { ...req.body, status: 'REJECTED' };
  return updateStudentLeaveStatus(req, res);
};

export const approveLeaveApplication = async (req: Request, res: Response) => {
  req.body = { ...req.body, status: 'APPROVED' };
  return updateLeaveStatus(req, res);
};

export const rejectLeaveApplication = async (req: Request, res: Response) => {
  req.body = { ...req.body, status: 'REJECTED' };
  return updateLeaveStatus(req, res);
};
