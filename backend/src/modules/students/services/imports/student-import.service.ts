import type { Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import type { Prisma } from '@prisma/client';
import { StudentImportRepository } from '../../repositories/import.repository';
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
import { encryptStudentSensitiveFields } from '../../utils/student-sensitive-fields';
import {
  encryptParentGuardianSensitiveFields,
  parentGuardianContactWhere,
} from '../../utils/parent-guardian-sensitive-fields';

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
    const year = await StudentImportRepository.academicYear.findFirst({ where: { id: payload.academicSessionId, schoolId }, select: { id: true } });
    if (!year) throw new HttpError(404, 'Academic session not found');
  }
  if (payload.classId) {
    const cls = await StudentImportRepository.class.findFirst({ where: { id: payload.classId, schoolId }, select: { id: true } });
    if (!cls) throw new HttpError(404, 'Class not found');
  }
  if (payload.sectionId) {
    const section = await StudentImportRepository.section.findFirst({ where: { id: payload.sectionId, schoolId }, select: { id: true } });
    if (!section) throw new HttpError(404, 'Section not found');
  }
  if (payload.classId && payload.sectionId) {
    const link = await StudentImportRepository.classSection.findFirst({ where: { schoolId, classId: payload.classId, sectionId: payload.sectionId }, select: { id: true } });
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
  const existing = await StudentImportRepository.studentEnrollment.findFirst({
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


export const downloadStudentImportSample = async (req: Request, res: Response) => {
  requireSchoolAdmin(req);
  const csv = buildStudentSampleCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="student-import-sample.csv"');
  res.status(200).send(csv);
};

export const importStudents = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  if (!req.file) throw new HttpError(400, 'Student import file is required');
  const payload = importSchema.parse(req.body);
  await ensureAcademicScope(schoolId, payload);

  const rows = await loadStudentImportRows(req.file);
  const errors: Array<{ rowNumber: number; field?: string; message: string; rawData?: Record<string, string> }> = [];
  const validRows: Array<Record<string, string>> = [];
  const seenAdmission = new Set<string>();
  const seenRoll = new Set<string>();
  const seenGuardianEmail = new Set<string>();
  const seenGuardianPhone = new Set<string>();

  const admissionNos = rows.map((row) => row.admission_no).filter(Boolean);
  const rollNos = rows.map((row) => row.roll_no).filter(Boolean);
  const guardianEmails = rows.map((row) => row.email).filter(Boolean);
  const guardianPhones = rows.map((row) => row.father_phone || row.mother_phone || row.phone).filter(Boolean);

  const guardianEmailWhere = parentGuardianContactWhere(schoolId, 'email', guardianEmails);
  const guardianPhoneWhere = parentGuardianContactWhere(schoolId, 'phone', guardianPhones);

  const [existingStudents, existingRolls, existingGuardiansByEmail, existingGuardiansByPhone] = await Promise.all([
    StudentImportRepository.student.findMany({ where: { schoolId, admissionNo: { in: admissionNos } }, select: { admissionNo: true } }),
    StudentImportRepository.studentEnrollment.findMany({
      where: {
        schoolId,
        academicSessionId: payload.academicSessionId,
        classId: payload.classId,
        sectionId: payload.sectionId,
        rollNo: { in: rollNos },
      },
      select: { rollNo: true },
    }),
    guardianEmailWhere.length
      ? StudentImportRepository.parentGuardian.findMany({ where: { OR: guardianEmailWhere }, select: { email: true } })
      : Promise.resolve([]),
    guardianPhoneWhere.length
      ? StudentImportRepository.parentGuardian.findMany({ where: { OR: guardianPhoneWhere }, select: { phone: true } })
      : Promise.resolve([]),
  ]);
  const existingAdmissionSet = new Set(existingStudents.map((item) => item.admissionNo));
  const existingRollSet = new Set(existingRolls.map((item) => item.rollNo).filter(Boolean));
  const existingGuardianEmailSet = new Set(existingGuardiansByEmail.map((item) => item.email).filter(Boolean));
  const existingGuardianPhoneSet = new Set(existingGuardiansByPhone.map((item) => item.phone).filter(Boolean));

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const rowErrors: typeof errors = [];
    for (const field of requiredImportFields) {
      if (!row[field]) rowErrors.push({ rowNumber, field, message: 'Required', rawData: row });
    }
    if (row.date_of_birth && !dateOnlyPattern.test(row.date_of_birth)) {
      rowErrors.push({ rowNumber, field: 'date_of_birth', message: 'Use YYYY-MM-DD date format', rawData: row });
    }
    if (row.admission_date && !dateOnlyPattern.test(row.admission_date)) {
      rowErrors.push({ rowNumber, field: 'admission_date', message: 'Use YYYY-MM-DD date format', rawData: row });
    }
    if (row.admission_no && (seenAdmission.has(row.admission_no) || existingAdmissionSet.has(row.admission_no))) {
      rowErrors.push({ rowNumber, field: 'admission_no', message: seenAdmission.has(row.admission_no) ? 'Duplicate in file' : 'Admission number already exists', rawData: row });
    }
    if (row.roll_no && (seenRoll.has(row.roll_no) || existingRollSet.has(row.roll_no))) {
      rowErrors.push({ rowNumber, field: 'roll_no', message: seenRoll.has(row.roll_no) ? 'Duplicate in file' : 'Roll number already exists in selected class-section-session', rawData: row });
    }
    if (row.email && (seenGuardianEmail.has(row.email) || existingGuardianEmailSet.has(row.email))) {
      rowErrors.push({ rowNumber, field: 'email', message: seenGuardianEmail.has(row.email) ? 'Duplicate guardian email in file' : 'Guardian email already exists', rawData: row });
    }
    const guardianPhone = row.father_phone || row.mother_phone || row.phone;
    if (guardianPhone && (seenGuardianPhone.has(guardianPhone) || existingGuardianPhoneSet.has(guardianPhone))) {
      rowErrors.push({ rowNumber, field: 'phone', message: seenGuardianPhone.has(guardianPhone) ? 'Duplicate guardian phone in file' : 'Guardian phone already exists', rawData: row });
    }
    if (rowErrors.length) {
      errors.push(...rowErrors);
      return;
    }
    seenAdmission.add(row.admission_no);
    seenRoll.add(row.roll_no);
    if (row.email) seenGuardianEmail.add(row.email);
    if (guardianPhone) seenGuardianPhone.add(guardianPhone);
    validRows.push(row);
  });

  await enforceLimits(schoolId, 'students', validRows.length);
  let successCount = 0;
  await StudentImportRepository.$transaction(async (tx) => {
    for (const row of validRows) {
      const firstName = normalizeText(row.first_name)!;
      const lastName = normalizeText(row.last_name) ?? 'Student';
      const fullName = `${firstName} ${lastName}`.trim();
      const student = await tx.student.create({
        data: encryptStudentSensitiveFields({
          schoolId,
          academicSessionId: payload.academicSessionId,
          classId: payload.classId,
          sectionId: payload.sectionId,
          admissionNo: row.admission_no,
          rollNo: row.roll_no,
          firstName,
          lastName,
          fullName,
          dob: safeDate(row.date_of_birth),
          gender: nullableText(row.gender),
          bloodGroup: nullableText(row.blood_group),
          religion: nullableText(row.religion),
          caste: nullableText(row.caste),
          email: nullableText(row.email),
          phone: nullableText(row.phone),
          admissionDate: safeDate(row.admission_date) ?? new Date(),
          category: nullableText(row.category),
          height: row.height ? Number(row.height) : null,
          weight: row.weight ? Number(row.weight) : null,
          fatherName: nullableText(row.father_name),
          fatherOccupation: nullableText(row.father_occupation),
          fatherPhone: nullableText(row.father_phone),
          motherName: nullableText(row.mother_name),
          motherOccupation: nullableText(row.mother_occupation),
          motherPhone: nullableText(row.mother_phone),
          guardianName: nullableText(row.father_name || row.mother_name),
          guardianRelationship: nullableText(row.guardian_relation),
          parentPhone: nullableText(row.father_phone || row.mother_phone || row.phone),
          parentEmail: nullableText(row.email),
          presentAddress: nullableText(row.present_address),
          permanentAddress: nullableText(row.permanent_address),
          addressLine1: nullableText(row.present_address),
          status: 'ENROLLED',
        }),
      });
      await tx.studentEnrollment.create({
        data: {
          schoolId,
          studentId: student.id,
          academicSessionId: payload.academicSessionId,
          classId: payload.classId,
          sectionId: payload.sectionId,
          rollNo: row.roll_no,
          status: 'ENROLLED',
          enrolledAt: safeDate(row.admission_date) ?? new Date(),
        },
      });
      const guardians = [
        { type: 'FATHER', name: nullableText(row.father_name), occupation: nullableText(row.father_occupation), phone: nullableText(row.father_phone), email: nullableText(row.email), relation: 'Father', isPrimary: row.guardian_relation?.toLowerCase() === 'father' },
        { type: 'MOTHER', name: nullableText(row.mother_name), occupation: nullableText(row.mother_occupation), phone: nullableText(row.mother_phone), relation: 'Mother', isPrimary: row.guardian_relation?.toLowerCase() === 'mother' },
      ].filter((guardian) => guardian.name);
      if (guardians.length) {
        await tx.parentGuardian.createMany({
          data: guardians.map((guardian) => ({
            ...encryptParentGuardianSensitiveFields({
              schoolId,
              studentId: student.id,
              type: guardian.type,
              name: guardian.name!,
              occupation: guardian.occupation ?? null,
              phone: guardian.phone ?? null,
              email: guardian.email ?? null,
              relation: guardian.relation,
              isPrimary: guardian.isPrimary,
            }),
          })),
        });
      }
      await tx.studentStatusHistory.create({ data: { studentId: student.id, status: 'ENROLLED', reason: 'Bulk import' } });
      successCount += 1;
    }
    if (successCount > 0) {
      await tx.usageCounter.upsert({
        where: { schoolId },
        update: { students: { increment: successCount } },
        create: { schoolId, students: successCount, teachers: 0 },
      });
    }
    await tx.studentImportLog.create({
      data: {
        schoolId,
        academicSessionId: payload.academicSessionId,
        classId: payload.classId,
        sectionId: payload.sectionId,
        createdById: userId,
        fileName: req.file!.originalname,
        status: 'COMPLETED',
        totalRows: rows.length,
        successCount,
        failedCount: errors.length,
        report: { errors } as Prisma.InputJsonValue,
      },
    });
  });

  await invalidateStudentCache(schoolId);
  res.status(200).json({
    success: true,
    totalRows: rows.length,
    successCount,
    failedCount: errors.length,
    errors,
  });
};

export const StudentImportService = {
  downloadStudentImportSample,
  importStudents,
  uploadStudentImportMiddleware,
};
