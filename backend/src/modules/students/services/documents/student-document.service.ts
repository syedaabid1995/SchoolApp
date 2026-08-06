import type { Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import type { Prisma } from '@prisma/client';
import { StudentDocumentRepository } from '../../repositories/document.repository';
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
import { normalizeStudentDocumentFiles } from '../../utils/student-document-files';

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
    const year = await StudentDocumentRepository.academicYear.findFirst({ where: { id: payload.academicSessionId, schoolId }, select: { id: true } });
    if (!year) throw new HttpError(404, 'Academic session not found');
  }
  if (payload.classId) {
    const cls = await StudentDocumentRepository.class.findFirst({ where: { id: payload.classId, schoolId }, select: { id: true } });
    if (!cls) throw new HttpError(404, 'Class not found');
  }
  if (payload.sectionId) {
    const section = await StudentDocumentRepository.section.findFirst({ where: { id: payload.sectionId, schoolId }, select: { id: true } });
    if (!section) throw new HttpError(404, 'Section not found');
  }
  if (payload.classId && payload.sectionId) {
    const link = await StudentDocumentRepository.classSection.findFirst({ where: { schoolId, classId: payload.classId, sectionId: payload.sectionId }, select: { id: true } });
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
  const existing = await StudentDocumentRepository.studentEnrollment.findFirst({
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

const documentFileSchema = z.object({
  url: z.string().min(1),
  fileName: z.string().max(255).optional().nullable(),
  mimeType: z.string().max(120).optional().nullable(),
  sizeBytes: z.coerce.number().int().positive().optional().nullable(),
});

const documentSchema = z
  .object({
    title: z.string().min(1).max(160),
    documentNumber: z.string().trim().max(120).optional().nullable(),
    url: z.string().min(1).optional(),
    fileName: z.string().max(255).optional().nullable(),
    mimeType: z.string().max(120).optional().nullable(),
    sizeBytes: z.coerce.number().int().positive().optional().nullable(),
    files: z.array(documentFileSchema).min(1).max(20).optional(),
  })
  .superRefine((value, ctx) => {
    if ((!value.files || value.files.length === 0) && !value.url?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one file is required',
        path: ['files'],
      });
    }
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


export const addStudentPhoto = async (req: Request, res: Response) => {
  const payload = photoSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const student = await StudentDocumentRepository.student.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });

  if (!student) {
    throw new HttpError(404, 'Student not found');
  }

  const count = await StudentDocumentRepository.studentPhoto.count({ where: { studentId: id } });
  if (count >= 5) {
    throw new HttpError(400, 'Maximum 5 photos allowed');
  }

  const photo = await StudentDocumentRepository.studentPhoto.create({
    data: { studentId: id, url: payload.url },
  });

  await AuditLogService.record(req, {
    schoolId,
    entityType: 'STUDENT_PHOTO',
    entityId: photo.id,
    action: 'CREATE',
    afterState: { studentId: id, url: payload.url },
  });

  await invalidateStudentCache(schoolId, id);

  res.status(201).json(photo);
};

export const deleteStudentPhoto = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id, photoId } = req.params;

  const student = await StudentDocumentRepository.student.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });

  if (!student) {
    throw new HttpError(404, 'Student not found');
  }

  const photo = await StudentDocumentRepository.studentPhoto.findFirst({
    where: { id: photoId, studentId: id },
  });

  if (!photo) {
    throw new HttpError(404, 'Photo not found');
  }

  await StudentDocumentRepository.studentPhoto.delete({ where: { id: photoId } });

  await AuditLogService.record(req, {
    schoolId,
    entityType: 'STUDENT_PHOTO',
    entityId: photoId,
    action: 'DELETE',
    beforeState: { studentId: id, url: photo.url },
  });

  await invalidateStudentCache(schoolId, id);

  res.status(204).send();
};

export const addStudentDocument = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  const payload = documentSchema.parse(req.body);
  const { id } = req.params;
  const student = await StudentDocumentRepository.student.findFirst({ where: { id, schoolId }, select: { id: true } });
  if (!student) throw new HttpError(404, 'Student not found');

  const files = normalizeStudentDocumentFiles({
    url: payload.url,
    fileName: payload.fileName,
    mimeType: payload.mimeType,
    sizeBytes: payload.sizeBytes,
    files: payload.files,
  });
  if (!files.length) throw new HttpError(400, 'At least one file is required');
  const primary = files[0];

  const document = await StudentDocumentRepository.studentDocument.create({
    data: {
      schoolId,
      studentId: id,
      title: normalizeText(payload.title)!,
      documentNumber: nullableText(payload.documentNumber),
      url: primary.url,
      fileName: primary.fileName ?? null,
      mimeType: primary.mimeType ?? null,
      sizeBytes: primary.sizeBytes ?? null,
      files: files as Prisma.InputJsonValue,
      uploadedById: userId,
    },
  });
  await AuditLogService.record(req, {
    schoolId,
    entityType: 'STUDENT_DOCUMENT',
    entityId: document.id,
    action: 'CREATE',
    afterState: {
      studentId: id,
      title: document.title,
      documentNumber: document.documentNumber,
      fileCount: files.length,
    },
  });
  await invalidateStudentCache(schoolId, id);
  res.status(201).json(document);
};

export const deleteStudentDocument = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const { id, documentId } = req.params;
  const document = await StudentDocumentRepository.studentDocument.findFirst({ where: { id: documentId, studentId: id, schoolId } });
  if (!document) throw new HttpError(404, 'Document not found');
  await StudentDocumentRepository.studentDocument.delete({ where: { id: documentId } });
  await AuditLogService.record(req, {
    schoolId,
    entityType: 'STUDENT_DOCUMENT',
    entityId: documentId,
    action: 'DELETE',
    beforeState: { studentId: id, title: document.title },
  });
  await invalidateStudentCache(schoolId, id);
  res.status(204).send();
};

export const StudentDocumentService = {
  addStudentDocument,
  addStudentPhoto,
  deleteStudentDocument,
  deleteStudentPhoto,
};
