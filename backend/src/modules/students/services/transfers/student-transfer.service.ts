import type { Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import type { Prisma } from '@prisma/client';
import { StudentTransferRepository } from '../../repositories/transfer.repository';
import { HttpError } from '../../../../middlewares/error.middleware';
import { resolveSchoolId } from '../../../../utils/tenant';
import { enforceLimits } from '../../../../services/subscription.service';
import { StudentRepository } from '../../repositories/student.repository';
import { AuditLogService } from '../student-audit.service';
import path from 'path';
import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { buildQueryFingerprint, cacheKeys } from '../../../../services/cache/cache.keys';
import { rememberCache, setCacheHeader } from '../../../../services/cache/cache.service';
import { cacheTTL } from '../../../../services/cache/cache.ttl';
import { invalidateStudentCache, invalidateAttendanceCache } from '../../../../services/cache/cache.invalidation';

const requireSchoolAdmin = (req: Request) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');
  if (!req.auth.schoolId) {
    throw new HttpError(403, 'School scope is required to manage students');
  }
  return { schoolId: req.auth.schoolId, userId: req.auth.userId };
};

const normalizeText = (value?: string | null) => {
  const trimmed = value?.trim().replace(/\s+/g, ' ');
  return trimmed || undefined;
};

const nullableText = (value?: string | null) => normalizeText(value) ?? null;

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const safeDate = (value?: string | Date | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const ensureAcademicScope = async (schoolId: string, payload: { academicSessionId?: string | null; classId?: string | null; sectionId?: string | null }) => {
  if (payload.academicSessionId) {
    const year = await StudentTransferRepository.academicYear.findFirst({ where: { id: payload.academicSessionId, schoolId }, select: { id: true } });
    if (!year) throw new HttpError(404, 'Academic session not found');
  }
  if (payload.classId) {
    const cls = await StudentTransferRepository.class.findFirst({ where: { id: payload.classId, schoolId }, select: { id: true } });
    if (!cls) throw new HttpError(404, 'Class not found');
  }
  if (payload.sectionId) {
    const section = await StudentTransferRepository.section.findFirst({ where: { id: payload.sectionId, schoolId }, select: { id: true } });
    if (!section) throw new HttpError(404, 'Section not found');
  }
  if (payload.classId && payload.sectionId) {
    const link = await StudentTransferRepository.classSection.findFirst({ where: { schoolId, classId: payload.classId, sectionId: payload.sectionId }, select: { id: true } });
    if (!link) throw new HttpError(400, 'Section is not assigned to the selected class');
  }
};

const ensureRollIsUnique = async (
  schoolId: string,
  payload: { academicSessionId?: string | null; classId?: string | null; sectionId?: string | null; rollNo?: string | null },
  excludeStudentId?: string,
) => {
  const rollNo = normalizeText(payload.rollNo);
  if (!rollNo || !payload.academicSessionId || !payload.classId || !payload.sectionId) return;
  const existing = await StudentTransferRepository.studentEnrollment.findFirst({
    where: {
      schoolId,
      academicSessionId: payload.academicSessionId,
      classId: payload.classId,
      sectionId: payload.sectionId,
      rollNo,
      ...(excludeStudentId ? { studentId: { not: excludeStudentId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw new HttpError(409, 'Roll number already exists for this class, section, and session');
};

const createSchema = z.object({
  admissionNo: z.string().min(1),
  rollNo: z.string().optional(),
  academicSessionId: z.string().uuid().optional().nullable(),
  fullName: z.string().min(1),
  dob: z.coerce.date().optional(),
  gender: z.string().optional(),
  bloodGroup: z.string().optional(),
  religion: z.string().optional(),
  caste: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  admissionDate: z.coerce.date().optional(),
  category: z.string().optional(),
  height: z.coerce.number().positive().optional(),
  weight: z.coerce.number().positive().optional(),
  photoUrl: z.string().optional(),
  fatherName: z.string().optional(),
  fatherOccupation: z.string().optional(),
  fatherPhone: z.string().optional(),
  fatherPhotoUrl: z.string().optional(),
  motherName: z.string().optional(),
  motherOccupation: z.string().optional(),
  motherPhone: z.string().optional(),
  motherPhotoUrl: z.string().optional(),
  guardianName: z.string().optional(),
  guardianRelationship: z.string().optional(),
  guardianPhotoUrl: z.string().optional(),
  parentPhone: z.string().optional(),
  parentEmail: z.string().email().optional(),
  presentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  emergencyContact: z.string().optional(),
  medicalConditions: z.string().optional(),
  allergies: z.string().optional(),
  doctorContact: z.string().optional(),
  docBirthCert: z.string().optional(),
  docTransferCert: z.string().optional(),
  docAadhaar: z.string().optional(),
  docReportCard: z.string().optional(),
  classId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  schoolId: z.string().uuid().optional(),
  siblingIds: z.array(z.string().uuid()).optional(),
});

const updateSchema = z.object({
  admissionNo: z.string().min(1).optional(),
  rollNo: z.string().optional().nullable(),
  academicSessionId: z.string().uuid().optional().nullable(),
  fullName: z.string().min(1).optional(),
  dob: z.coerce.date().optional().nullable(),
  gender: z.string().optional().nullable(),
  bloodGroup: z.string().optional().nullable(),
  religion: z.string().optional().nullable(),
  caste: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  admissionDate: z.coerce.date().optional().nullable(),
  category: z.string().optional().nullable(),
  height: z.coerce.number().positive().optional().nullable(),
  weight: z.coerce.number().positive().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  fatherName: z.string().optional().nullable(),
  fatherOccupation: z.string().optional().nullable(),
  fatherPhone: z.string().optional().nullable(),
  fatherPhotoUrl: z.string().optional().nullable(),
  motherName: z.string().optional().nullable(),
  motherOccupation: z.string().optional().nullable(),
  motherPhone: z.string().optional().nullable(),
  motherPhotoUrl: z.string().optional().nullable(),
  guardianName: z.string().optional().nullable(),
  guardianRelationship: z.string().optional().nullable(),
  guardianPhotoUrl: z.string().optional().nullable(),
  parentPhone: z.string().optional().nullable(),
  parentEmail: z.string().email().optional().nullable(),
  presentAddress: z.string().optional().nullable(),
  permanentAddress: z.string().optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  medicalConditions: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  doctorContact: z.string().optional().nullable(),
  docBirthCert: z.string().optional().nullable(),
  docTransferCert: z.string().optional().nullable(),
  docAadhaar: z.string().optional().nullable(),
  docReportCard: z.string().optional().nullable(),
  classId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  schoolId: z.string().uuid().optional(),
  siblingIds: z.array(z.string().uuid()).optional(),
});

const documentSchema = z.object({
  title: z.string().min(1).max(160),
  url: z.string().min(1),
  fileName: z.string().max(255).optional().nullable(),
  mimeType: z.string().max(120).optional().nullable(),
  sizeBytes: z.coerce.number().int().positive().optional().nullable(),
});

const timelineSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000).optional().nullable(),
  timelineDate: z.coerce.date(),
});

const linkParentSchema = z.object({
  parentId: z.string().uuid(),
  schoolId: z.string().uuid().optional(),
});

const statusSchema = z.object({
  status: z.enum(['ENROLLED', 'TRANSFERRED', 'EXITED', 'DISABLED']),
  reason: z.string().min(1).optional(),
  schoolId: z.string().uuid().optional(),
});

const transferRequestSchema = z.object({
  toSchoolId: z.string().uuid(),
  reason: z.string().min(1).optional(),
  schoolId: z.string().uuid().optional(),
});

const transferDecisionSchema = z.object({
  reason: z.string().min(1).optional(),
  schoolId: z.string().uuid().optional(),
});

const photoSchema = z.object({
  url: z.string().min(1),
});

const importUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.csv', '.xlsx'].includes(ext)) return cb(null, true);
    return cb(new Error('Only CSV and Excel files are supported'));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadStudentImportMiddleware = importUpload.single('file');

const importSchema = z.object({
  academicSessionId: z.string().uuid(),
  classId: z.string().uuid(),
  sectionId: z.string().uuid(),
});

const normalizeImportKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeImportRows = (rows: Record<string, unknown>[]) =>
  rows.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeImportKey(key)] = String(value ?? '').trim();
    }
    return normalized;
  });

const loadStudentImportRows = async (file: Express.Multer.File) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.csv') {
    const content = file.buffer.toString('utf8');
    if (content.includes('\uFFFD')) throw new HttpError(400, 'CSV must be UTF-8 encoded');
    return normalizeImportRows(parse(content, { columns: true, skip_empty_lines: true, trim: true }));
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const headers = (sheet.getRow(1).values as unknown[])
    .slice(1)
    .map((value) => normalizeImportKey(String(value ?? '')));
  const rows: Record<string, unknown>[] = [];
  for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      const cell = row.getCell(index + 1);
      record[header] = cell.text || cell.value || '';
    });
    if (Object.values(record).some((value) => String(value ?? '').trim())) {
      rows.push(record);
    }
  }
  return normalizeImportRows(rows);
};

const buildStudentSampleCsv = () => {
  const headers = [
    'admission_no',
    'roll_no',
    'first_name',
    'last_name',
    'gender',
    'date_of_birth',
    'blood_group',
    'religion',
    'caste',
    'email',
    'phone',
    'admission_date',
    'category',
    'height',
    'weight',
    'father_name',
    'father_occupation',
    'father_phone',
    'mother_name',
    'mother_occupation',
    'mother_phone',
    'guardian_relation',
    'present_address',
    'permanent_address',
  ];
  const sample = [
    'ADM-1001',
    '1',
    'Aarav',
    'Sharma',
    'Male',
    '2012-04-12',
    'O+',
    'Hindu',
    'General',
    'aarav@example.com',
    '9000000010',
    '2026-06-01',
    'Regular',
    '145.5',
    '38.2',
    'Rohit Sharma',
    'Engineer',
    '9000000011',
    'Neha Sharma',
    'Teacher',
    '9000000012',
    'Father',
    'Present address line',
    'Permanent address line',
  ];
  return `${headers.join(',')}\n${sample.map((value) => `"${value}"`).join(',')}\n`;
};

const requiredImportFields = ['admission_no', 'roll_no', 'first_name', 'last_name', 'date_of_birth'];


export const listTransferTargets = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const schools = await StudentTransferRepository.school.findMany({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
      id: { not: schoolId },
    },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, code: true },
  });

  res.status(200).json(schools);
};

export const createTransferRequest = async (req: Request, res: Response) => {
  const payload = transferRequestSchema.parse(req.body);
  const fromSchoolId = resolveSchoolId(req, payload.schoolId);
  const { id } = req.params;

  const student = await StudentTransferRepository.student.findFirst({
    where: { id, schoolId: fromSchoolId },
    select: { id: true },
  });
  if (!student) {
    throw new HttpError(404, 'Student not found');
  }

  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const existing = await StudentTransferRepository.studentTransferRequest.findFirst({
    where: {
      studentId: id,
      status: 'PENDING',
    },
    select: { id: true },
  });
  if (existing) {
    throw new HttpError(409, 'Transfer request already pending');
  }

  const request = await StudentTransferRepository.studentTransferRequest.create({
    data: {
      studentId: id,
      fromSchoolId,
      toSchoolId: payload.toSchoolId,
      requestedById: req.auth.userId,
      reason: payload.reason ?? null,
      status: 'PENDING',
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
      fromSchool: { select: { id: true, name: true, code: true } },
      toSchool: { select: { id: true, name: true, code: true } },
    },
  });

  await AuditLogService.record(req, {
    schoolId: fromSchoolId,
    entityType: 'STUDENT_TRANSFER',
    entityId: request.id,
    action: 'REQUEST',
    afterState: {
      studentId: request.studentId,
      fromSchoolId: request.fromSchoolId,
      toSchoolId: request.toSchoolId,
      status: request.status,
      reason: request.reason,
    },
  });

  res.status(201).json(request);
};

export const listIncomingTransferRequests = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const requests = await StudentTransferRepository.studentTransferRequest.findMany({
    where: { toSchoolId: schoolId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
      fromSchool: { select: { id: true, name: true, code: true } },
    },
  });

  res.status(200).json(requests);
};

export const acceptTransferRequest = async (req: Request, res: Response) => {
  const payload = transferDecisionSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const request = await StudentTransferRepository.studentTransferRequest.findFirst({
    where: { id, toSchoolId: schoolId, status: 'PENDING' },
    include: { student: true, fromSchool: true, toSchool: true },
  });
  if (!request) {
    throw new HttpError(404, 'Transfer request not found');
  }

  const uploadsRoot = path.resolve(process.cwd(), 'uploads');
  const fromSchoolId = request.fromSchoolId;
  const toSchoolId = request.toSchoolId;
  const studentId = request.studentId;

  const oldBase = `/uploads/schools/${fromSchoolId}`;
  const newBase = `/uploads/schools/${toSchoolId}`;

  const rewriteUrl = (value: string | null) => {
    if (!value) return value;
    if (!value.startsWith(oldBase)) return value;
    return value.replace(oldBase, newBase);
  };

  const moveDir = async (fromDir: string, toDir: string) => {
    try {
      await fs.access(fromDir, fsConstants.F_OK);
    } catch {
      return;
    }
    await fs.mkdir(path.dirname(toDir), { recursive: true });
    try {
      await fs.rename(fromDir, toDir);
    } catch (err: any) {
      if (err?.code === 'EXDEV') {
        await fs.cp(fromDir, toDir, { recursive: true });
        await fs.rm(fromDir, { recursive: true, force: true });
        return;
      }
      throw err;
    }
  };

  await moveDir(
    path.join(uploadsRoot, 'schools', fromSchoolId, 'students', studentId),
    path.join(uploadsRoot, 'schools', toSchoolId, 'students', studentId),
  );
  await moveDir(
    path.join(uploadsRoot, 'schools', fromSchoolId, 'documents', studentId),
    path.join(uploadsRoot, 'schools', toSchoolId, 'documents', studentId),
  );

  const result = await StudentTransferRepository.$transaction(async (tx) => {
    const student = await tx.student.findFirst({
      where: { id: studentId },
      select: { photoUrl: true, docBirthCert: true, docTransferCert: true, docAadhaar: true, docReportCard: true },
    });

    const photos = await tx.studentPhoto.findMany({
      where: { studentId },
      select: { id: true, url: true },
    });

    await tx.student.update({
      where: { id: studentId },
      data: {
        schoolId: toSchoolId,
        classId: null,
        sectionId: null,
        status: 'ENROLLED',
        photoUrl: student?.photoUrl ? rewriteUrl(student.photoUrl) : null,
        docBirthCert: student?.docBirthCert ? rewriteUrl(student.docBirthCert) : null,
        docTransferCert: student?.docTransferCert ? rewriteUrl(student.docTransferCert) : null,
        docAadhaar: student?.docAadhaar ? rewriteUrl(student.docAadhaar) : null,
        docReportCard: student?.docReportCard ? rewriteUrl(student.docReportCard) : null,
      },
    });

    for (const photo of photos) {
      const nextUrl = rewriteUrl(photo.url);
      if (nextUrl !== photo.url) {
        await tx.studentPhoto.update({
          where: { id: photo.id },
          data: { url: nextUrl },
        });
      }
    }

    await tx.studentStatusHistory.create({
      data: {
        studentId,
        status: 'TRANSFERRED',
        reason: payload.reason ?? `Transfer accepted to ${request.toSchool.name}`,
      },
    });

    return tx.studentTransferRequest.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        decidedById: req.auth.userId,
        decidedAt: new Date(),
        reason: payload.reason ?? null,
      },
    });
  });

  await AuditLogService.record(req, {
    schoolId,
    entityType: 'STUDENT_TRANSFER',
    entityId: result.id,
    action: 'ACCEPT',
    beforeState: { status: 'PENDING' },
    afterState: { status: result.status, reason: result.reason },
  });

  await invalidateStudentCache(fromSchoolId, request.studentId);
  await invalidateStudentCache(schoolId, request.studentId);
  await invalidateAttendanceCache(fromSchoolId);
  await invalidateAttendanceCache(schoolId);

  res.status(200).json(result);
};

export const rejectTransferRequest = async (req: Request, res: Response) => {
  const payload = transferDecisionSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const existing = await StudentTransferRepository.studentTransferRequest.findFirst({
    where: { id, toSchoolId: schoolId, status: 'PENDING' },
    select: { id: true },
  });
  if (!existing) {
    throw new HttpError(404, 'Transfer request not found');
  }

  const request = await StudentTransferRepository.studentTransferRequest.update({
    where: { id },
    data: {
      status: 'REJECTED',
      decidedById: req.auth.userId,
      decidedAt: new Date(),
      reason: payload.reason ?? null,
    },
  });

  await AuditLogService.record(req, {
    schoolId,
    entityType: 'STUDENT_TRANSFER',
    entityId: request.id,
    action: 'REJECT',
    beforeState: { status: 'PENDING' },
    afterState: { status: request.status, reason: request.reason },
  });

  await invalidateStudentCache(schoolId);

  res.status(200).json(request);
};

export const StudentTransferService = {
  acceptTransferRequest,
  createTransferRequest,
  listIncomingTransferRequests,
  listTransferTargets,
  rejectTransferRequest,
};
